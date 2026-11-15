import { readUpload } from "@/server/uploads";

/**
 * Serves uploaded images from UPLOAD_DIR. Next only serves /public files that existed at build
 * time, so runtime uploads need this route. File names are random and never reused: cache forever.
 */
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path } = await ctx.params;
  const data = await readUpload(`/uploads/${path.join("/")}`);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
