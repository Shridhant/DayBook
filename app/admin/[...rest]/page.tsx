import { notFound } from "next/navigation";

/** Unknown /admin/* URLs show the admin 404 (app/admin/not-found.tsx) instead of the public one. */
export default function AdminCatchAll() {
  notFound();
}
