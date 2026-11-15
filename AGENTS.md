<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Daybook

Instructions for AI coding agents (and humans) working in this repository. Read this file fully before making changes.

> **Visual design lives in [`DESIGN.md`](./DESIGN.md).** It is the source of truth for colours, typography, spacing, components and tone. Do not invent visual styles that contradict it. If `DESIGN.md` is missing or silent on something, keep it minimal and ask rather than guess.

---

## 1. What this project is

**Daybook** is the website and booking system for a nail salon in Delhi NCR.

It has three surfaces:

| Surface | Who | Purpose |
|---|---|---|
| **Public site** (`/`) | Customers | Portfolio-led landing page: services and prices, gallery, Instagram reels, testimonials, team, location. Must look great and load fast on **phones first**, then laptops. |
| **Booking flow** (`/book`) | Customers (no login) | Pick services → pick technician (optional, "Any available" by default) → date and slot → details → pay the booking amount through Razorpay → confirmation. |
| **Admin** (`/admin`) | Owner, receptionist | Day calendar per technician, bookings, walk-ins, staff/skills/shifts/leave, services and prices, booking-amount settings, portfolio, Instagram links, testimonials, closures. |
| **Staff portal** (`/staff`, phase 2) | Technicians | Their own schedule, mark started/completed/no-show, request leave. |

Scale: one salon, **10–12 technicians**, a few hundred bookings a month. Customers never log in.

---

## 2. Tech stack (decided — do not swap without asking)

| Concern | Choice |
|---|---|
| Framework | **Next.js (App Router), TypeScript `strict`** |
| UI | React + **Tailwind CSS v4** + **`motion`** (`motion/react`), per `DESIGN.md`. Radix primitives for menus/popovers/dialogs, `lucide-react` icons. |
| Components | **Our own library in `components/ui/`** (shadcn-style: we own the source, variants via `cva`, `cn()` = `clsx` + `tailwind-merge`). **Do not install shadcn/ui** or other component kits. Use Radix primitives only for behaviour-heavy parts (dialog, sheet, menu, popover, select, tooltip). Animations use `motion`, never `tw-animate-css`. |
| Fonts | **Geist** (sans) + **JetBrains Mono** (codes/IDs only), loaded with `next/font` — not `<link>` tags |
| Database | **PostgreSQL** (self-hosted on a Hostinger KVM VPS, India). Own database + own DB user for this app. |
| DB access | **`postgres` (postgres.js)**, raw SQL via tagged templates. **No ORM** (no Prisma, Drizzle, TypeORM). |
| Migrations | **dbmate**, plain `.sql` files in `db/migrations/` |
| Auth | **Better Auth** (database sessions in our Postgres, httpOnly cookies). **No hand-rolled JWT/refresh tokens.** |
| Payments | **Razorpay** (Orders API + Checkout + Webhooks) |
| Validation | **zod** at every trust boundary (request bodies, form input, env vars) |
| Tests | **Vitest** for domain logic; Playwright for the booking flow later |
| Hosting | Same VPS as Postgres: Next.js (PM2 or Docker) behind **Caddy**; Cloudflare in front later |
| Package manager | **npm** |

Do not add dependencies casually. Prefer the platform and a few lines of code over a new package. Any new runtime dependency needs a one-line justification in the PR description.

---

## 3. Commands

> Fill these in as they are created. Keep this list accurate.

```bash
npm run dev            # start Next.js dev server
npm run build          # production build
npm run start          # run production build
npm run lint           # eslint
npm run typecheck      # next typegen && tsc --noEmit (route types like LayoutProps are generated)
npm test               # vitest
npm run db:migrate     # dbmate up
npm run db:new -- name # dbmate new <name>
npm run db:seed        # load db/seed.sql (dev only)
```

Before you call a task done, run **typecheck, lint and tests**, and report the result honestly.

---

## 4. Directory layout

```
app/
  (site)/              public pages: page.tsx, services/, team/, portfolio/
  book/                booking flow (client components inside)
  admin/               owner/receptionist area (auth-guarded)
  staff/               technician portal (phase 2)
  api/
    bookings/          availability + create hold
    payments/order/    create Razorpay order for a held booking
    payments/verify/   verify checkout signature (UX only, not final)
    webhooks/razorpay/ source of truth for payment state
    auth/[...all]/     Better Auth handler
components/ui/         design-system components (see /kit in dev for every component)
components/            other shared UI (no data fetching, no secrets)
server/                domain logic, server-only (availability, pricing, bookings, payments)
lib/                   small utilities: db.ts, env.ts, time.ts (IST), money.ts, razorpay.ts, auth.ts
db/
  migrations/          dbmate SQL migrations (append-only)
  seed.sql             dev seed data
tests/                 vitest tests mirroring server/
public/                static assets
```

