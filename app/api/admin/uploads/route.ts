import { FRONT_DESK, adminRoute, AdminError } from "@/server/admin/http";
import { MAX_UPLOAD_BYTES, saveImage, UPLOAD_KINDS, UploadError, type UploadKind } from "@/server/uploads";

/** POST /api/admin/uploads (multipart: file, kind) → { path, width, height } */
export const POST = adminRoute({ roles: FRONT_DESK }, async ({ request }) => {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new AdminError(413, "too_large", "Images must be 15 MB or smaller.");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File)) throw new AdminError(400, "invalid_request", "Choose an image to upload.");
  if (typeof kind !== "string" || !UPLOAD_KINDS.includes(kind as UploadKind)) {
    throw new AdminError(400, "invalid_request", "Invalid upload type.");
  }
  try {
    return await saveImage(Buffer.from(await file.arrayBuffer()), kind as UploadKind);
  } catch (error) {
    if (error instanceof UploadError) throw new AdminError(422, "invalid_image", error.message);
    throw error;
  }
});
