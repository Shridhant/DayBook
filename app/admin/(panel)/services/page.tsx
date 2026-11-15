import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { ServicesManager } from "@/components/admin/services-manager";
import { requirePageUser } from "@/server/admin/auth";
import { OWNER_ONLY } from "@/server/admin/http";
import { listServicesAdmin } from "@/server/admin/services-admin";
import { listStaffAdmin } from "@/server/admin/staff-admin";

export const metadata: Metadata = { title: "Services & prices" };

export default async function ServicesPage() {
  await requirePageUser(OWNER_ONLY);
  const [{ categories, services }, staff] = await Promise.all([listServicesAdmin(), listStaffAdmin()]);
  return (
    <>
      <PageHeader title="Services & prices" description="Changes show on the website immediately. Existing bookings keep their price." />
      <PageBody>
        <ServicesManager categories={categories} services={services} staff={staff.filter((s) => s.active)} />
      </PageBody>
    </>
  );
}
