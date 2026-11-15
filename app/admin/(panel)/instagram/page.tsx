import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { InstagramManager } from "@/components/admin/content-managers";
import { requirePageUser } from "@/server/admin/auth";
import { listInstagramAdmin } from "@/server/admin/content-admin";

export const metadata: Metadata = { title: "Instagram" };

export default async function InstagramPage() {
  await requirePageUser();
  return (
    <>
      <PageHeader title="Instagram" description="Reels and posts shown on the website. They only load when a visitor taps them." />
      <PageBody>
        <InstagramManager posts={await listInstagramAdmin()} />
      </PageBody>
    </>
  );
}
