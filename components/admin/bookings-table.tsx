"use client";

import { Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Code, StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { formatIndianMobile } from "@/lib/phone";
import { formatDate, formatTime } from "@/lib/time";
import type { AdminBooking } from "@/server/admin/bookings";
import { BookingSheet } from "./booking-sheet";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_TONE } from "./booking-ui";

export function BookingsTable({ rows }: { rows: AdminBooking[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AdminBooking | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState icon={Inbox} title="No bookings match">
        Try a different search or widen the dates.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="card thin-scroll overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">Ref</th>
              <th className="th">When</th>
              <th className="th">Customer</th>
              <th className="th">Services</th>
              <th className="th">Artist</th>
              <th className="th text-right">Total</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr
                key={b.id}
                tabIndex={0}
                onClick={() => setSelected(b)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(b))}
                className="cursor-pointer transition-colors outline-none hover:bg-canvas/60 focus-visible:bg-canvas"
              >
                <td className="td whitespace-nowrap">
                  <Code>{b.code}</Code>
                </td>
                <td className="td whitespace-nowrap tabular-nums">
                  {formatDate(b.date)}, {formatTime(b.startMin)}
                </td>
                <td className="td whitespace-nowrap">
                  <span className="block font-medium">{b.customer.name}</span>
                  <span className="block text-xs text-muted tabular-nums">{formatIndianMobile(b.customer.phone)}</span>
                </td>
                <td className="td max-w-56 min-w-40">
                  <span className="block truncate">{b.items.map((i) => i.name).join(", ")}</span>
                  <span className="block text-xs text-muted">{SOURCE_LABEL[b.source]}</span>
                </td>
                <td className="td whitespace-nowrap">{b.staffName}</td>
                <td className="td text-right tabular-nums">{formatINR(b.totalPaise)}</td>
                <td className="td whitespace-nowrap">
                  <StatusPill tone={b.refundDue ? "warning" : STATUS_TONE[b.status]}>
                    {b.refundDue ? "Refund due" : STATUS_LABEL[b.status]}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BookingSheet
        booking={selected}
        onClose={() => setSelected(null)}
        onUpdated={(b) => {
          setSelected(b);
          router.refresh();
        }}
      />
    </>
  );
}
