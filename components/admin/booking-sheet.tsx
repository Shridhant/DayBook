"use client";

import { Ban, Check, MessageCircle, Phone, RotateCcw, UserX } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Code, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, Sheet, SheetContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { availableActions, type AdminAction } from "@/lib/booking-status";
import { formatINR } from "@/lib/money";
import { formatIndianMobile, toE164 } from "@/lib/phone";
import { formatDate, formatDuration, formatTime } from "@/lib/time";
import type { AdminBooking } from "@/server/admin/bookings";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_TONE } from "./booking-ui";

const ACTION_UI: Record<Exclude<AdminAction, "cancel">, { label: string; icon: typeof Check; variant: "primary" | "secondary" }> = {
  complete: { label: "Mark completed", icon: Check, variant: "primary" },
  no_show: { label: "No-show", icon: UserX, variant: "secondary" },
  reopen: { label: "Reopen", icon: RotateCcw, variant: "secondary" },
};

const DONE_MESSAGE: Record<AdminAction, string> = {
  complete: "Marked as completed",
  no_show: "Marked as no-show",
  cancel: "Booking cancelled",
  reopen: "Booking reopened",
};

async function patchBooking(id: string, body: { action: AdminAction; reason?: string }): Promise<AdminBooking> {
  const response = await fetch(`/api/admin/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as { booking?: AdminBooking; message?: string } | null;
  if (!response.ok || !data?.booking) throw new Error(data?.message ?? "Couldn't update the booking.");
  return data.booking;
}

/** Side panel with a booking's details and the actions its status allows. */
export function BookingSheet({
  booking,
  onClose,
  onUpdated,
}: {
  booking: AdminBooking | null;
  onClose: () => void;
  onUpdated: (booking: AdminBooking) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<AdminAction | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function run(action: AdminAction, extra?: { reason?: string }) {
    if (!booking) return;
    setBusy(action);
    try {
      const updated = await patchBooking(booking.id, { action, ...extra });
      onUpdated(updated);
      toast({ title: DONE_MESSAGE[action], description: `${updated.code} · ${updated.customer.name}`, tone: "success" });
      setCancelOpen(false);
      setReason("");
    } catch (error) {
      toast({ title: "Couldn't update", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const actions = booking ? availableActions(booking.status) : [];
  const dueAtStudio = booking ? Math.max(0, booking.totalPaise - booking.paidPaise) : 0;
  const phoneE164 = booking ? toE164(booking.customer.phone) : null;

  return (
    <>
      <Sheet open={booking !== null} onOpenChange={(open) => !open && onClose()}>
        {booking && (
          <SheetContent side="right" title={`Booking ${booking.code}`} className="w-[min(400px,92vw)]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Code>{booking.code}</Code>
                <StatusPill tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</StatusPill>
                <span className="text-[12px] text-muted">{SOURCE_LABEL[booking.source]}</span>
              </div>

              {booking.refundDue && (
                <Alert size="app" tone="warning" title="Refund due">
                  {formatINR(booking.paidPaise)} was paid online. Refund it from the Razorpay dashboard (in-app refunds come in phase 2).
                </Alert>
              )}

              <section>
                <p className="text-[15px] font-semibold">
                  {formatDate(booking.date)}, {formatTime(booking.startMin)} – {formatTime(booking.endMin)}
                </p>
                <p className="text-muted">with {booking.staffName}</p>
              </section>

              <section className="card p-3">
                <p className="font-medium">{booking.customer.name}</p>
                <p className="text-muted tabular-nums">{formatIndianMobile(booking.customer.phone)}</p>
                {phoneE164 && (
                  <div className="mt-2 flex gap-1.5">
                    <Button asChild size="sm">
                      <a href={`tel:${phoneE164}`}>
                        <Phone /> Call
                      </a>
                    </Button>
                    <Button asChild size="sm">
                      <a href={`https://wa.me/${phoneE164.slice(1)}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle /> WhatsApp
                      </a>
                    </Button>
                  </div>
                )}
              </section>

              <section>
                <h3 className="label">Services</h3>
                <ul className="space-y-1">
                  {booking.items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>
                        {item.name} <span className="text-muted">· {formatDuration(item.durationMin)}</span>
                      </span>
                      <span className="tabular-nums">{formatINR(item.pricePaise)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-1 border-t border-line pt-3">
                  <div className="flex justify-between">
                    <dt className="text-muted">Total</dt>
                    <dd className="tabular-nums">{formatINR(booking.totalPaise)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Paid online</dt>
                    <dd className="tabular-nums">{formatINR(booking.paidPaise)}</dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt>Due at the studio</dt>
                    <dd className="tabular-nums">{formatINR(booking.status === "cancelled" ? 0 : dueAtStudio)}</dd>
                  </div>
                </dl>
              </section>

              {booking.notes && (
                <section>
                  <h3 className="label">Customer notes</h3>
                  <p className="whitespace-pre-wrap">{booking.notes}</p>
                </section>
              )}
              {booking.cancelReason && (
                <section>
                  <h3 className="label">Cancellation reason</h3>
                  <p>{booking.cancelReason}</p>
                </section>
              )}

              {actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-line pt-4">
                  {actions.map((action) => {
                    if (action === "cancel") {
                      return (
                        <Button key={action} variant="danger" size="md" onClick={() => setCancelOpen(true)} disabled={busy !== null}>
                          <Ban /> {booking.status === "pending" ? "Release hold" : "Cancel booking"}
                        </Button>
                      );
                    }
                    const ui = ACTION_UI[action];
                    const Icon = ui.icon;
                    return (
                      <Button
                        key={action}
                        variant={ui.variant}
                        size="md"
                        loading={busy === action}
                        disabled={busy !== null && busy !== action}
                        onClick={() => run(action)}
                      >
                        {busy !== action && <Icon />} {ui.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>

      <Dialog open={cancelOpen} onOpenChange={(open) => !busy && setCancelOpen(open)}>
        {booking && (
          <DialogContent
            size="sm"
            title={booking.status === "pending" ? "Release this hold?" : "Cancel this booking?"}
            description={`${booking.customer.name} · ${formatDate(booking.date)}, ${formatTime(booking.startMin)}. The slot becomes free for others.`}
            footer={
              <>
                <Button size="md" onClick={() => setCancelOpen(false)} disabled={busy !== null}>
                  Keep booking
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  className="bg-danger hover:bg-danger/90"
                  loading={busy === "cancel"}
                  onClick={() => run("cancel", { reason })}
                >
                  {booking.status === "pending" ? "Release hold" : "Cancel booking"}
                </Button>
              </>
            }
          >
            {booking.paidPaise > 0 && (
              <Alert size="app" tone="warning">
                {formatINR(booking.paidPaise)} was paid online. It will be marked as a refund due.
              </Alert>
            )}
            <Field label="Reason (optional)" hint="Visible to the team only">
              <Textarea value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
