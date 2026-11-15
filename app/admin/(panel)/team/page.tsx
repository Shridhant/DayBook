import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { TeamManager } from "@/components/admin/team-manager";
import { requirePageUser } from "@/server/admin/auth";
import { OWNER_ONLY } from "@/server/admin/http";
import { listStaffAdmin } from "@/server/admin/staff-admin";
import { listTeam } from "@/server/admin/team";

export const metadata: Metadata = { title: "Team logins" };

export default async function TeamPage() {
  const user = await requirePageUser(OWNER_ONLY);
  const [team, staff] = await Promise.all([listTeam(), listStaffAdmin()]);
  return (
    <>
      <PageHeader title="Team logins" description="Who can sign in to the admin. Customers never need an account." />
      <PageBody>
        <TeamManager team={team} staff={staff.filter((s) => s.active)} currentUserId={user.id} />
      </PageBody>
    </>
  );
}
