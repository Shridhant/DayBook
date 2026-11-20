"use client";

import { FolderPlus, ImageIcon, Plus, Scissors, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Section } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/menu";
import { Checkbox, Switch } from "@/components/ui/toggle";
import { formatINR, paiseToRupeesInput } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import type { AdminCategory, AdminService } from "@/server/admin/services-admin";
import type { StaffListItem } from "@/server/admin/staff-admin";
import { adminFetch, ImageUpload, RowActions, useMutation } from "./admin-kit";

type Form = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  priceIsFrom: boolean;
  durationMin: number;
  bookingAmountOverride: string;
  active: boolean;
  staffIds: string[];
  imagePath: string | null;
};

const DURATIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 15).filter((m) => m <= 480);

function toForm(s: AdminService | null, categoryId: string): Form {
  return s
    ? {
        categoryId: s.categoryId,
        name: s.name,
        description: s.description ?? "",
        price: paiseToRupeesInput(s.pricePaise),
        priceIsFrom: s.priceIsFrom,
        durationMin: s.durationMin,
        bookingAmountOverride: s.bookingAmountOverridePaise === null ? "" : paiseToRupeesInput(s.bookingAmountOverridePaise),
        active: s.active,
        staffIds: s.staffIds,
        imagePath: s.imagePath,
      }
    : {
        categoryId,
        name: "",
        description: "",
        price: "",
        priceIsFrom: false,
        durationMin: 60,
        bookingAmountOverride: "",
        active: true,
        staffIds: [],
        imagePath: null,
      };
}

