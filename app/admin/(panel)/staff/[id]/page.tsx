import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { StaffEditor } from "@/components/admin/staff-editor";
import { requirePageUser } from "@/server/admin/auth";
import { listServicesAdmin } from "@/server/admin/services-admin";
import { getStaffDetail } from "@/server/admin/staff-admin";

export const metadata: Metadata = { title: "Artist" };

export default async function StaffDetailPage({ params }: PageProps<"/admin/staff/[id]">) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [staff, catalog] = await Promise.all([getStaffDetail(id), listServicesAdmin()]);
  if (!staff) notFound();
  return (
    <>
      <PageHeader title="Artist" description={staff.name} />
      <PageBody>
        <StaffEditor staff={staff} categories={catalog.categories} services={catalog.services} canEdit={user.role === "owner"} />
      </PageBody>
    </>
  );
}
