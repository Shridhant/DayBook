import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { StaffList } from "@/components/admin/staff-list";
import { requirePageUser } from "@/server/admin/auth";
import { listStaffAdmin } from "@/server/admin/staff-admin";

export const metadata: Metadata = { title: "Artists" };

export default async function StaffPage() {
  const user = await requirePageUser();
  const staff = await listStaffAdmin();
  return (
    <>
      <PageHeader title="Artists" description={`${staff.filter((s) => s.active).length} active`} />
      <PageBody>
        <StaffList staff={staff} canEdit={user.role === "owner"} />
      </PageBody>
    </>
  );
}
