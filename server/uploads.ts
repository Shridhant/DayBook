import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";

/**
 * Image uploads on the VPS disk (AGENTS.md §9 "Uploaded images"):
 * - accept only real JPEG/PNG/WebP/AVIF/HEIF images (checked by decoding, not by file name),
 * - fix camera orientation, resize to at most 1600px, re-encode as WebP,
 * - drop all metadata (EXIF, including phone GPS location),
 * - store under a random name; the original file name is never used.
 * Reel clips (saveVideo) are the exception: MP4/WebM checked by their bytes and stored as is.
 * Files are served by app/uploads/[...path]/route.ts. Back up UPLOAD_DIR with the database.
 * UPLOAD_DIR lives outside the build, so file calls carry turbopackIgnore (otherwise the bundler
 * traces the whole project into the deploy output).
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1600;
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif"]);
export const UPLOAD_KINDS = ["portfolio", "staff", "instagram", "testimonials", "services"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const PUBLIC_PATH = /^\/uploads\/(?:(?:portfolio|staff|instagram|testimonials|services)\/[0-9a-f-]{36}\.webp|instagram\/[0-9a-f-]{36}\.(?:mp4|webm))$/;

/** Reel clips are stored as uploaded (no video encoder on the server), so they need a tighter cap. */
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = { webp: "image/webp", mp4: "video/mp4", webm: "video/webm" };

/** Content-Type for a stored upload, from its (server-chosen) extension. */
export function uploadContentType(publicPath: string): string {
  return CONTENT_TYPES[publicPath.slice(publicPath.lastIndexOf(".") + 1)] ?? "application/octet-stream";
}

export class UploadError extends Error {}

function uploadRoot() {
  return path.resolve(env.UPLOAD_DIR);
}

/** Maps a public "/uploads/…" path to a file inside UPLOAD_DIR, or null if it isn't one of ours. */
export function resolveUpload(publicPath: string): string | null {
  if (!PUBLIC_PATH.test(publicPath)) return null;
  const root = uploadRoot();
  const file = path.resolve(root, publicPath.slice("/uploads/".length));
  return file.startsWith(root + path.sep) ? file : null;
}

export async function saveImage(input: Buffer, kind: UploadKind): Promise<{ path: string; width: number; height: number }> {
  if (input.byteLength === 0) throw new UploadError("The file is empty.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("Images must be 15 MB or smaller.");

  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: 50_000_000 }).metadata()).format;
  } catch {
    throw new UploadError("That doesn't look like an image. Use a JPEG, PNG or WebP photo.");
  }
  if (!format || !ACCEPTED.has(format)) throw new UploadError("Use a JPEG, PNG or WebP photo.");

  const output = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate() // apply EXIF orientation before metadata is dropped
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => {
      // e.g. iPhone HEIC files: the bundled image library can't decode HEVC.
      throw new UploadError("This image format isn't supported. Export it as JPEG and try again.");
    });

  const publicPath = `/uploads/${kind}/${randomUUID()}.webp`;
  const file = resolveUpload(publicPath);
  if (!file) throw new UploadError("Couldn't store the image.");
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file, output.data, { flag: "wx" });
  return { path: publicPath, width: output.info.width, height: output.info.height };
}

/**
 * Sniffs the container from the file's bytes, never its name or the browser's MIME type.
 * MP4 (ISO base media: "ftyp" box at offset 4) or WebM (EBML header). QuickTime .mov files also
 * use "ftyp" but with brand "qt  ", and browsers other than Safari can't play them.
 */
function videoFormat(input: Buffer): "mp4" | "webm" | null {
  if (input.length >= 12 && input.toString("latin1", 4, 8) === "ftyp") {
    return input.toString("latin1", 8, 12) === "qt  " ? null : "mp4";
  }
  if (input.length >= 4 && input.readUInt32BE(0) === 0x1a45dfa3) return "webm";
  return null;
}

/** Saves a reel clip for an Instagram card. Stored as is under a random name. */
export async function saveVideo(input: Buffer): Promise<{ path: string }> {
  if (input.byteLength === 0) throw new UploadError("The file is empty.");
  if (input.byteLength > MAX_VIDEO_BYTES) throw new UploadError("Clips must be 30 MB or smaller. Trim it or export at 720p.");
  const format = videoFormat(input);
  if (!format) throw new UploadError("Use an MP4 video (the format Instagram saves reels in).");

  const publicPath = `/uploads/instagram/${randomUUID()}.${format}`;
  const file = resolveUpload(publicPath);
  if (!file) throw new UploadError("Couldn't store the video.");
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file, input, { flag: "wx" });
  return { path: publicPath };
}

export async function readUpload(publicPath: string): Promise<Buffer | null> {
  const file = resolveUpload(publicPath);
  if (!file) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ file);
  } catch {
    return null;
  }
}

/**
 * Streams part of an upload for HTTP range requests (video seeking; Safari won't play a video
 * without them). `range` is the inclusive [start, end] already clamped by the caller, or null for all.
 */
export async function openUpload(
  publicPath: string,
): Promise<{ size: number; stream: (range: [number, number] | null) => ReadableStream<Uint8Array> } | null> {
  const file = resolveUpload(publicPath);
  if (!file) return null;
  const info = await stat(/*turbopackIgnore: true*/ file).catch(() => null);
  if (!info?.isFile()) return null;
  return {
    size: info.size,
    stream: (range) =>
      Readable.toWeb(
        createReadStream(/*turbopackIgnore: true*/ file, range ? { start: range[0], end: range[1] } : {}),
      ) as ReadableStream<Uint8Array>,
  };
}

/** Removes an uploaded file. Ignores non-upload paths (e.g. /placeholders/…) and missing files. */
export async function deleteUpload(publicPath: string | null | undefined): Promise<void> {
  if (!publicPath) return;
  const file = resolveUpload(publicPath);
  if (!file) return;
  await unlink(/*turbopackIgnore: true*/ file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
