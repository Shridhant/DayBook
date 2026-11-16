import type { Metadata } from "next";
import { businessName, ContactLines, LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What personal details we collect when you book, why, and how we keep them safe.",
};

export default function PrivacyPage() {
  const name = businessName();
  return (
    <LegalPage
      title="Privacy policy"
      updated="16 November 2026"
      intro={<p>{name} runs this website. This policy explains what we collect when you book, why, and what you can ask us to do with it.</p>}
    >
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>When you book:</strong> your name, mobile number, email (optional), any notes you add, and your appointment details
          (services, artist, date and time).
        </li>
        <li>
          <strong>When you pay:</strong> Razorpay handles the payment. We receive only what we need to match it to your booking: the payment
          reference, amount, status and method type (for example &quot;card&quot; or &quot;UPI&quot;). We never see or store your card
          number, UPI PIN or bank login.
        </li>
        <li>
          <strong>To prevent abuse:</strong> your IP address, used only to limit repeated booking attempts and kept for up to a day.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>
          To manage your appointment and, if you gave an email, send your confirmation, a reminder about a day before, and updates
          when you change or cancel it.
        </li>
        <li>To contact you about your booking (for example, if we need to reschedule).</li>
        <li>To process payments and refunds, and keep the records the law requires.</li>
        <li>To protect the booking system from spam and misuse.</li>
      </ul>
      <p>We don&apos;t sell your details, and we don&apos;t use them for advertising.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li><strong>Razorpay</strong>, our payment partner, to process payments and refunds.</li>
        <li><strong>Our email provider</strong>, to send your booking emails (confirmation, reminder, changes and refunds).</li>
        <li><strong>Our hosting provider</strong>, which stores the website and its data on servers in India.</li>
      </ul>
      <p>
        Instagram videos and the Google map on our site load from Instagram and Google only when you tap a video or scroll to the map. Their
        own privacy policies apply to those services.
      </p>

      <h2>Cookies</h2>
      <p>
        Customers don&apos;t need an account, and we don&apos;t use advertising or tracking cookies. The only cookie we set keeps our staff
        signed in to the admin area.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep booking records for as long as we need them to run the studio and meet our legal and tax obligations. Abuse-prevention data is
        deleted within a day.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us to show you the details we hold about you, correct them, or delete anything we&apos;re not legally required to keep.
        Contact us:
      </p>
      <ContactLines />

      <h2>Keeping it safe</h2>
      <p>
        The site is served over HTTPS. Only our staff can see booking details, through individual password-protected accounts, and passwords
        are stored securely hashed.
      </p>
    </LegalPage>
  );
}
