import type { BookingStatus } from "@/lib/booking-status";

/** Shared labels/tones for booking status across admin screens. */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Awaiting payment",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const STATUS_TONE: Record<BookingStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  pending: "warning",
  confirmed: "accent",
  completed: "success",
  no_show: "danger",
  cancelled: "neutral",
  expired: "neutral",
};

export const SOURCE_LABEL = { online: "Online", walk_in: "Walk-in", phone: "Phone" } as const;
