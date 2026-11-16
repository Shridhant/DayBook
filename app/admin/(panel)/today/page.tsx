import { CalendarCheck, IndianRupee, ReceiptText, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { DayCalendar } from "@/components/admin/day-calendar";
import { DayNav } from "@/components/admin/day-nav";
import { WeekStrip } from "@/components/admin/week-strip";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { formatDate, isDateKey, istToday } from "@/lib/time";
import { requirePageUser } from "@/server/admin/auth";
import { getDaySchedule } from "@/server/admin/bookings";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/admin/today">) {
  await requirePageUser(); // defence in depth: the layout gate already checked
  const { date: raw } = await searchParams;
  const today = istToday();
  const date = typeof raw === "string" && isDateKey(raw) ? raw : today;
  const schedule = await getDaySchedule(date);

  const live = schedule.bookings.filter((b) => b.status !== "cancelled");
  const onShift = schedule.staff.filter((s) => s.shifts.length > 0 && s.leave.length === 0).length;
  const dueAtStudio = live
    .filter((b) => b.status === "confirmed" || b.status === "completed")
    .reduce((sum, b) => sum + Math.max(0, b.totalPaise - b.paidPaise), 0);
  const refundsDue = schedule.bookings.filter((b) => b.refundDue).length;

  return (
    <>
      <PageHeader
        title={date === today ? "Today" : formatDate(date, { year: true })}
        description={date === today ? formatDate(date, { year: true }) : undefined}
        actions={
          <>
            <DayNav date={date} today={today} basePath="/admin/today" />
            <Button asChild variant="primary">
              <Link href={`/admin/bookings/new?date=${date}`}>New booking</Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={CalendarCheck} label="Bookings" value={live.length} hint={`${live.filter((b) => b.status === "pending").length} awaiting payment`} />
          <Stat icon={Users} label="Artists on shift" value={onShift} total={schedule.staff.length} />
          <Stat icon={IndianRupee} label="Due at the studio" value={formatINR(dueAtStudio)} hint="Confirmed and completed" />
          {date === today ? (
            <Stat icon={ReceiptText} label="Collected online today" value={formatINR(schedule.collectedTodayPaise)} hint={refundsDue ? `${refundsDue} refund due` : "No refunds due"} />
          ) : (
            <Stat icon={ReceiptText} label="Refunds due" value={refundsDue} hint="Paid online, then cancelled" />
          )}
        </div>
        <WeekStrip date={date} today={today} basePath="/admin/today" />
        <DayCalendar key={date} schedule={schedule} />
      </PageBody>
    </>
  );
}
