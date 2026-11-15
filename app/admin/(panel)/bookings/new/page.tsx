import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { NewBookingForm } from "@/components/admin/new-booking-form";
import { isDateKey, istToday } from "@/lib/time";
import { requirePageUser } from "@/server/admin/auth";
import { getCatalog } from "@/server/catalog";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: PageProps<"/admin/bookings/new">) {
  await requirePageUser();
  const { date } = await searchParams;
  const catalog = await getCatalog();
  return (
    <>
      <PageHeader title="New booking" description="Walk-in or phone booking" />
      <PageBody>
        <NewBookingForm catalog={catalog} initialDate={typeof date === "string" && isDateKey(date) ? date : istToday()} />
      </PageBody>
    </>
  );
}
