import Image from "next/image";
import { cn } from "@/lib/utils";

const sizes = { sm: 28, md: 32, lg: 56, xl: 80 } as const;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

/** Round avatar with photo, falling back to initials (DESIGN.md §4). */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const px = sizes[size];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-hover font-semibold uppercase text-muted",
        size === "sm" || size === "md" ? "text-xs" : size === "lg" ? "text-base" : "text-xl",
        className,
      )}
      style={{ width: px, height: px }}
    >
      {src ? (
        <Image src={src} alt={name} fill sizes={`${px}px`} className="object-cover" />
      ) : (
        <span aria-label={name}>{initials(name)}</span>
      )}
    </span>
  );
}
