import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { PortfolioManager } from "@/components/admin/content-managers";
import { requirePageUser } from "@/server/admin/auth";
import { listPortfolioAdmin } from "@/server/admin/content-admin";
import { listServicesAdmin } from "@/server/admin/services-admin";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  await requirePageUser();
  const [items, { categories }] = await Promise.all([listPortfolioAdmin(), listServicesAdmin()]);
  return (
    <>
      <PageHeader title="Portfolio" description="Photos on the website. Featured photos appear in the hero." />
      <PageBody>
        <PortfolioManager items={items} categories={categories} />
      </PageBody>
    </>
  );
}