Every file in `server/` and `lib/db.ts`, `lib/razorpay.ts`, `lib/auth.ts` must start with `import 'server-only';`.

---

## 5. Next.js rules (keep to this subset)

- **Server components by default.** Public pages fetch from Postgres directly in server components so HTML is fully rendered (SEO + WhatsApp/Instagram link previews).
- **`'use client'` only for interactivity**: booking flow, gallery lightbox, menus, admin forms. Never import `server/`, `lib/db.ts` or secrets into a client component.
- **API = route handlers** (`app/api/**/route.ts`). Client code calls them with `fetch`. Do **not** use Server Actions for now.
- **Every page sets `metadata`** (title, description, Open Graph image). Public pages need good link previews.
- **Next.js 16 with Cache Components is on** (`cacheComponents: true`). Read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` before writing data-fetching code. Our rules:
  - **Public content that changes only when the owner edits it** (services, staff, portfolio, Instagram posts, testimonials, settings): read through `'use cache'` functions in `server/` with `cacheLife(...)` + `cacheTag(...)`, and invalidate the tag from the admin route handler after a write.
  - **Anything that must be fresh** (availability, bookings, admin and staff data, anything per-user or per-session): never cached; render it inside `<Suspense>` with a skeleton fallback.
  - No parallel/intercepting routes or experimental flags unless asked.
- **`middleware.ts` is now `proxy.ts`** in Next 16. Use it only for optimistic redirects (e.g. no session cookie → `/admin/login`), never as the auth check.
- Use `next/image` for all raster images, with explicit sizes.
- **Hydration**: never render `Date.now()`, `new Date()` or random values in server-rendered markup that the client will re-render. Time-dependent UI (today's slots) is computed on the client or passed from the server as data.
- Environment variables: only `NEXT_PUBLIC_*` reaches the browser. **Secrets (`RAZORPAY_KEY_SECRET`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) must never have that prefix.** Parse all env vars once with zod in `lib/env.ts`.

---

## 6. Database rules

- **Raw SQL with postgres.js tagged templates.** Values go in `${}` so they are sent as parameters. **Never build SQL by string concatenation.** Use `sql(identifier)` / `sql.unsafe` only with hard-coded identifiers, never user input.
- **Single shared pool** in `lib/db.ts`, cached on `globalThis` in development to survive hot reloads.
- **Migrations are append-only.** Never edit a migration that has been applied anywhere; add a new one. Every migration has a `-- migrate:down` section.
- **Never change the live schema by hand.**
- Write row types by hand in `server/types.ts` (or next to the query). Keep them in sync with migrations.
- Multi-step writes (create booking + items, payment state changes) run in `sql.begin(...)` transactions.
- Naming: `snake_case` tables and columns, plural table names, `id uuid primary key default gen_random_uuid()`, `created_at` / `updated_at timestamptz not null default now()`.

### Core tables (summary — migrations are authoritative)

```
settings          booking_amount_type (fixed|percent), booking_amount_value, cancel_window_hours,
                  slot_interval_min, booking_window_days, lead_time_min, hold_minutes
services          id, name, category, description, price_paise, duration_min,
                  booking_amount_override_paise?, active, sort_order
staff             id, name, photo_path, bio, specialties, active, sort_order
staff_services    staff_id, service_id, price_override_paise? (NULL in phase 1; for seniority pricing later)
staff_shifts      staff_id, weekday (0=Sun), start_time, end_time
staff_leave       staff_id, start_at, end_at, reason, status (requested|approved|rejected)
salon_closures    date, reason
customers         id, name, phone (unique, normalised 10-digit Indian), email?
bookings          id, code (short human ref), customer_id, staff_id, start_at, end_at,
                  status, source (online|walk_in|phone), total_paise, amount_due_now_paise,
                  hold_expires_at?, notes, cancelled_at?, cancel_reason?
booking_items     booking_id, service_id, name_snapshot, price_snapshot_paise, duration_snapshot_min
payments          id, booking_id, rzp_order_id (unique), rzp_payment_id (unique, nullable),
                  amount_paise, status, refund_id?, raw jsonb
