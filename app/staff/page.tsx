import type { Metadata } from "next";
import { DayNav } from "@/components/admin/day-nav";
import { StaffDayView } from "@/components/staff/staff-day";
import { site } from "@/lib/site";
import { formatDate, isDateKey, istToday } from "@/lib/time";
import { requireStaffPageUser } from "@/server/admin/auth";
import { getStaffDay } from "@/server/staff-portal";

// The layout template only applies to child segments, so this page sets its full title.
export const metadata: Metadata = { title: { absolute: `My schedule · ${site.name} staff` } };

export default async function StaffSchedulePage({ searchParams }: PageProps<"/staff">) {
  const user = await requireStaffPageUser(); // the layout gate checked too; this page needs the staffId
  const { date: raw } = await searchParams;
  const today = istToday();
  const date = typeof raw === "string" && isDateKey(raw) ? raw : today;
  const day = await getStaffDay(user.staffId, date);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{date === today ? "Today" : formatDate(date)}</h1>
          <p className="text-[12px] text-muted">{date === today ? formatDate(date, { year: true }) : `Hi, ${user.name.split(" ")[0]}`}</p>
        </div>
        <DayNav date={date} today={today} basePath="/staff" />
      </div>
      <StaffDayView key={date} day={day} />
    </>
  );
}
