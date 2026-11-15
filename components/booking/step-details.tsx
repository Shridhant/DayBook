"use client";

import { Field, Input, Textarea } from "@/components/ui/input";
import { StepHeading } from "./step-heading";

export type Details = { name: string; phone: string; email: string; notes: string };
export type DetailErrors = Partial<Record<keyof Details, string>>;

export function DetailsStep({
  details,
  errors,
  onChange,
}: {
  details: Details;
  errors: DetailErrors;
  onChange: (patch: Partial<Details>) => void;
}) {
  return (
    <section aria-labelledby="step-details">
      <StepHeading id="step-details" title="Your details" hint="We'll send your confirmation here. No account needed." />
      <div className="mt-6 max-w-xl space-y-4">
        <Field label="Your name" size="public" required error={errors.name}>
          <Input
            autoComplete="name"
            autoCapitalize="words"
            value={details.name}
            maxLength={60}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field label="Mobile number" size="public" required error={errors.phone} hint="For booking updates on WhatsApp or SMS">
          <Input
            prefix="+91"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={details.phone}
            maxLength={16}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </Field>
        <Field label="Email" size="public" error={errors.email} hint="Optional, for an email receipt">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={details.email}
            maxLength={254}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
        <Field label="Anything we should know?" size="public" error={errors.notes} hint="Optional: design ideas, length, allergies">
          <Textarea value={details.notes} maxLength={500} onChange={(e) => onChange({ notes: e.target.value })} />
        </Field>
      </div>
    </section>
  );
}
