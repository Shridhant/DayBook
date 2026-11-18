import Image from "next/image";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/** The salon's square mark (admin sidebar, login). Falls back to the name's first letter on a tile. */
export function BrandMark({ size, className }: { size: number; className?: string }) {
  if (site.logo) {
    return <Image src={site.logo.mark} alt="" width={size} height={size} className={cn("shrink-0 rounded-lg", className)} />;
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn("flex shrink-0 items-center justify-center rounded-lg bg-ink text-[13px] font-semibold text-surface", className)}
    >
      {site.name.slice(0, 1)}
    </span>
  );
}
