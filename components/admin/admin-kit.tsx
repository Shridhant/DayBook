"use client";

import { ArrowDown, ArrowUp, ImagePlus, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatInstantTime, toIst } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Small client helpers shared by the admin management screens. */

export class AdminFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export async function adminFetch<T = unknown>(url: string, init: { method: string; body?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new AdminFetchError(0, "network", "You seem to be offline. Check your connection and try again.");
  }
  const data = (await response.json().catch(() => null)) as (T & { error?: string; message?: string; field?: string }) | null;
  if (!response.ok) {
    throw new AdminFetchError(response.status, data?.error ?? "error", data?.message ?? "Something went wrong.", data?.field);
  }
  return data as T;
}

/** Runs a mutation with toasts and a server refresh. Returns true on success. */
export function useMutation() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  /** `success` may depend on the result; return null to skip the toast (e.g. a clash preview). */
  async function run<T>(task: () => Promise<T>, success?: string | ((result: T) => string | null)): Promise<boolean> {
    setBusy(true);
    try {
      const result = await task();
      const message = typeof success === "function" ? success(result) : success;
      if (message) toast({ title: message, tone: "success" });
      router.refresh();
      return true;
    } catch (error) {
      toast({ title: "Couldn't save", description: error instanceof Error ? error.message : undefined, tone: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}

/* ---------- Image upload ---------- */

export type UploadedImage = { path: string; width: number; height: number };

export function ImageUpload({
  kind,
  value,
  onChange,
  aspect = "aspect-[4/5]",
  label = "Upload photo",
  compact = false,
  className,
}: {
  kind: "portfolio" | "staff" | "instagram" | "testimonials" | "services";
  value: string | null;
  onChange: (image: UploadedImage | null) => void;
  aspect?: string;
  label?: string;
  /** Small square thumbnail for lists: tap to add or replace, × to remove, no Replace button. */
  compact?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as (UploadedImage & { message?: string }) | null;
      if (!response.ok || !data?.path) throw new Error(data?.message ?? "Upload failed.");
      onChange({ path: data.path, width: data.width, height: data.height });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
    />
  );

  if (compact) {
    return (
      <div className={cn("relative size-12 shrink-0", className)}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          title={error ?? (value ? "Replace photo" : label)}
          aria-label={value ? "Replace photo" : label}
          className={cn(
            "relative grid size-full place-items-center overflow-hidden rounded-lg border border-dashed bg-canvas text-muted outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-accent/25",
            error ? "border-danger" : "border-line",
          )}
        >
          {busy ? <Spinner size={16} /> : value ? <Image src={value} alt="" fill sizes="48px" className="object-cover" /> : <ImagePlus aria-hidden className="size-4" />}
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove photo"
            className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm hover:text-ink"
          >
            <X className="size-3" />
          </button>
        )}
        {fileInput}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={cn("relative overflow-hidden rounded-xl border border-dashed border-line bg-canvas", aspect)}>
        {value ? (
          <>
            <Image src={value} alt="" fill sizes="240px" className="object-cover" />
            <Button variant="secondary" size="icon" className="absolute top-2 right-2" onClick={() => onChange(null)} aria-label="Remove image">
              <X />
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-accent/25"
          >
            {busy ? <Spinner size={20} /> : <ImagePlus aria-hidden className="size-5" />}
            <span className="text-xs">{busy ? "Uploading…" : label}</span>
          </button>
        )}
      </div>
      {value && (
        <Button size="sm" variant="ghost" className="mt-1.5" onClick={() => input.current?.click()} loading={busy}>
          Replace
        </Button>
      )}
      {fileInput}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ---------- Clash confirmation ---------- */

export type Clash = { id: string; code: string; customer: string; startsAt: string; endsAt: string };

/** Shows bookings a change would affect, and lets the user save anyway. */
export function ClashDialog({
  clashes,
  title,
  description,
  onCancel,
  onConfirm,
  busy,
}: {
  clashes: Clash[] | null;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Dialog open={clashes !== null} onOpenChange={(o) => !o && !busy && onCancel()}>
      {clashes && (
        <DialogContent
          size="sm"
          title={title}
          description={description}
          footer={
            <>
              <Button size="md" onClick={onCancel} disabled={busy}>
                Go back
              </Button>
              <Button size="md" variant="primary" onClick={onConfirm} loading={busy}>
                Save anyway
              </Button>
            </>
          }
        >
          <Alert size="app" tone="warning">
            These bookings stay as they are. Contact the customers to move them.
          </Alert>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {clashes.map((c) => {
              const start = new Date(c.startsAt);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-medium">{c.customer}</span>
                  <span className="text-muted tabular-nums">
                    {formatDate(toIst(start).date)}, {formatInstantTime(start)}
                  </span>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      )}
    </Dialog>
  );
}

/* ---------- Row actions (reorder / edit / delete) ---------- */

export function RowActions({
  onEdit,
  onMove,
  onDelete,
  deleteLabel = "Delete",
  confirmTitle,
  confirmDescription,
  extra,
}: {
  onEdit?: () => void;
  onMove?: (direction: "up" | "down") => void;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  extra?: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          {onEdit && (
            <MenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </MenuItem>
          )}
          {onMove && (
            <>
              <MenuItem onSelect={() => onMove("up")}>
                <ArrowUp /> Move up
              </MenuItem>
              <MenuItem onSelect={() => onMove("down")}>
                <ArrowDown /> Move down
              </MenuItem>
            </>
          )}
          {extra}
          {onDelete && (
            <>
              <MenuSeparator />
              <MenuItem tone="danger" onSelect={() => setConfirm(true)}>
                <Trash2 /> {deleteLabel}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
      {onDelete && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          tone="danger"
          title={confirmTitle ?? "Delete this?"}
          description={confirmDescription ?? "This can't be undone."}
          confirmLabel={deleteLabel}
          onConfirm={onDelete}
        />
      )}
    </>
  );
}
