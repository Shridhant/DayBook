import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";

/**
 * Image uploads on the VPS disk (AGENTS.md §9 "Uploaded images"):
 * - accept only real JPEG/PNG/WebP/AVIF/HEIF images (checked by decoding, not by file name),
 * - fix camera orientation, resize to at most 1600px, re-encode as WebP,
 * - drop all metadata (EXIF, including phone GPS location),
 * - store under a random name; the original file name is never used.
 * Files are served by app/uploads/[...path]/route.ts. Back up UPLOAD_DIR with the database.
 * UPLOAD_DIR lives outside the build, so file calls carry turbopackIgnore (otherwise the bundler
 * traces the whole project into the deploy output).
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1600;
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif"]);
export const UPLOAD_KINDS = ["portfolio", "staff", "instagram", "testimonials"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const PUBLIC_PATH = /^\/uploads\/(portfolio|staff|instagram|testimonials)\/[0-9a-f-]{36}\.webp$/;

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

export async function readUpload(publicPath: string): Promise<Buffer | null> {
  const file = resolveUpload(publicPath);
  if (!file) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ file);
  } catch {
    return null;
  }
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
