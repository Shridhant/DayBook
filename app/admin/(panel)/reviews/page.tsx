import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { TestimonialsManager } from "@/components/admin/content-managers";
import { requirePageUser } from "@/server/admin/auth";
import { listTestimonialsAdmin } from "@/server/admin/content-admin";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  await requirePageUser();
  return (
    <>
      <PageHeader title="Reviews" description="Customer reviews shown on the website." />
      <PageBody>
        <TestimonialsManager items={await listTestimonialsAdmin()} />
      </PageBody>
    </>
  );
}
