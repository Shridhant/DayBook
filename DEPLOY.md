# Deploying the Daybook demo

Target: **https://daybook.cembers.in** on the existing VPS (Nginx + PM2, alongside the other apps),
with the database on **Supabase** (Mumbai). Nothing here changes the other apps on the server.

| Piece | Where |
|---|---|
| App | VPS, PM2 process `daybook`, port **3100** on 127.0.0.1 only |
| Web server / HTTPS | Existing Nginx + Let's Encrypt (certbot) |
| Database | Supabase Postgres, Session pooler (IPv4) |
| Photos | VPS disk, `/home/ubuntu/daybook-data/uploads` |
| Emails + reminders | Resend SMTP, sent by a crontab job every minute |

Never commit secrets. On your laptop they live in `.env.local`; on the server in
`.env.production.local`. Both are gitignored.

---

## 1. Accounts (once)

- **Resend** (resend.com): add the domain `cembers.in`, add the DNS records it shows (SPF, DKIM)
  where `cembers.in` is managed, wait for "Verified", then create an API key.
- **DNS** for `cembers.in`: an **A record** `daybook` pointing to the VPS's IPv4 address.
- **Better Auth** needs no account, only a secret (step 4).

## 2. Supabase (once)

1. **Project Settings → Data API**: turn it off (or remove `public` from exposed schemas).
   Daybook talks to Postgres directly; leaving the Data API on would let anyone with the
   project's public key read the tables.
2. **SQL Editor**: open `db/supabase-setup.sql`, replace `CHANGE_ME` with a new strong password
   (`openssl rand -base64 24`, letters and digits only is easiest in URLs), and run it. This creates the
   `daybook_app` user and, on Postgres < 18, the `uuidv7()` function the tables use.
3. **Connection string**: Connect → Connection String. The *Direct connection* works where IPv6 is
   available (your laptop has it). If the server has no IPv6, use **Session pooler** instead. It looks like
   `postgresql://postgres:[PASSWORD]@db.tphupoyulxbuqbucmqor.supabase.co:5432/postgres` (direct) or
   `postgresql://postgres.tphupoyulxbuqbucmqor:[PASSWORD]@aws-…pooler.supabase.com:5432/postgres` (pooler).
   Drop the `[ ]` around the password, and if it contains `@ : / ? #`, write those as `%40 %3A %2F %3F %23`.
   Supabase blocks your IP after a few wrong passwords: unblock it under Database → Network Bans.

## 3. Database setup, from your laptop

Add to `.env.local` (keep the local `DATABASE_URL*` lines as they are; tests must never touch Supabase).
Write each URL out in full: the setup scripts don't expand `${…}` variables. `sslmode=require` is
enough: both drivers verified Supabase's certificate without a downloaded CA file.

```bash
# Supabase: schema owner (migrations, seed) and the app's own user
SUPABASE_MIGRATION_URL=postgresql://postgres:<postgres password>@db.tphupoyulxbuqbucmqor.supabase.co:5432/postgres?sslmode=require
SUPABASE_APP_URL=postgresql://daybook_app:<daybook_app password>@db.tphupoyulxbuqbucmqor.supabase.co:5432/postgres?sslmode=require
```

Then:

```bash
npm run db:supabase:migrate                      # create the tables
npm run db:supabase:seed                         # services, artists, shifts, sample content (wipes them first)
npm run db:supabase:demo                         # sample bookings around today (re-run before a pitch)
npm run admin:create-user -- --url-env SUPABASE_MIGRATION_URL --role owner --name "Your Name" --email you@cembers.in
```

Re-run step 2's SQL once more after migrating, so `daybook_app` can use every table.

**To run your laptop against Supabase** (instead of local Postgres), set in `.env.local`:
`DATABASE_URL=$SUPABASE_APP_URL` and restart `npm run dev`. Switch back by restoring the local line.

## 4. Server (VPS)

```bash
# Code
cd ~ && git clone <your repo URL> daybook && cd daybook
mkdir -p ~/daybook-data/uploads

# Settings: create .env.production.local (values below), then:
npm ci
npm run build
pm2 start ecosystem.config.cjs && pm2 save
```

`.env.production.local`:

```bash
DATABASE_URL=<SUPABASE_APP_URL from step 3>
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

`SITE_URL` must be exactly the public address, or sign-in fails. `NEXT_PUBLIC_*` values are
baked in at build time: change one, rebuild.

## 5. Nginx + HTTPS

```bash
sudo cp deploy/nginx/daybook.cembers.in.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/daybook.cembers.in.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d daybook.cembers.in     # adds HTTPS and the http → https redirect
```

`nginx -t` checks the config before reloading, so a typo can't take the other sites down.

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

## 8. Updating

```bash
cd ~/daybook && git pull && npm ci && npm run build && pm2 restart daybook
```

New migrations run from your laptop: `npm run db:supabase:migrate`.

## 9. Backups

Photos are on the VPS disk: back up `~/daybook-data/uploads` together with the database. Supabase's
free plan keeps limited backups; for a demo that's fine. For a real salon, add a nightly `pg_dump`.

## Check it works

- `https://daybook.cembers.in` shows the site with the demo strip.
- Sign in at `/admin/login`; the calendar shows today's demo bookings.
- Book with the test UPI ID `success@razorpay`; the booking appears in the admin bell.
- `pm2 logs daybook` shows no errors.
