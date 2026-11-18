"use client";

import { Images, MessageSquareQuote, Plus, Star, Video } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Rating } from "@/components/ui/rating";
import { Checkbox, Switch } from "@/components/ui/toggle";
import { parseInstagramUrl } from "@/lib/instagram";
import type { AdminInstagramPost, AdminPortfolioItem, AdminTestimonial } from "@/server/admin/content-admin";
import type { AdminCategory } from "@/server/admin/services-admin";
import { adminFetch, ImageUpload, RowActions, useMutation, VideoUpload, type UploadedImage } from "./admin-kit";

/** Shared edit dialog shell with Cancel / Save. */
function EditDialog({
  open,
  title,
  busy,
  canSave,
  onClose,
  onSave,
  children,
}: {
  open: boolean;
  title: string;
  busy: boolean;
  canSave: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      {open && (
        <DialogContent
          title={title}
          footer={
            <>
              <Button size="md" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button size="md" variant="primary" loading={busy} disabled={!canSave} onClick={onSave}>
                Save
              </Button>
            </>
          }
        >
          {children}
        </DialogContent>
      )}
    </Dialog>
  );
}

const move = (base: string, id: string, direction: "up" | "down") => adminFetch(`${base}/${id}/move`, { method: "POST", body: { direction } });

/* ---------- Portfolio ---------- */

type PortfolioForm = { image: UploadedImage | null; alt: string; caption: string; categoryId: string; featured: boolean; active: boolean };

export function PortfolioManager({ items, categories }: { items: AdminPortfolioItem[]; categories: AdminCategory[] }) {
  const { run, busy } = useMutation();
  // `originalPath` is the saved photo, so a save only sends a new image when one was uploaded.
  const [editing, setEditing] = useState<{ id: string | null; originalPath: string | null; form: PortfolioForm } | null>(null);
  const patch = (p: Partial<PortfolioForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  async function save() {
    if (!editing) return;
    const { id, form, originalPath } = editing;
    const body = { alt: form.alt, caption: form.caption, categoryId: form.categoryId || null, featured: form.featured, active: form.active };
    const replaced = form.image && form.image.path !== originalPath ? form.image : undefined;
    const ok = await run(
      () =>
        id
          ? adminFetch(`/api/admin/portfolio/${id}`, { method: "PATCH", body: { ...body, image: replaced } })
          : adminFetch("/api/admin/portfolio", { method: "POST", body: { ...body, image: form.image } }),
      id ? "Photo saved" : "Photo added",
    );
    if (ok) setEditing(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="primary"
          onClick={() => setEditing({ id: null, originalPath: null, form: { image: null, alt: "", caption: "", categoryId: "", featured: false, active: true } })}
        >
          <Plus /> Add photo
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Images} title="No photos yet">
          Add your best sets. Use clear, well-lit photos in portrait (4:5) if you can.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <li key={item.id} className="card overflow-hidden">
              <div className="relative aspect-[4/5] bg-canvas">
                <Image src={item.imagePath} alt={item.alt} fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
                <div className="absolute top-2 left-2 flex gap-1">
                  {item.featured && (
                    <Chip tone="accent">
                      <Star className="size-3" /> Featured
                    </Chip>
                  )}
                  {!item.active && <Chip>Hidden</Chip>}
                  {isSamplePhoto(item.imagePath) && <Chip>Sample</Chip>}
                </div>
              </div>
              <div className="flex items-start justify-between gap-1 p-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.caption ?? "No caption"}</p>
                  <p className="truncate text-xs text-muted">{categoryName(item.categoryId) ?? "No category"}</p>
                </div>
                <RowActions
                  onEdit={() =>
                    setEditing({
                      id: item.id,
                      originalPath: item.imagePath,
                      form: {
                        image: { path: item.imagePath, width: item.width, height: item.height },
                        alt: item.alt,
                        caption: item.caption ?? "",
                        categoryId: item.categoryId ?? "",
                        featured: item.featured,
                        active: item.active,
                      },
                    })
                  }
                  onMove={(d) => run(() => move("/api/admin/portfolio", item.id, d))}
                  onDelete={async () => {
                    await run(() => adminFetch(`/api/admin/portfolio/${item.id}`, { method: "DELETE" }), "Photo deleted");
                  }}
                  confirmTitle="Delete this photo?"
                  confirmDescription="It's removed from the website and the file is deleted."
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <EditDialog
        open={editing !== null}
        title={editing?.id ? "Edit photo" : "Add photo"}
        busy={busy}
        canSave={Boolean(editing?.form.image && editing.form.alt.trim().length >= 3)}
        onClose={() => setEditing(null)}
        onSave={save}
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div>
              <ImageUpload
                kind="portfolio"
                value={editing.form.image?.path ?? null}
                label={editing.id ? "Replace photo" : "Upload photo"}
                onChange={(image) => patch({ image })}
              />
              {editing.originalPath && isSamplePhoto(editing.originalPath) && editing.form.image?.path === editing.originalPath && (
                <p className="mt-2 text-xs text-muted">Sample picture. Upload a real photo to replace it; the caption, category and position stay.</p>
              )}
            </div>
            <div className="space-y-3">
              <Field label="Describe the photo" hint="For screen readers and Google, e.g. “Pink chrome almond nails with gold flakes”">
                <Input value={editing.form.alt} maxLength={160} onChange={(e) => patch({ alt: e.target.value })} />
              </Field>
              <Field label="Caption (optional)" hint="Shown under the photo">
                <Input value={editing.form.caption} maxLength={80} onChange={(e) => patch({ caption: e.target.value })} />
              </Field>
              <Field label="Category">
                <NativeSelect value={editing.form.categoryId} onChange={(e) => patch({ categoryId: e.target.value })}>
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox checked={editing.form.featured} onCheckedChange={(v) => patch({ featured: v === true })} /> Featured
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={editing.form.active} onCheckedChange={(v) => patch({ active: v })} /> Visible
                </label>
              </div>
            </div>
          </div>
        )}
      </EditDialog>
    </>
  );
}

