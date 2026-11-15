import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder. Pulses unless the user prefers reduced motion. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-hover motion-reduce:animate-none", className)} {...props} />;
}
