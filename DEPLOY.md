# Deploying the Daybook demo

Target: **https://daybook.cembers.in** on the existing VPS (Nginx + PM2, next to the other apps),
with the database on **Supabase** (Mumbai). Nothing here changes the other apps on the server.

| Piece | Where |
|---|---|
| App | VPS, PM2 process `daybook`, port **3100** on 127.0.0.1 only |
| Web server / HTTPS | Existing Nginx + Let's Encrypt (certbot) |
| Database | Supabase Postgres: one `DATABASE_URL`, the same on your laptop and the server |
| Photos | VPS disk, `/home/ubuntu/daybook-data/uploads` |
| Emails + reminders | Resend (SMTP), sent by a crontab job every minute |

Secrets live only in `.env.local` (laptop) and `.env.production.local` (server). Both are gitignored.

---

## 1. Database (Supabase): done once, from your laptop

1. Supabase → **Project Settings → Data API**: turn it off. Daybook talks to Postgres directly;
   leaving it on would let anyone with the project's public key read the tables.
2. Supabase → **Connect → Connection string** (Direct connection). In `.env.local`:
   ```bash
   DATABASE_URL=postgresql://postgres:<database password>@db.<project>.supabase.co:5432/postgres?sslmode=require
   ```
   - Remove the `[ ]` around the password. Write `@` in the password as `%40` (`:` → `%3A`, `/` → `%2F`, `#` → `%23`).
   - Forgot the password? Project Settings → Database → **Reset database password**.
   - A few wrong passwords get your IP blocked: unblock it under Database → **Network Bans**.
3. Set it up:
   ```bash
   psql "$DATABASE_URL" -f db/supabase-setup.sql   # or paste the file into Supabase's SQL Editor
   npm run db:migrate                              # create the tables
   npm run db:seed -- --yes                        # services, artists, shifts (wipes those first)
   npm run db:demo                                 # sample bookings around today (re-run before a pitch)
   npm run admin:create-user -- --role owner --name "Your Name" --email you@cembers.in
   ```
   The last command creates **your admin login** (the email + password you sign in with at
   `/admin/login`). It asks for the password twice, hidden.

✅ Already done for project `tphupoyulxbuqbucmqor`, except your admin login.

## 2. Email (Resend)

1. resend.com → **API Keys** → create one (shown once, starts with `re_`).
2. To email customers: **Domains → Add domain** `cembers.in`, add the DNS records it shows where
   `cembers.in` is managed, wait for *Verified*. Until then Resend only delivers to your own
   Resend address, sent from `onboarding@resend.dev`.

## 3. DNS

Where `cembers.in` is managed: an **A record** `daybook` pointing to the VPS's IPv4 address.

## 4. Server

```bash
cd ~ && git clone <your repo URL> daybook && cd daybook
mkdir -p ~/daybook-data/uploads
nano .env.production.local        # paste the settings below
npm ci && npm run build
pm2 start ecosystem.config.cjs && pm2 save
```

`.env.production.local`:

```bash
DATABASE_URL=<same as your laptop's DATABASE_URL>
SITE_URL=https://daybook.cembers.in
UPLOAD_DIR=/home/ubuntu/daybook-data/uploads
BETTER_AUTH_SECRET=<openssl rand -base64 32>
CRON_SECRET=<openssl rand -hex 24>
RAZORPAY_KEY_ID=<rzp_test_…>
RAZORPAY_KEY_SECRET=<test secret>
RAZORPAY_WEBHOOK_SECRET=<from step 6>
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<Resend API key>
EMAIL_FROM="Daybook <bookings@cembers.in>"
OWNER_NOTIFY_EMAILS=<your email>
NEXT_PUBLIC_DEMO_MODE=1
```

- `SITE_URL` must be exactly the public address, or sign-in fails.
- `NEXT_PUBLIC_*` values are baked in at build time: change one, rebuild.
- If the build or app can't reach Supabase, the server has no IPv6: use Supabase's
  **Session pooler** string (Connect → Connection string → Session pooler) as `DATABASE_URL`.

## 5. Nginx + HTTPS

```bash
sudo cp deploy/nginx/daybook.cembers.in.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/daybook.cembers.in.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx     # -t checks first, so the other sites stay up
sudo certbot --nginx -d daybook.cembers.in       # HTTPS + http → https redirect
```

## 6. Razorpay (test mode)

Dashboard → Webhooks → Add: URL `https://daybook.cembers.in/api/webhooks/razorpay`, events
`payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`,
`refund.processed`, `refund.failed`. Put its secret in `RAZORPAY_WEBHOOK_SECRET`, then
`pm2 restart daybook`.

## 7. Every-minute job (emails, reminders)

`crontab -e` and add:

```cron
* * * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3100/api/cron/email > /dev/null
```

## Updating

```bash
cd ~/daybook && git pull && npm ci && npm run build && pm2 restart daybook
```

New migrations: `npm run db:migrate` from your laptop (same `DATABASE_URL`).

## Check it works

- `https://daybook.cembers.in` shows the site with the demo strip.
- Sign in at `/admin/login` with your admin login; the calendar shows today's demo bookings.
- Book with the test UPI ID `success@razorpay`; the booking appears in the admin bell.
- `pm2 logs daybook` shows no errors.

## Later, for a real salon

Use a separate database user for the app that can read and write rows but not change tables, plus
nightly backups of the database and `~/daybook-data/uploads`.
