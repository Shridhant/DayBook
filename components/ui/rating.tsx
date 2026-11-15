import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Star rating in brand pink (DESIGN.md §11.4). Rounds to the nearest whole star. */
export function Rating({ value, max = 5, size = 16, className }: { value: number; max?: number; size?: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span role="img" aria-label={`Rated ${value} out of ${max}`} className={cn("inline-flex gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          width={size}
          height={size}
          className={i < filled ? "fill-brand text-brand" : "fill-none text-line"}
        />
      ))}
    </span>
  );
}