/* ---------- Instagram ---------- */

type InstagramForm = {
  url: string;
  caption: string;
  placement: AdminInstagramPost["placement"];
  thumbnailPath: string | null;
  videoPath: string | null;
  active: boolean;
};
const PLACEMENT = { hero: "Hero", portfolio: "Instagram section", reviews: "Reviews section" } as const;

export function InstagramManager({ posts }: { posts: AdminInstagramPost[] }) {
  const { run, busy } = useMutation();
  const [editing, setEditing] = useState<{ id: string | null; form: InstagramForm } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const patch = (p: Partial<InstagramForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));
  const parsed = editing ? parseInstagramUrl(editing.form.url) : null;

  async function save() {
    if (!editing) return;
    setError(null);
    const { id, form } = editing;
    const ok = await run(
      () =>
        adminFetch(id ? `/api/admin/instagram/${id}` : "/api/admin/instagram", { method: id ? "PATCH" : "POST", body: form }).catch((e) => {
          setError(e.message);
          throw e;
        }),
      id ? "Post saved" : "Post added",
    );
    if (ok) setEditing(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            setError(null);
            setEditing({ id: null, form: { url: "", caption: "", placement: "portfolio", thumbnailPath: null, videoPath: null, active: true } });
          }}
        >
          <Plus /> Add reel or post
        </Button>
      </div>
      {posts.length === 0 ? (
        <EmptyState icon={Video} title="No Instagram posts yet">
          In Instagram, tap ••• → Copy link on a reel, then paste it here.
        </EmptyState>
      ) : (
        <div className="card divide-y divide-line">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="relative aspect-[9/16] w-11 shrink-0 overflow-hidden rounded-md bg-canvas">
                {p.thumbnailPath ? (
                  <Image src={p.thumbnailPath} alt="" fill sizes="44px" className="object-cover" />
                ) : (
                  p.videoPath && <video src={`${p.videoPath}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.caption ?? (p.kind === "reel" ? "Reel" : "Post")}</p>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-muted hover:underline">
                  {p.url}
                </a>
              </div>
              <Chip>{PLACEMENT[p.placement]}</Chip>
              {p.videoPath && <Chip>Clip</Chip>}
              {!p.active && <Chip>Hidden</Chip>}
              <RowActions
                onEdit={() => {
                  setError(null);
                  setEditing({ id: p.id, form: { url: p.url, caption: p.caption ?? "", placement: p.placement, thumbnailPath: p.thumbnailPath, videoPath: p.videoPath, active: p.active } });
                }}
                onMove={(d) => run(() => move("/api/admin/instagram", p.id, d))}
                onDelete={async () => {
                  await run(() => adminFetch(`/api/admin/instagram/${p.id}`, { method: "DELETE" }), "Post removed");
                }}
                confirmTitle="Remove this post from the website?"
                confirmDescription="It stays on Instagram; it's only removed here."
                deleteLabel="Remove"
              />
            </div>
          ))}
        </div>
      )}

      <EditDialog
        open={editing !== null}
        title={editing?.id ? "Edit post" : "Add reel or post"}
        busy={busy}
        canSave={parsed !== null}
        onClose={() => setEditing(null)}
        onSave={save}
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
            <ImageUpload kind="instagram" aspect="aspect-[9/16]" label="Thumbnail (optional)" value={editing.form.thumbnailPath} onChange={(img) => patch({ thumbnailPath: img?.path ?? null })} />
            <div className="space-y-3">
              <Field
                label="Instagram link"
                error={error ?? (editing.form.url && !parsed ? "Paste a link to a post or reel (instagram.com/p/… or /reel/…)" : undefined)}
                hint={parsed ? `Looks good: ${parsed.kind}` : "In Instagram: ••• → Copy link"}
              >
                <Input value={editing.form.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://www.instagram.com/reel/…" />
              </Field>
              <Field
                label="Clip (optional)"
                hint="An MP4 up to 30 MB, e.g. the reel saved from Instagram. It plays silently when someone hovers over the card on a computer."
              >
                <VideoUpload value={editing.form.videoPath} onChange={(videoPath) => patch({ videoPath })} />
              </Field>
              <Field label="Caption (optional)">
                <Input value={editing.form.caption} maxLength={120} onChange={(e) => patch({ caption: e.target.value })} />
              </Field>
              <Field label="Show in">
                <NativeSelect value={editing.form.placement} onChange={(e) => patch({ placement: e.target.value as InstagramForm["placement"] })}>
                  <option value="portfolio">Instagram section</option>
                  <option value="reviews">Reviews section</option>
                  <option value="hero">Hero</option>
                </NativeSelect>
              </Field>
              <label className="flex items-center gap-2">
                <Switch checked={editing.form.active} onCheckedChange={(v) => patch({ active: v })} /> Visible
              </label>
            </div>
          </div>
        )}
      </EditDialog>
    </>
  );
}

/* ---------- Testimonials ---------- */

type TestimonialForm = Omit<AdminTestimonial, "id" | "serviceLabel"> & { serviceLabel: string };

export function TestimonialsManager({ items }: { items: AdminTestimonial[] }) {
  const { run, busy } = useMutation();
  const [editing, setEditing] = useState<{ id: string | null; form: TestimonialForm } | null>(null);
  const patch = (p: Partial<TestimonialForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));

  async function save() {
    if (!editing) return;
    const { id, form } = editing;
    const ok = await run(
      () => adminFetch(id ? `/api/admin/testimonials/${id}` : "/api/admin/testimonials", { method: id ? "PATCH" : "POST", body: form }),
      id ? "Review saved" : "Review added",
    );
    if (ok) setEditing(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setEditing({ id: null, form: { name: "", quote: "", rating: 5, serviceLabel: "", visible: true } })}>
          <Plus /> Add review
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={MessageSquareQuote} title="No reviews yet">
          Add real reviews from customers (with their permission).
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <li key={t.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <Rating value={t.rating} size={14} />
                <div className="flex items-center gap-1">
                  {!t.visible && <Chip>Hidden</Chip>}
                  <RowActions
                    onEdit={() => setEditing({ id: t.id, form: { name: t.name, quote: t.quote, rating: t.rating, serviceLabel: t.serviceLabel ?? "", visible: t.visible } })}
                    onMove={(d) => run(() => move("/api/admin/testimonials", t.id, d))}
                    onDelete={async () => {
                      await run(() => adminFetch(`/api/admin/testimonials/${t.id}`, { method: "DELETE" }), "Review deleted");
                    }}
                    confirmTitle="Delete this review?"
                  />
                </div>
              </div>
              <p className="mt-2 flex-1">&ldquo;{t.quote}&rdquo;</p>
              <p className="mt-3 text-xs text-muted">
                <span className="font-medium text-ink">{t.name}</span>
                {t.serviceLabel && ` · ${t.serviceLabel}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <EditDialog
        open={editing !== null}
        title={editing?.id ? "Edit review" : "Add review"}
        busy={busy}
        canSave={Boolean(editing && editing.form.name.trim().length >= 2 && editing.form.quote.trim().length >= 5)}
        onClose={() => setEditing(null)}
        onSave={save}
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer name" hint="First name and initial is fine">
                <Input value={editing.form.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} placeholder="Aditi S." />
              </Field>
              <Field label="Service (optional)">
                <Input value={editing.form.serviceLabel} maxLength={60} onChange={(e) => patch({ serviceLabel: e.target.value })} placeholder="Gel extensions" />
              </Field>
            </div>
            <Field label="Review">
              <Textarea rows={4} value={editing.form.quote} maxLength={500} onChange={(e) => patch({ quote: e.target.value })} />
            </Field>
            <div className="flex flex-wrap items-center gap-4">
              <Field label="Stars">
                <NativeSelect value={editing.form.rating} onChange={(e) => patch({ rating: Number(e.target.value) })} className="w-24">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <label className="mt-4 flex items-center gap-2">
                <Switch checked={editing.form.visible} onCheckedChange={(v) => patch({ visible: v })} /> Visible
              </label>
            </div>
          </div>
        )}
      </EditDialog>
    </>
  );
}

/** Seeded sample artwork (db/seed.sql), not an upload: shown with a "Sample" label until replaced. */
function isSamplePhoto(path: string): boolean {
  return path.startsWith("/placeholders/");
}
