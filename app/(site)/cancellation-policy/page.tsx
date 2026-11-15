import type { Metadata } from "next";
import Link from "next/link";
import { businessName, ContactLines, LegalPage } from "@/components/site/legal-page";
import { getCatalog } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Cancellation & refunds",
  description: "How to cancel or reschedule an appointment, and when the amount paid online is refunded.",
};

export default async function CancellationPolicyPage() {
  const { cancelWindowHours: hours } = await getCatalog();
  return (
    <LegalPage
      title="Cancellation & refund policy"
      updated="16 November 2026"
      intro={<p>When you book online, you pay a small booking amount to confirm your slot. The rest is paid at the studio after your appointment.</p>}
    >
      <h2>Cancelling or rescheduling</h2>
      <ul>
        <li>
          <strong>More than {hours} hours before your appointment:</strong> you can cancel or reschedule free of charge. If you cancel, the
          booking amount you paid online is refunded in full.
        </li>
        <li>
          <strong>Within {hours} hours of your appointment, or if you don&apos;t turn up:</strong> the booking amount isn&apos;t refundable.
          It holds an artist&apos;s time that we can&apos;t usually fill at short notice.
        </li>
        <li>
          <strong>If we have to cancel or move your appointment</strong> (for example, an artist is unwell), we&apos;ll contact you and
          either reschedule at a time that suits you or refund the booking amount in full.
        </li>
      </ul>

      <h2>How to cancel</h2>
      <p>Contact us with your booking reference (it starts with &quot;DB-&quot; and is in your confirmation):</p>
      <ContactLines />

      <h2>Refunds</h2>
      <ul>
        <li>Refunds go back to the same card, UPI account, bank or wallet you paid with. We can&apos;t refund to a different account.</li>
        <li>
          We start the refund within 2 working days of your cancellation. Banks usually take 5–7 working days to show it in your account.
        </li>
        <li>
          If a payment failed but money left your account, it&apos;s normally returned automatically by your bank or our payment partner,
          Razorpay, within 5–7 working days. If it isn&apos;t, contact us and we&apos;ll help.
        </li>
        <li>Anything you pay at the studio after your appointment is settled in person.</li>
      </ul>

      <p>
        See also our <Link href="/terms">terms of service</Link> and <Link href="/privacy">privacy policy</Link>. This policy is provided by{" "}
        {businessName()}.
      </p>
    </LegalPage>
  );
}
