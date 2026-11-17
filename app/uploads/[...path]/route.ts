import { openUpload, uploadContentType } from "@/server/uploads";

/**
 * Serves uploads (photos and reel clips) from UPLOAD_DIR. Next only serves /public files that
 * existed at build time, so runtime uploads need this route. File names are random and never
 * reused: cache forever. Byte ranges are supported because browsers fetch video in ranges.
 */
export async function GET(request: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path } = await ctx.params;
  const publicPath = `/uploads/${path.join("/")}`;
  const upload = await openUpload(publicPath);
  if (!upload) return new Response("Not found", { status: 404 });

  const headers = {
    "Content-Type": uploadContentType(publicPath),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  const range = parseRange(request.headers.get("range"), upload.size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${upload.size}` } });
  }
  if (!range) {
    return new Response(upload.stream(null), { headers: { ...headers, "Content-Length": String(upload.size) } });
  }
  const [start, end] = range;
  return new Response(upload.stream(range), {
    status: 206,
    headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${upload.size}` },
  });
}

/** A single "bytes=a-b" / "bytes=a-" / "bytes=-n" range; multi-range requests get the whole file. */
function parseRange(header: string | null, size: number): [number, number] | null | "invalid" {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return [start, end];
}