export function ServicesManager({
  categories,
  services,
  staff,
}: {
  categories: AdminCategory[];
  services: AdminService[];
  staff: StaffListItem[];
}) {
  const { run, busy } = useMutation();
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  const open = (s: AdminService | null, categoryId = categories[0]?.id ?? "") => {
    setError(null);
    setEditing({ id: s?.id ?? null, form: toForm(s, s?.categoryId ?? categoryId) });
  };
  const patch = (p: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));

  async function save() {
    if (!editing) return;
    const { id, form } = editing;
    setError(null);
    const ok = await run(
      () => adminFetch(id ? `/api/admin/services/${id}` : "/api/admin/services", { method: id ? "PUT" : "POST", body: form }).catch((e) => {
        setError({ field: e.field, message: e.message });
        throw e;
      }),
      id ? "Service saved" : "Service added",
    );
    if (ok) setEditing(null);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-1.5">
        <Button onClick={() => setCategoriesOpen(true)}>
          <FolderPlus /> Categories
        </Button>
        <Button variant="primary" onClick={() => open(null)} disabled={!categories.length}>
          <Plus /> Add service
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={Scissors} title="Start with a category" action={<Button onClick={() => setCategoriesOpen(true)}>Add a category</Button>}>
          Group services like Manicure, Extensions or Nail art.
        </EmptyState>
      ) : (
        categories.map((c) => {
          const list = services.filter((s) => s.categoryId === c.id);
          return (
            <Section
              key={c.id}
              title={c.name}
              description={`${list.length} service${list.length === 1 ? "" : "s"}`}
              actions={
                <Button size="sm" onClick={() => open(null, c.id)}>
                  <Plus /> Add
                </Button>
              }
            >
              {list.length === 0 ? (
                <p className="text-muted">No services in this category yet.</p>
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  {/* Fixed column widths so every category's table lines up. */}
                  <table className="w-full min-w-[640px] table-fixed text-sm">
                    <colgroup>
                      <col />
                      <col className="w-24" />
                      <col className="w-28" />
                      <col className="w-28" />
                      <col className="w-40" />
                      <col className="w-12" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="th pl-5">Service</th>
                        <th className="th">Duration</th>
                        <th className="th text-right">Price</th>
                        <th className="th text-right">Pay to book</th>
                        <th className="th">Artists</th>
                        <th className="th" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((s) => (
                        <tr key={s.id} className="hover:bg-canvas/60">
                          <td className="td pl-5">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas text-muted">
                                {s.imagePath ? (
                                  <Image src={s.imagePath} alt="" fill sizes="36px" className="object-cover" />
                                ) : (
                                  <ImageIcon className="size-4" aria-label="No photo" />
                                )}
                              </span>
                              <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => open(s)}>
                                {s.name}
                              </button>
                              {!s.active && <Chip>Hidden</Chip>}
                            </div>
                          </td>
                          <td className="td tabular-nums">{formatDuration(s.durationMin)}</td>
                          <td className="td text-right tabular-nums">
                            {s.priceIsFrom && <span className="text-muted">from </span>}
                            {formatINR(s.pricePaise)}
                          </td>
                          <td className="td text-right text-muted tabular-nums">
                            {s.bookingAmountOverridePaise === null ? "Default" : formatINR(s.bookingAmountOverridePaise)}
                          </td>
                          <td className="td">
                            {s.staffIds.length ? <span className="tabular-nums">{s.staffIds.length}</span> : <Chip tone="warning">None: not bookable</Chip>}
                          </td>
                          <td className="td w-10 text-right">
                            <RowActions
                              onEdit={() => open(s)}
                              onMove={(direction) => run(() => adminFetch(`/api/admin/services/${s.id}/move`, { method: "POST", body: { direction } }))}
                              onDelete={async () => {
                                await run(() => adminFetch(`/api/admin/services/${s.id}`, { method: "DELETE" }), "Service deleted");
                              }}
                              confirmTitle={`Delete ${s.name}?`}
                              confirmDescription="Services that already have bookings can't be deleted. Hide them instead."
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          );
        })
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && !busy && setEditing(null)}>
        {editing && (
          <DialogContent
            title={editing.id ? "Edit service" : "Add service"}
            footer={
              <>
                <Button size="md" onClick={() => setEditing(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button size="md" variant="primary" loading={busy} onClick={save}>
                  Save
                </Button>
              </>
            }
          >
            <div className="flex items-start gap-4">
              <ImageUpload
                kind="services"
                value={editing.form.imagePath}
                onChange={(img) => patch({ imagePath: img?.path ?? null })}
                label="Add photo"
                className="w-28 shrink-0"
              />
              <div className="pt-1 text-muted">
                <p className="font-medium text-ink">Photo</p>
                <p className="mt-0.5 text-xs">
                  Shown on the website and when customers book. A clear, close-up photo of this service, ideally portrait (4:5).
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" error={error?.field === "name" ? error.message : undefined} className="sm:col-span-2">
                <Input value={editing.form.name} maxLength={80} onChange={(e) => patch({ name: e.target.value })} />
              </Field>
              <Field label="Category">
                <Select
                  value={editing.form.categoryId}
                  onValueChange={(v) => patch({ categoryId: v })}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Duration">
                <Select
                  value={String(editing.form.durationMin)}
                  onValueChange={(v) => patch({ durationMin: Number(v) })}
                  options={[...new Set([...DURATIONS, editing.form.durationMin])].sort((a, b) => a - b).map((m) => ({ value: String(m), label: formatDuration(m) }))}
                />
              </Field>
              <Field label="Price (₹)" error={error?.field === "price" ? error.message : undefined}>
                <Input inputMode="decimal" value={editing.form.price} onChange={(e) => patch({ price: e.target.value })} placeholder="1200" />
              </Field>
              <Field
                label="Pay to book (₹)"
                hint="Leave empty to use the default from Settings"
                error={error?.field === "bookingAmountOverride" ? error.message : undefined}
              >
                <Input inputMode="decimal" value={editing.form.bookingAmountOverride} onChange={(e) => patch({ bookingAmountOverride: e.target.value })} />
              </Field>
              <Field label="Description" hint="One line, shown on the menu" className="sm:col-span-2">
                <Textarea rows={2} value={editing.form.description} maxLength={300} onChange={(e) => patch({ description: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2">
                <Checkbox checked={editing.form.priceIsFrom} onCheckedChange={(v) => patch({ priceIsFrom: v === true })} /> Show as &quot;from&quot; price
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={editing.form.active} onCheckedChange={(v) => patch({ active: v })} /> Visible and bookable
              </label>
            </div>
            <div>
              <span className="label">Artists who do this</span>
              {staff.length === 0 ? (
                <p className="text-muted">Add artists first.</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
                  {staff.map((st) => (
                    <label key={st.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        checked={editing.form.staffIds.includes(st.id)}
                        onCheckedChange={(v) =>
                          patch({ staffIds: v === true ? [...editing.form.staffIds, st.id] : editing.form.staffIds.filter((x) => x !== st.id) })
                        }
                      />
                      <span className="truncate">{st.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {error && !["name", "price", "bookingAmountOverride"].includes(error.field ?? "") && <p className="text-xs text-danger">{error.message}</p>}
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent
          size="sm"
          title="Categories"
          description="Shown as tabs on the website's menu. Categories with a photo also get a big photo tile on the home page."
        >
          <ul className="divide-y divide-line rounded-lg border border-line">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                <ImageUpload
                  compact
                  kind="services"
                  value={c.imagePath}
                  label={`Add a photo for ${c.name}`}
                  onChange={(img) =>
                    run(
                      () => adminFetch(`/api/admin/categories/${c.id}`, { method: "PATCH", body: { imagePath: img?.path ?? null } }),
                      img ? "Photo saved" : "Photo removed",
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate">
                  {c.name} <span className="text-xs text-muted">· {c.serviceCount}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${c.name}`}
                  disabled={c.serviceCount > 0}
                  title={c.serviceCount > 0 ? "Move or delete its services first" : undefined}
                  onClick={() => run(() => adminFetch(`/api/admin/categories/${c.id}`, { method: "DELETE" }), "Category deleted")}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-1.5">
            <Input value={newCategory} maxLength={40} placeholder="New category name" onChange={(e) => setNewCategory(e.target.value)} />
            <Button
              size="md"
              variant="primary"
              disabled={newCategory.trim().length < 2}
              loading={busy}
              onClick={async () => {
                if (await run(() => adminFetch("/api/admin/categories", { method: "POST", body: { name: newCategory } }), "Category added")) setNewCategory("");
              }}
            >
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
