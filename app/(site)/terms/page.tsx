import type { Metadata } from "next";
import Link from "next/link";
import { businessName, ContactLines, LegalPage } from "@/components/site/legal-page";
import { getCatalog } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that apply when you book an appointment online.",
};

export default async function TermsPage() {
  const { cancelWindowHours: hours } = await getCatalog();
  const name = businessName();
  return (
    <LegalPage
      title="Terms of service"
      updated="16 November 2026"
      intro={
        <p>
          These terms apply when you book an appointment with {name} through this website. By paying the booking amount, you agree to them.
        </p>
      }
    >
      <h2>Booking</h2>
      <ul>
        <li>Appointments are subject to availability. While you pay, we hold your chosen time for a few minutes.</li>
        <li>Your booking is confirmed once the booking amount is paid and you see the confirmation screen (or receive our confirmation).</li>
        <li>The booking amount is part of your total, not an extra charge: it&apos;s deducted from your final bill at the studio.</li>
      </ul>

      <h2>Prices</h2>
      <ul>
        <li>Prices are in Indian rupees (₹). Services marked &quot;from&quot; depend on the design, length or extras you choose.</li>
        <li>If you change or add services at the studio, your final bill changes with them. We&apos;ll always tell you before we start.</li>
      </ul>

      <h2>Your appointment</h2>
      <ul>
        <li>Please arrive on time. If you&apos;re running late, let us know; we may need to shorten or reschedule your appointment.</li>
        <li>Tell us about any allergies, skin conditions or sensitivities when booking (there&apos;s a notes field) or before we start.</li>
        <li>If you choose a specific artist and they become unavailable, we&apos;ll offer another artist or a new time.</li>
      </ul>

      <h2>Cancellations and refunds</h2>
      <p>
        You can cancel free of charge up to {hours} hours before your appointment. Full details are in our{" "}
        <Link href="/cancellation-policy">cancellation &amp; refund policy</Link>.
      </p>

      <h2>Payments</h2>
      <p>
        Online payments are processed securely by Razorpay. We never see or store your card number, UPI PIN or bank login. See our{" "}
        <Link href="/privacy">privacy policy</Link> for how we handle your details.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        We may update these terms; the version shown here when you book applies to that booking. These terms are governed by the laws of India.
      </p>

      <h2>Contact</h2>
      <ContactLines />
    </LegalPage>
  );
}
