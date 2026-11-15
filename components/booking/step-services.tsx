"use client";

import { OptionCard } from "@/components/ui/choice";
import { Eyebrow } from "@/components/ui/page-section";
import { formatINR } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import type { Catalog } from "@/server/catalog";
import { StepHeading } from "./step-heading";

export function ServicesStep({
  catalog,
  selected,
  onToggle,
}: {
  catalog: Catalog;
  selected: string[];
  onToggle: (serviceId: string) => void;
}) {
  return (
    <section aria-labelledby="step-services">
      <StepHeading id="step-services" title="What would you like?" hint="Pick one or more. Your artist does them back to back." />
      <div className="mt-6 space-y-8">
        {catalog.categories.map((category) => {
          const services = catalog.services.filter((s) => s.categoryId === category.id);
          return (
            <div key={category.id}>
              <Eyebrow>{category.name}</Eyebrow>
              <div className="mt-3 space-y-2">
                {services.map((s) => (
                  <OptionCard key={s.id} selected={selected.includes(s.id)} onClick={() => onToggle(s.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-medium">{s.name}</p>
                      {s.description && <p className="mt-0.5 text-[14px] text-muted">{s.description}</p>}
                      <p className="mt-1 text-[14px] text-muted">{formatDuration(s.durationMin)}</p>
                    </div>
                    <span className="shrink-0 text-right font-semibold tabular-nums">
                      {s.priceIsFrom && <span className="block text-[12px] font-normal text-muted">from</span>}
                      {formatINR(s.pricePaise)}
                    </span>
                  </OptionCard>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
