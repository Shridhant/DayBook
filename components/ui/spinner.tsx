import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <Loader2
      aria-hidden
      className={cn("shrink-0 animate-spin motion-reduce:animate-none", className)}
      width={size}
      height={size}
    />
  );
}
