import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { ClosuresManager } from "@/components/admin/closures-manager";
import { requirePageUser } from "@/server/admin/auth";
import { listClosures } from "@/server/admin/settings-admin";

export const metadata: Metadata = { title: "Closures" };

export default async function ClosuresPage() {
  await requirePageUser();
  return (
    <>
      <PageHeader title="Closures" description="Holidays and days the studio is shut. No bookings can be made on these days." />
      <PageBody>
        <ClosuresManager closures={await listClosures()} />
      </PageBody>
    </>
  );
}
