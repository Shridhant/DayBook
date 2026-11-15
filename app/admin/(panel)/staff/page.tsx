import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { LeaveRequests } from "@/components/admin/leave-requests";
import { StaffList } from "@/components/admin/staff-list";
import { requirePageUser } from "@/server/admin/auth";
import { listLeaveRequests, listStaffAdmin } from "@/server/admin/staff-admin";

export const metadata: Metadata = { title: "Artists" };

export default async function StaffPage() {
  const user = await requirePageUser();
  const [staff, requests] = await Promise.all([listStaffAdmin(), listLeaveRequests()]);
  return (
    <>
      <PageHeader title="Artists" description={`${staff.filter((s) => s.active).length} active`} />
      <PageBody>
        {requests.length > 0 && <LeaveRequests requests={requests} />}
        <StaffList staff={staff} canEdit={user.role === "owner"} />
      </PageBody>
    </>
  );
}
