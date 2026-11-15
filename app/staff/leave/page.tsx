import type { Metadata } from "next";
import { StaffLeave } from "@/components/staff/staff-leave";
import { istToday } from "@/lib/time";
import { requireStaffPageUser } from "@/server/admin/auth";
import { listOwnLeave } from "@/server/staff-portal";

export const metadata: Metadata = { title: "Leave" };

export default async function StaffLeavePage() {
  const user = await requireStaffPageUser();
  const leave = await listOwnLeave(user.staffId);
  return (
    <>
      <div className="mb-4">
        <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Leave</h1>
        <p className="text-[12px] text-muted">Ask for time off. The front desk approves it, and it then blocks online booking.</p>
      </div>
      <StaffLeave leave={leave} today={istToday()} />
    </>
  );
}
