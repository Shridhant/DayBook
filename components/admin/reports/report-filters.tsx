"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PRESET_LABEL, REPORT_PRESETS, REPORT_SOURCES, SOURCE_LABEL, type ReportPreset } from "@/lib/reports";

export type ReportFilterValues = {
  preset: ReportPreset;
  from: string;
  to: string;
  staff: string;
  category: string;
  source: string;
};

/** One row of filters above the charts (dataviz interaction rules). Every change updates the URL. */
export function ReportFilters({
  values,
  staff,
  categories,
}: {
  values: ReportFilterValues;
  staff: { id: string; name: string; active: boolean }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState({ from: values.from, to: values.to });

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

  const filtered = Boolean(values.staff || values.category || values.source);

  return (
    <div className="mb-5 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <NativeSelect
          aria-label="Period"
          value={values.preset}
          onChange={(e) => {
            const preset = e.target.value as ReportPreset;
            if (preset === "custom") go({ preset, ...custom });
            else go({ preset });
          }}
        >
          {REPORT_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Artist" value={values.staff} onChange={(e) => go({ staff: e.target.value })}>
          <option value="">All artists</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.active ? "" : " (former)"}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Service category" value={values.category} onChange={(e) => go({ category: e.target.value })}>
          <option value="">All services</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Booked via" value={values.source} onChange={(e) => go({ source: e.target.value })}>
          <option value="">Online, walk-in and phone</option>
          {REPORT_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]} only
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-2">
          {filtered && (
            <Button variant="ghost" onClick={() => go({ staff: "", category: "", source: "" })}>
              Clear filters
            </Button>
          )}
          {pending && <Spinner size={16} aria-label="Updating report" />}
        </div>
      </div>
      {values.preset === "custom" && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ preset: "custom", ...custom });
          }}
        >
          <Input type="date" aria-label="From date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="w-auto" />
          <span className="text-muted">to</span>
          <Input type="date" aria-label="To date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="w-auto" />
          <Button type="submit" size="md" disabled={!custom.from || !custom.to}>
            Apply
          </Button>
        </form>
      )}
    </div>
  );
}
