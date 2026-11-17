import { FRONT_DESK, adminRoute, AdminError } from "@/server/admin/http";
import { MAX_UPLOAD_BYTES, MAX_VIDEO_BYTES, saveImage, saveVideo, UPLOAD_KINDS, UploadError, type UploadKind } from "@/server/uploads";

/**
 * POST /api/admin/uploads (multipart: file, kind[, media=video]) → { path, width, height } for
 * photos, { path } for reel clips (kind "instagram" only).
 */
export const POST = adminRoute({ roles: FRONT_DESK }, async ({ request, user }) => {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_VIDEO_BYTES + 64 * 1024) throw new AdminError(413, "too_large", "Files must be 30 MB or smaller.");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  const isVideo = form?.get("media") === "video";
  if (!(file instanceof File)) throw new AdminError(400, "invalid_request", isVideo ? "Choose a video to upload." : "Choose an image to upload.");
  if (typeof kind !== "string" || !UPLOAD_KINDS.includes(kind as UploadKind) || (isVideo && kind !== "instagram")) {
    throw new AdminError(400, "invalid_request", "Invalid upload type.");
  }
  if (!isVideo && file.size > MAX_UPLOAD_BYTES) throw new AdminError(413, "too_large", "Images must be 15 MB or smaller.");
  // Services and prices are owner-only (AGENTS.md §8), so are their photos.
  if (kind === "services" && user.role !== "owner") throw new AdminError(403, "forbidden", "Only the owner can change services.");
  try {
    const data = Buffer.from(await file.arrayBuffer());
    return isVideo ? await saveVideo(data) : await saveImage(data, kind as UploadKind);
  } catch (error) {
    if (error instanceof UploadError) throw new AdminError(422, isVideo ? "invalid_video" : "invalid_image", error.message);
    throw error;
  }
});
