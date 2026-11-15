import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { SettingsForm } from "@/components/admin/settings-form";
import { requirePageUser } from "@/server/admin/auth";
import { OWNER_ONLY } from "@/server/admin/http";
import { getSettingsAdmin } from "@/server/admin/settings-admin";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePageUser(OWNER_ONLY);
  return (
    <>
      <PageHeader title="Settings" description="Booking rules and opening hours" />
      <PageBody>
        <SettingsForm settings={await getSettingsAdmin()} />
      </PageBody>
    </>
  );
}
