"use client";

import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { OptionCard } from "@/components/ui/choice";
import type { CatalogStaff } from "@/server/catalog";
import { StepHeading } from "./step-heading";

export function ArtistStep({
  qualified,
  staffId,
  onSelect,
}: {
  /** Artists who do every selected service. */
  qualified: CatalogStaff[];
  staffId: string | null;
  onSelect: (staffId: string | null) => void;
}) {
  return (
    <section aria-labelledby="step-artist">
      <StepHeading id="step-artist" title="Who would you like?" hint="Choose an artist, or let us find the first free one." />

      {qualified.length === 0 ? (
        <Alert tone="warning" className="mt-6" title="No single artist does all of these together">
          Try booking them as separate appointments, or remove one service.
        </Alert>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <OptionCard layout="stack" indicator="none" selected={staffId === null} onClick={() => onSelect(null)}>
            <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft">
              <Sparkles aria-hidden className="size-6 text-accent-hover" />
            </span>
            <span>
              <span className="block text-[15px] font-medium">Any available</span>
              <span className="block text-[13px] text-muted">Most time slots</span>
            </span>
          </OptionCard>
          {qualified.map((s) => (
            <OptionCard key={s.id} layout="stack" indicator="none" selected={staffId === s.id} onClick={() => onSelect(s.id)}>
              <Avatar name={s.name} src={s.photoPath} size="lg" />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium">{s.name}</span>
                {s.specialties && <span className="block text-[13px] text-muted">{s.specialties}</span>}
              </span>
            </OptionCard>
          ))}
        </div>
      )}
    </section>
  );
}
