"use client";

import { Check } from "lucide-react";
import { Checkbox as RCheckbox, Switch as RSwitch } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: ComponentProps<typeof RSwitch.Root>) {
  return (
    <RSwitch.Root
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-active transition-colors duration-150",
        "outline-none focus-visible:ring-3 focus-visible:ring-accent/25 data-[state=checked]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <RSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/.2)] transition-transform duration-150 data-[state=checked]:translate-x-[18px] motion-reduce:transition-none" />
    </RSwitch.Root>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof RCheckbox.Root>) {
  return (
    <RCheckbox.Root
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-line bg-surface transition-colors duration-100",
        "outline-none focus-visible:ring-3 focus-visible:ring-accent/25",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-white",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <RCheckbox.Indicator>
        <Check className="size-3" strokeWidth={3} />
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
}
