import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Inline banner (DESIGN.md §11.5 "Errors"). `public` size for the customer site, `app` for admin. */
const tones = {
  info: { icon: Info, box: "bg-hover text-ink", iconColor: "text-muted" },
  success: { icon: CircleCheck, box: "bg-success/8 text-ink", iconColor: "text-success" },
  warning: { icon: TriangleAlert, box: "bg-warning/8 text-ink", iconColor: "text-warning" },
  danger: { icon: CircleAlert, box: "bg-danger/8 text-danger", iconColor: "text-danger" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
  size = "public",
  className,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  size?: "public" | "app";
  className?: string;
}) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl",
        size === "public" ? "p-4 text-[15px]" : "p-3 text-[13px]",
        t.box,
        className,
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 shrink-0", size === "public" ? "size-5" : "size-4", t.iconColor)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", tone !== "danger" && "text-muted")}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
