# Compás (Next.js rebuild)

A rebuild of Compás — the coparenting logistics app — off Google Apps
Script, deployed on Vercel, still using the same Google Sheet as the
system of record. Built against the V3 feature set (server-resolved
identity, consolidated comments, richer Activity Plan reconciliation),
per the migration decision to treat V3 as the baseline rather than V2.

This folder is a **skeleton, not a full port**. It stands up the
architecture the migration doc calls for and implements the core
Schedule (Calendario) view end-to-end; the rest of the RPC surface is
stubbed with clear TODOs so the remaining work is well-scoped rather
than a blank page.

**Update:** the read-side data mapping (`getSheetData` in
`lib/sheets.ts`) is now verified against the *live* `Compas_Master`
spreadsheet's actual header row (read directly, column by column, on
2026-08-15) — not just the migration doc's description of it. The live
sheet differs from the doc in a few real ways; see the comments at the
top of `lib/types.ts` for the full list (no `EV With` custody segment,
only PA2/PA3 parent-activity slots exist, Activity5 has fewer fields,
there's an undocumented `Link` column, and `AleNotes` doesn't exist
yet). If the sheet gets restructured later, `lib/sheets.ts` has a
`verifyHeaderOrder()` check that logs a loud warning rather than
silently mis-mapping columns.

## What's built

- **Next.js 14 App Router** project structure, deployable to Vercel as
  a separate project rooted at this folder.
- **NextAuth + Google Sign-In**, gated by a `COMPAS_ROLE_MAP` allowlist
  (`lib/roleMap.ts`) — replaces `Session.getActiveUser()` +
  `_requireActor_()`.
- **Google Sheets API client** (`lib/sheets.ts`), authenticated via a
  service account. `getSheetData()`'s row→`DayRecord` mapping is real
  and verified against the live sheet's header row (see Update above).
- **Mock/dev-data mode** (`lib/mockData.ts`, `COMPAS_USE_MOCK_DATA=true`)
  so the app runs without live Google credentials — mirrors the
  original app's `IS_APPS_SCRIPT` offline fallback, and matches the
  real schema (4 custody segments, PA2/PA3 only, etc.).
- **Core Schedule view**: `/schedule`, with Week and Day sub-views,
  custody color-coding ported from `custodyColor()`/`whoLabel()`, and
  the fetch-once-render-many-views pattern from the original `DATA_MAP`.
- **Design tokens** ported into Tailwind (`tailwind.config.ts`,
  `app/globals.css`) — same color names (`--james`, `--ale`, `--mixed`,
  `--fog`) as the original CSS custom properties.

## What's not built yet

Straight from the migration doc's RPC surface (§5.6) — not yet ported:

- **`updateRow`'s write-side logic** — reading is done and verified;
  writing back to the sheet (including the column-provisioning
  equivalent of `_ensureColumns()`) is still a TODO in `lib/sheets.ts`,
  deferred deliberately since it touches live data.
- **Month/Year schedule views** (`renderMonth`, `renderYear`)
- **Decisions / Activity Plan reconciliation** (the V3-specific tab)
  and its content-hash "only write what changed" logic (doc §3.2).
- **Shopping list, Requests/Suggestions, Weekend Planning, Notes
  Threads / Messages** tabs.
- **Calendar integration** (`getCalendarEvents`,
  `getCamiloCalendarEvents`, `syncITMToCalendar`) via Calendar API v3.
- **Evening email + SMS notification** — needs a decision on Gmail API
  vs. a transactional provider (Resend/Postmark) and whether to keep
  the T-Mobile email-to-SMS trick (doc §7.5, §4.10).
- **Scheduled jobs** (9pm email, 10pm calendar sync) via Vercel Cron.
- **"Lenses" free-time views** (Murray/Ale) and the Master Table /
  Updates bulk editor.

## Setup

```bash
cd compas-app
npm install
cp .env.example .env.local   # fill in values, or leave COMPAS_USE_MOCK_DATA=true
npm run dev
```

With `COMPAS_USE_MOCK_DATA=true` (the default in `.env.example`), the
app runs entirely on the fixture data in `lib/mockData.ts` — useful for
UI work before real credentials are wired in.

To connect the real sheet:

1. Create a Google Cloud service account, enable the Sheets API, and
   share the target spreadsheet (`Compas_Master`, sheet tab
   `Compas_2026_Full_Year`) with the service account's email (Editor
   access).
2. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
   and `COMPAS_SPREADSHEET_ID` in `.env.local`.
3. Set `COMPAS_USE_MOCK_DATA=false`. The column mapping in
   `lib/sheets.ts` is already written against the live header row, so
   reads should work immediately — `updateRow` (writes) is still a TODO.
4. Set up a Google OAuth client (Google Cloud Console → APIs &
   Services → Credentials) for `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Deploying

This is meant to live as its own Vercel project pointed at this
subfolder (Project Settings → Root Directory → `compas-app`), separate
from the static `capsunlocked` site in the repo root, since it needs a
real build step. Set the same env vars from `.env.example` as Vercel
project environment variables — never commit real values.
