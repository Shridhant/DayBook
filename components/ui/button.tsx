import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

/**
 * DESIGN.md §5 Buttons (app sizes) and §11.4 (public sizes).
 * App sizes are `sm | md | icon`; public sizes are prefixed `pub-` and are pill-shaped, touch-sized.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none",
    "transition-[background-color,color,box-shadow,border-color] duration-150",
    "focus-visible:ring-3 focus-visible:ring-accent/25 outline-none",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    "[&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white hover:bg-accent-hover shadow-[0_1px_0_rgb(255_255_255/.15)_inset,0_1px_2px_rgb(0_0_0/.12)]",
        secondary: "bg-surface border border-line text-ink hover:bg-hover shadow-[0_1px_2px_rgb(0_0_0/.04)]",
        muted: "bg-hover text-ink hover:bg-active",
        ghost: "text-muted hover:text-ink hover:bg-hover",
        danger: "text-danger hover:bg-danger/10",
        /** Ebony fill. Public final-CTA band uses the inverse: light button on dark. */
        ink: "bg-ink text-surface hover:bg-ink/90",
        inverse: "bg-surface text-ink hover:bg-surface/90",
      },
      size: {
        sm: "h-7 rounded-lg px-2.5 text-xs gap-1.5 [&_svg]:size-3.5",
        md: "h-8 rounded-lg px-3 text-[13px] gap-1.5 [&_svg]:size-4",
        icon: "size-7 rounded-lg [&_svg]:size-4",
        /** Auth and full-width app buttons. */
        lg: "h-9 rounded-lg px-3.5 text-[13px] gap-2 [&_svg]:size-4",
        "pub-sm": "h-9 rounded-full px-4 text-[14px] gap-1.5 [&_svg]:size-4",
        "pub-md": "h-11 rounded-full px-5 text-[15px] gap-2 [&_svg]:size-[18px]",
        "pub-lg": "h-12 rounded-full px-6 text-[16px] gap-2 [&_svg]:size-5",
        "pub-icon": "size-11 rounded-full [&_svg]:size-5",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [
      // Public ghost buttons read as ink, not muted (§11.4).
      { variant: "ghost", size: ["pub-sm", "pub-md", "pub-lg", "pub-icon"], class: "text-ink" },
      // Public focus ring uses the brand pink.
      { size: ["pub-sm", "pub-md", "pub-lg", "pub-icon"], class: "focus-visible:ring-brand/30" },
    ],
    defaultVariants: { variant: "secondary", size: "sm" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Next `<Link>`) with button styles. */
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, block }), className);

  if (asChild) {
    return (
      <Slot.Root className={classes} aria-disabled={disabled || loading || undefined} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
