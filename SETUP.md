# Vavi Platform — Setup Guide

Your business cockpit for **Flyson**, **Abna Son**, and **Personal Brand**.
Everything below is free tier. Total time: ~15 minutes of account setup + a few CLI commands.

---

## 1. Accounts you need (one-time, ~15 min)

| # | What | Where | Notes |
|---|------|-------|-------|
| 1 | GitHub account | github.com | You probably have one — used for deploys |
| 2 | Vercel account (Hobby, free) | vercel.com | Sign in **with GitHub** |
| 3 | Supabase account (free) | supabase.com | Sign in **with GitHub** |
| 4 | New Telegram bot | Telegram → @BotFather → `/newbot` | Name it e.g. "Vavi" — use a **NEW** bot, not the old assistant's token |
| ✅ | OpenAI API key | — | You already have one (from the old assistant) |

---

## 2. Create the Supabase project (~5 min)

1. supabase.com → New project → name `vavi` → region **eu-west** (closest to Morocco) → generate a strong DB password (save it).
2. **Create your login user:** Dashboard → Authentication → Users → Add user → email `sohaiblaalimi@gmail.com` + a strong password → check "Auto Confirm User".
3. **Disable signups:** Authentication → Sign In / Up → Email → turn OFF "Allow new users to sign up".
4. **Copy API credentials:** Project Settings → API Keys:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key → `SUPABASE_SECRET_KEY`

## 3. Fill `.env.local`

Copy values into `vavi-platform/.env.local` (replace ALL placeholders):

- The 3 Supabase values from step 2
- `OPENAI_API_KEY` — your existing key
- `CRON_SECRET` — any long random string (PowerShell: `-join ((48..57)+(97..122) | Get-Random -Count 48 | % {[char]$_})`)
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_WEBHOOK_SECRET` — another long random string (only letters/digits/`_`/`-`)

## 4. Push the database schema

```powershell
cd "vavi-platform"
npx supabase login          # opens browser
npx supabase link           # pick the 'vavi' project; needs the DB password
npx supabase db push        # applies migrations 0001–0005 (schema + seed)
```

This seeds the 3 projects (Flyson, Abna Son, Personal Brand) and their starting metrics
(missions flown, hectares treated, projects delivered, posts published, followers).

## 5. Run locally

```powershell
npm run dev
```

Open http://localhost:3000 → redirected to /login → sign in with the Supabase user from step 2.

> If npm ever fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` on this machine, prefix commands with:
> `$env:NODE_OPTIONS="--use-system-ca"` (PowerShell).

## 6. Deploy to Vercel

1. Push this repo to GitHub (private repo recommended):
   ```powershell
   gh repo create vavi-platform --private --source . --push
   # or create the repo on github.com and: git remote add origin <url>; git push -u origin main
   ```
2. vercel.com → Add New Project → import `vavi-platform` → before deploying, add **all env vars from `.env.local`** (Production).
3. Deploy. Confirm in Project → Settings → Functions that **Fluid Compute is enabled** (default on new projects).
4. Crons are configured by `vercel.json` automatically: morning 06:00 UTC (≈07:00 Morocco), evening 17:00 UTC (≈18:00 Morocco). Friday's evening message includes the weekly report.
   - Note: Vercel Hobby fires crons anywhere within the scheduled hour, and during Ramadan (UTC+0) messages arrive 1h earlier. This is by design — Hobby allows exactly 2 daily crons.

## 7. Connect the Telegram bot (after first deploy)

```powershell
npx tsx scripts/telegram-setup.ts https://YOUR-PRODUCTION-DOMAIN.vercel.app
```

Then open your bot in Telegram and send `/start` — this registers your chat as the owner.
Try: `won a 15k mad spraying deal with atlas farms for flyson` → you should get a receipt with an Undo button.

**Bot commands:** `/today` `/week` `/report` `/tasks` `/undo` `/help`
**Quick-add examples:**
- `task: call the cooperative in Agadir tomorrow, urgent, flyson`
- `lead: real estate agency interested in whatsapp automation`
- `spent 800 mad on drone batteries`
- `+1 mission, 12 hectares treated today`
- `idea: drone cleaning offer for solar farms`

## 8. Test the crons manually (optional but recommended)

Vercel Dashboard → Project → Settings → Cron Jobs → "Run" on each job → check Telegram.
Locally (dry-run, no message sent):

```powershell
$env:NODE_OPTIONS="--use-system-ca"; npm run dev
# in another terminal:
Invoke-RestMethod "http://localhost:3000/api/cron/evening?dryRun=1&date=2026-06-12" -Headers @{ Authorization = "Bearer dev-cron-secret" }
```

---

## Daily flow (how to actually use Vavi)

- **07:00** Telegram morning briefing: today's tasks, overdue alerts, week targets.
- **During the day:** quick-add from the field via Telegram; manage boards in the web app.
- **18:00** Telegram evening summary: done / in progress / numbers logged / tomorrow's top 3.
- **Friday evening:** weekly report with health % per business appended to the summary.
- **Anytime:** `/report` in Telegram or the Report page for week-by-week health scores.

## Health score (how the % is computed)

Per project, weekly: **Execution 40%** (tasks done vs overdue) + **Ops 30%** (metrics vs weekly targets) + **Business 30%** (revenue vs target + pipeline activity). Components with no data are excluded and weights renormalize. ≥80 🟢 on track · 60–79 🟡 needs attention · <60 🔴 off track. Set targets in Settings.

## Troubleshooting

- **Briefings stopped?** Check the Supabase dashboard first — free projects pause after 7 idle days (the crons normally keep it warm).
- **Bot not replying?** `npx tsx scripts/telegram-setup.ts <url>` again and check the printed `getWebhookInfo` for errors.
- **Regenerate DB types after schema changes:** `npx supabase gen types typescript --linked > types/db.ts` (keep the aliases at the bottom of the file).
- **Swap AI to Claude later:** `npm i @ai-sdk/anthropic`, edit `lib/ai/provider.ts` (2 lines), add `ANTHROPIC_API_KEY`.
