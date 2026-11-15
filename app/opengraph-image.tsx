import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

/** Link preview for WhatsApp/Instagram/etc. (DESIGN.md §11.7): Pampas, Ebony, one pink accent. */
export const alt = `${site.name}, ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#FDFDFC",
          color: "#111827",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: "#B8007B" }}>
          {site.tagline}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            Nails, done&nbsp;<span style={{ color: "#FF00AA" }}>beautifully</span>.
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: "#5F6672" }}>Book online in under a minute.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{site.name}</div>
          <div style={{ display: "flex", width: 140, height: 14, borderRadius: 7, background: "#FF00AA" }} />
        </div>
      </div>
    ),
    size,
  );
}
