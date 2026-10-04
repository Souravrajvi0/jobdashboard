# Job Search Analytics Dashboard

A personal dashboard for measuring a job search as **effort → output → outcome**. Log daily activity, track opportunities and target companies, and let the app calculate conversion rates, trends, funnel drop-off and a data-driven weekly review.

**Live:** https://jobdashboard-uii4.netlify.app

## Features

- **Dashboard** – week-over-week KPIs and headline conversion rates.
- **Daily Entry** – log applications, referrals, outreach, recruiter replies, calls, interviews, offers and inbound profile activity (one entry per day).
- **Pipeline** – track each opportunity by stage; the furthest stage reached is kept even after a rejection.
- **Companies** – target list with role, job link, source, contact/referral availability, status and follow-up dates.
- **Analytics** – trend charts and funnel analysis derived from daily entries.
- **Weekly Review** – automatic insights based on configurable diagnostic thresholds.
- **Settings** – switch between demo and real data, tune diagnostics, clear or reload demo data.

A fresh database starts with clearly labelled demo data so the charts aren't empty. Real data is stored separately and is never mixed with demo rows.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, server functions)
- Tailwind CSS v4, shadcn/ui, Recharts
- [Turso](https://turso.tech) (libSQL) in production; a local SQLite file in development
- Deployed on [Netlify](https://www.netlify.com) (Nitro `netlify` preset)

## Getting started

Requires **Node.js 22 or newer**.

```sh
npm install --legacy-peer-deps
npm run dev
```

The app runs at http://localhost:8080. With no Turso variables set, data is stored in `data/job-search.db` (git-ignored).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso database URL, e.g. `libsql://<db>-<org>.turso.io`. When unset, the local SQLite file is used. |
| `TURSO_AUTH_TOKEN` | Turso database token (`turso db tokens create <db>`). |
| `JOB_SEARCH_DB_PATH` | Optional path for the local database file. Defaults to `data/job-search.db`. |

The schema is created and migrated automatically on first connection — no manual SQL is needed.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (Node server locally, Netlify output when `NETLIFY=true`) |
| `npm start` | Run the local production build |
| `npm test` | Run the test suite (Vitest) |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |

## Deployment (Netlify + Turso)

1. Create a Turso database and token:
   ```sh
   turso db create jobdashboard
   turso db show jobdashboard --url
   turso db tokens create jobdashboard
   ```
2. In the Netlify site settings, add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as environment variables.
3. Link this repository to the site (or deploy with the Netlify CLI). `netlify.toml` already sets the build command, publish directory and Node 22.

## Project structure

```
src/
  routes/                 File-based routes (one per screen)
  components/             Page components and shadcn/ui primitives
  lib/job-search-data.ts  Metric definitions and all derived calculations
  lib/job-search-api.ts   Server functions with input validation
  server/job-search-db.ts Database access, migrations and demo data
  test/                   Vitest tests
```

Conversion rates and insights are always derived from daily entries — they are never stored or accepted as input.
