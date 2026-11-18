// Builds the salon's logo files from one source image (default public/logo.png, transparent PNG):
//   public/site/logo.png       the wordmark, trimmed to its letters (site header)
//   public/site/logo-mark.png  square mark: the first letter in white on a tile of the logo's colour
//   app/icon.png, app/apple-icon.png  favicon and home-screen icon (Next picks these up)
// Usage: npm run brand:icons [-- path/to/logo.png]. Rerun whenever the logo or brand colour changes,
// then update `logo` in lib/site.ts if the printed size differs.
import sharp from "sharp";

const source = process.argv[2] ?? "public/logo.png";

/* Wordmark: trim the transparent margin. */
const wordmark = await sharp(source).trim({ threshold: 10 }).png().toBuffer({ resolveWithObject: true });
// Shown about 36px tall in the header: 640px wide is plenty for 3x screens and keeps it light.
const header = await sharp(wordmark.data).resize({ width: 640, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true }).toBuffer({ resolveWithObject: true });
await sharp(header.data).toFile("public/site/logo.png");
console.log(`public/site/logo.png  ${header.info.width}×${header.info.height}`);

/* Mark: the first glyph of the top line, found from the alpha channel. */
const { data, info } = await sharp(wordmark.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
// The tile takes the logo's own colour (average of its solid pixels), so the icon matches the logo.
const sum = [0, 0, 0];
let count = 0;
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] < 250) continue;
  sum[0] += data[i];
  sum[1] += data[i + 1];
  sum[2] += data[i + 2];
  count++;
}
const brand = `#${sum.map((v) => Math.round(v / count).toString(16).padStart(2, "0")).join("")}`;
const solid = (x, y) => data[(y * info.width + x) * 4 + 3] > 40;
// The top line ends at the first fully empty row (the gap above any second line of text).
let lineBottom = 0;
while (lineBottom < info.height && [...Array(info.width).keys()].some((x) => solid(x, lineBottom))) lineBottom++;
// The first glyph ends at the first empty column within that line.
let glyphRight = 0;
while (glyphRight < info.width && [...Array(lineBottom).keys()].some((y) => solid(glyphRight, y))) glyphRight++;

const glyph = await sharp(wordmark.data).extract({ left: 0, top: 0, width: glyphRight, height: lineBottom }).toBuffer();
const SIZE = 512;
const inner = Math.round(SIZE * 0.62);
// White letter: keep the glyph's alpha, paint it white.
const letter = await sharp(glyph)
  .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .extractChannel("alpha")
  .toBuffer()
  .then((alpha) => sharp({ create: { width: inner, height: inner, channels: 3, background: "#ffffff" } }).joinChannel(alpha).png().toBuffer());
const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 0.22}" fill="${brand}"/></svg>`);
const mark = await sharp(tile)
  .composite([{ input: letter, left: Math.round((SIZE - inner) / 2), top: Math.round((SIZE - inner) / 2) }])
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(mark).resize(256, 256).toFile("public/site/logo-mark.png");
await sharp(mark).toFile("app/icon.png");
// iOS masks its own rounded corners, so the home-screen icon is a full square.
const square = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="${brand}"/></svg>`);
const apple = await sharp(square)
  .composite([{ input: letter, left: Math.round((SIZE - inner) / 2), top: Math.round((SIZE - inner) / 2) }])
  .png()
  .toBuffer();
// sharp resizes before compositing in one pipeline, so shrink in a second step.
await sharp(apple).resize(180, 180).toFile("app/apple-icon.png");
console.log(`public/site/logo-mark.png, app/icon.png, app/apple-icon.png  (tile ${brand}, the logo's colour)`);