portfolio_items   id, image_path, category, caption, featured, sort_order
instagram_posts   id, url, kind (reel|post), thumbnail_path?, placement (hero|portfolio|reviews), sort_order
testimonials      id, name, quote, rating, media_url?, visible, sort_order
users / sessions  managed by Better Auth; app role on user: owner | receptionist | staff (+ staff_id link)
```

---

## 7. Domain rules (the important part — get these right)

### Money
- **All amounts are integer paise** (`₹500` = `50000`). Never use floats for money. Column suffix `_paise`.
- Format only at the edge, with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- **The server always computes prices and amounts from the database.** Never trust an amount, price or duration sent by the client.

### Time
- Store instants as `timestamptz` (UTC). The salon operates in **`Asia/Kolkata` (IST)**. All business logic (opening hours, "today", slot generation, shifts) is done in IST via helpers in `lib/time.ts`.
- The VPS clock and the user's browser may not be in IST. Never rely on the process's local timezone.

### Booking amount
- Owner sets either a **fixed amount** or a **percentage** of the total in `settings`; a service may have `booking_amount_override_paise`. For multi-service bookings, use the largest applicable override, or the settings rule if none applies. Never exceed the total.
- **Percentage amounts round to the nearest ₹10** (half up: ₹246.80 → ₹250, ₹245 → ₹250, ₹244.99 → ₹240), so customers pay friendly UPI amounts. Fixed amounts and overrides are used as set. A positive amount never rounds down to ₹0 (it becomes ₹10). If rounding up would exceed the total, charge the total. Implemented in `server/pricing.ts`. *(Decided by the owner, 2026-11-15.)*
- The computed amount is **snapshotted** on the booking (`amount_due_now_paise`). Changing settings never alters existing bookings.

### Availability
- A slot is offered only if **at least one technician** (or the chosen one) is:
  1. qualified for **all** selected services (`staff_services`),
  2. on shift for the whole interval `[start, start + total duration)`,
  3. not on approved leave, the salon is not closed that day,
  4. not overlapping any booking with status `confirmed`, or `pending` with `hold_expires_at > now()`.
- Respect `lead_time_min` (no slots starting too soon) and `booking_window_days`.
- **One technician per booking** in phase 1 (multi-service = back-to-back with the same person).
- "Any available" assignment: the qualified, free technician with the fewest booked minutes that day; tie-break by `sort_order`.
- Availability logic lives in `server/availability.ts`, is a **pure function over loaded data** where possible, and **must have thorough Vitest coverage** (shift edges, closing time, leave, holds, today's lead time, IST midnight).

### Double-booking protection
- Enforced by the **database**, not just the app: `btree_gist` + an `EXCLUDE USING gist (staff_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)` constraint on active bookings.
- Expired holds are flipped to `expired` inside the same transaction before inserting a new hold. Treat a constraint violation as "slot just taken" and return a friendly 409.

### Booking status lifecycle
```
pending (hold, ~15 min) ──payment captured──► confirmed ──► completed | no_show
   │                                              │
   └──hold expires──► expired                     └──► cancelled (refund per cancel window)
```
Walk-in/phone bookings created by admin start as `confirmed` with no payment.

### Payments (Razorpay)
1. Client asks server to hold a slot → server validates everything, creates a `pending` booking + Razorpay **order** for `amount_due_now_paise`, stores a `payments` row.
2. Client opens Razorpay Checkout with the `order_id`.
3. `/api/payments/verify` checks the checkout signature (`HMAC_SHA256(order_id|payment_id, key_secret)`, constant-time compare) to show the confirmation screen quickly.
4. **`/api/webhooks/razorpay` is the source of truth.** Verify `X-Razorpay-Signature` against the **raw request body** with the webhook secret. On `payment.captured` / `order.paid`, mark payment captured and booking `confirmed`.
5. **Idempotent everywhere**: webhooks retry and can arrive before or after `verify`. Use unique constraints on `rzp_order_id` / `rzp_payment_id` and conditional updates (`where status = 'pending'`).
6. A payment captured for an expired hold must not silently vanish: if the slot is still free, confirm it; otherwise flag it for owner review/refund.
7. Never log full payment payloads containing customer PII to stdout in production.

### Customers
- Phone is the identity. Normalise to 10 digits (strip `+91`, `91`, leading `0`), must match `^[6-9]\d{9}$`.

---

## 8. Auth and permissions

- Better Auth with database sessions. **No public sign-up.** Owner creates receptionist and staff accounts.
- Roles: `owner` (everything), `receptionist` (bookings, calendar, walk-ins; no settings, no refunds), `staff` (own bookings only).
- **Every admin/staff route handler checks the session and role on the server.** `proxy.ts` (formerly middleware) is only a convenience redirect, not the security boundary.
- Staff queries are always scoped `where staff_id = <session staff_id>`. Customer phone numbers are hidden from staff unless a setting allows it.
- Only `owner` can refund, change prices, change booking-amount settings, or manage users.
- Rate-limit login and any OTP endpoints. Firing a staff member = deactivate the user and delete their sessions.

---

## 9. Security checklist (apply to every change)

- zod-validate every request body and query param.
- Parameterised SQL only.
- No secrets in client bundles, logs, or git. `.env*.local` is gitignored; `.env.example` lists every variable with no values.
- Uploaded images: check MIME type and size, re-encode/resize server-side, random filenames, never trust the original name.
- Instagram embeds: accept only `https://www.instagram.com/(p|reel)/<id>/` URLs; validate before storing.
- Return generic error messages to clients; log details server-side.
- Add CAPTCHA (Cloudflare Turnstile) to the public booking hold endpoint if spam appears.

