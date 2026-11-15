import type { SVGProps } from "react";

/**
 * Brand glyphs that lucide-react no longer ships. Drawn on lucide's 24px grid with currentColor
 * strokes, so they size and colour exactly like lucide icons (including `[&_svg]` button rules).
 */

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
