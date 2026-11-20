"use client";

import { Download, ListFilter, X } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger, Select } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { PILL_SPRING } from "@/lib/motion";
import { PRESET_LABEL, REPORT_PRESETS, REPORT_SOURCES, SOURCE_LABEL, type ReportPreset, type ReportSource } from "@/lib/reports";
import { cn } from "@/lib/utils";

export type ReportFilterValues = {
  preset: ReportPreset;
  from: string;
  to: string;
  staff: string;
  category: string;
  source: string;
};

/** The three periods owners check most get the segmented control; the rest sit in "More". */
const QUICK: { preset: ReportPreset; label: string }[] = [
  { preset: "last_7", label: "Week" },
  { preset: "this_month", label: "Month" },
  { preset: "last_90", label: "Quarter" },
];
const MORE = REPORT_PRESETS.filter((p) => !QUICK.some((q) => q.preset === p));

/** Toolbar above the report. Every change updates the URL, so a filtered report can be shared or bookmarked. */
export function ReportFilters({
  values,
  staff,
  categories,
  exportFile,
}: {
  values: ReportFilterValues;
  staff: { id: string; name: string; active: boolean }[];
  categories: { id: string; name: string }[];
  /** CSV of the report's periods, built on the server. */
  exportFile: { name: string; csv: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState({ from: values.from, to: values.to });
  const reduce = useReducedMotion();
  const groupId = useId();

  function go(next: Partial<ReportFilterValues>) {
    const v = { ...values, ...next };
    const params = new URLSearchParams();
    params.set("range", v.preset);
    if (v.preset === "custom") {
      params.set("from", v.from);
      params.set("to", v.to);
    }
    if (v.staff) params.set("staff", v.staff);
    if (v.category) params.set("category", v.category);
    if (v.source) params.set("source", v.source);
    startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }));
  }

  function download() {
    // A BOM so Excel opens ₹ and names correctly.
    const blob = new Blob(["﻿", exportFile.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFile.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chips = [
    values.staff && { key: "staff", label: staff.find((s) => s.id === values.staff)?.name ?? "Artist" },
    values.category && { key: "category", label: categories.find((c) => c.id === values.category)?.name ?? "Category" },
    values.source && { key: "source", label: `${SOURCE_LABEL[values.source as ReportSource] ?? values.source} only` },
  ].filter(Boolean) as { key: "staff" | "category" | "source"; label: string }[];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutGroup id={groupId}>
          <div role="radiogroup" aria-label="Period" className="flex h-8 items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
            {QUICK.map((q) => {
              const on = values.preset === q.preset;
              return (
                <button
                  key={q.preset}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => go({ preset: q.preset })}
                  className={cn(
                    "relative h-full rounded-md px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                    on ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId="period-pill"
                      transition={reduce ? { duration: 0 } : PILL_SPRING}
                      className="absolute inset-0 -z-0 rounded-md bg-hover shadow-[inset_0_0_0_1px_var(--border)]"
                    />
                  )}
                  <span className="relative">{q.label}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <Select<ReportPreset | "">
          aria-label="More periods"
          placeholder="More periods"
          value={MORE.includes(values.preset) ? values.preset : ""}
          onValueChange={(preset) => {
            if (!preset) return;
            if (preset === "custom") go({ preset, ...custom });
            else go({ preset });
          }}
          options={MORE.map((p) => ({ value: p, label: PRESET_LABEL[p] }))}
          className={cn("w-auto min-w-36 text-xs", MORE.includes(values.preset) && "border-accent/40")}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button size="md" variant="secondary" className={cn(chips.length > 0 && "border-accent/40")}>
              <ListFilter aria-hidden />
              Filter
              {chips.length > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 text-white tabular-nums">{chips.length}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="space-y-2.5">
            <FilterField label="Artist">
              <Select
                value={values.staff}
                onValueChange={(staff) => go({ staff })}
                options={[{ value: "", label: "All artists" }, ...staff.map((s) => ({ value: s.id, label: s.active ? s.name : `${s.name} (former)` }))]}
              />
            </FilterField>
            <FilterField label="Services">
              <Select
                value={values.category}
                onValueChange={(category) => go({ category })}
                options={[{ value: "", label: "All services" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </FilterField>
            <FilterField label="Booked via">
              <Select
                value={values.source}
                onValueChange={(source) => go({ source })}
                options={[{ value: "", label: "All channels" }, ...REPORT_SOURCES.map((s) => ({ value: s, label: `${SOURCE_LABEL[s]} only` }))]}
              />
            </FilterField>
          </PopoverContent>
        </Popover>

        {chips.map((c) => (
          <span key={c.key} className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft pr-1 pl-2.5 text-xs font-medium text-accent-hover">
            {c.label}
            <button
              type="button"
              onClick={() => go({ [c.key]: "" })}
              aria-label={`Remove filter ${c.label}`}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-accent/15"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {pending && <Spinner size={16} aria-label="Updating report" />}

        <Button size="md" variant="primary" className="ml-auto" onClick={download}>
          <Download aria-hidden />
          Export
        </Button>
      </div>

      {values.preset === "custom" && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ preset: "custom", ...custom });
          }}
        >
          <DateField aria-label="From date" value={custom.from} onChange={(from) => setCustom((c) => ({ ...c, from }))} className="w-48" />
          <span className="text-muted">to</span>
          <DateField aria-label="To date" value={custom.to} minDate={custom.from || undefined} onChange={(to) => setCustom((c) => ({ ...c, to }))} className="w-48" />
          <Button type="submit" size="md" disabled={!custom.from || !custom.to}>
            Apply
          </Button>
        </form>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