---

## 10. UI and UX rules

- **Follow `DESIGN.md`.** It was written for a dense dashboard (originally a Vite app): ignore its `index.html` / `#root` / `src/...` references and apply it through Next.js (`app/globals.css`, `next/font`, `lib/motion.ts`). Use `useReducedMotion()` in every animated component.
- Mobile-first: design at 360–390px width, then scale up. No horizontal scroll on any page.
- Tap targets ≥ 44px. Forms use correct `inputmode`/`autocomplete` (`tel`, `email`, `name`).
- Prices always shown in INR (`₹1,200`), durations as `1h 30m`, dates as `Sat, 15 Nov`, times in 12-hour IST (`4:30 pm`).
- Instagram embeds load **lazily behind a thumbnail facade** (load the real embed only on tap) so the landing page stays fast on 4G.
- Every async action has loading, success and error states. Payment failures must tell the user clearly whether they were charged.
- **Reuse `components/ui/` before writing new UI.** New shared components go there and get an example on the dev-only `/kit` page (`app/kit/`).
- Dark mode toggles the `dark` class on `<html>` (never on a wrapper div), so portalled overlays inherit it.
- Grid/flex children that contain horizontal scrollers need `min-w-0`, or they push the page wider than the phone.
- Accessibility: semantic HTML, labelled inputs, visible focus states, alt text on portfolio images, sufficient contrast.

---

## 11. Code style

- TypeScript `strict`; no `any` (use `unknown` + zod). No non-null assertions to silence errors.
- Small, named functions. Domain logic in `server/`, not inside route handlers or components. Route handlers are thin: parse → authorise → call domain → respond.
- Named exports, except where Next.js requires default exports (pages, layouts).
- Comments explain **why**, not what.
- No dead code, no commented-out code, no `console.log` left behind (use a small logger in `lib/`).

---

## 12. Testing

- Vitest unit tests are **required** for: availability, booking-amount calculation, pricing, phone normalisation, IST time helpers, Razorpay signature verification, booking status transitions.
- Tests that need Postgres use a separate test database (`DATABASE_URL_TEST`), never the dev or prod one.
- Fix the code, not the test, unless the test is wrong, and say so.

---

## 13. Working agreement for agents

- **Read before writing.** Check existing code and this file before adding anything new.
- Stay inside the requested task and phase. If you notice something else worth doing, mention it; don't do it.
- Never run destructive commands against a real database (drop, truncate, mass delete), never touch production, and never commit secrets.
- Do not commit or push unless asked.
- When unsure about a business rule (pricing, refunds, cancellations, staff permissions), **ask** rather than invent one.
- At the end of a task, report: what changed, how you verified it (commands + results), and anything left undone.

---

## 14. Phases

- **Phase 0 — Setup:** repo, tooling, env, database, migrations.
- **Phase 1 — Launch:** public site, booking + Razorpay, owner admin, notifications, deploy.
- **Phase 2 — Staff and operations:** staff login/portal, leave requests, refunds, customer self-cancel link, reminders.
- **Phase 3 — Growth:** seniority pricing, reports, multi-technician simultaneous bookings.

Build only what belongs to the current phase.
