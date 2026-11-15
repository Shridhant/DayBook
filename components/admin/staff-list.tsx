"use client";

import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import type { StaffListItem } from "@/server/admin/staff-admin";
import { adminFetch, useMutation } from "./admin-kit";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function StaffList({ staff, canEdit }: { staff: StaffListItem[]; canEdit: boolean }) {
  const router = useRouter();
  const { run, busy } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [specialties, setSpecialties] = useState("");

  async function create() {
    let id = "";
    const ok = await run(async () => {
      id = (await adminFetch<{ id: string }>("/api/admin/staff", { method: "POST", body: { name, specialties } })).id;
    }, "Artist added");
    if (ok) router.push(`/admin/staff/${id}`);
  }

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus /> Add artist
          </Button>
        </div>
      )}
      {staff.length === 0 ? (
        <EmptyState icon={Users} title="No artists yet">
          Add your team so customers can book them.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Artist</th>
                <th className="th">Works</th>
                <th className="th">Services</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-canvas/60">
                  <td className="td">
                    <Link href={`/admin/staff/${s.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
                      <Avatar name={s.name} src={s.photoPath} size="md" />
                      <span>
                        <span className="block">{s.name}</span>
                        {s.specialties && <span className="block text-xs font-normal text-muted">{s.specialties}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="td whitespace-nowrap text-muted">{s.workDays.length ? s.workDays.map((d) => DAYS[d]).join(" ") : "No shifts"}</td>
                  <td className="td tabular-nums">{s.skillCount}</td>
                  <td className="td">{s.active ? <Chip tone="success">Active</Chip> : <Chip>Inactive</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="sm"
          title="Add artist"
          description="You can add their photo, services and hours next."
          footer={
            <>
              <Button size="md" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="md" variant="primary" loading={busy} disabled={name.trim().length < 2} onClick={create}>
                Add artist
              </Button>
            </>
          }
        >
          <Field label="Name">
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Specialties" hint="Shown on the website, e.g. Extensions, nail art">
            <Input value={specialties} maxLength={120} onChange={(e) => setSpecialties(e.target.value)} />
          </Field>
        </DialogContent>
      </Dialog>
    </>
  );
}
