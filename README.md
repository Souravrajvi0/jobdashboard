# Job Change Analytics Dashboard

A personal dashboard for measuring a job search as **effort → output → outcome**: daily activity logging, week-over-week KPIs, automatically calculated conversion rates, trend charts, funnel analysis and a data-driven weekly review.

## Stack

- TanStack Start (React 19, file-based routing, server functions)
- Tailwind CSS v4 + shadcn/ui components, Recharts
- SQLite via Node's built-in `node:sqlite` (stored in `data/job-search.db`)

## Requirements

- Node.js 22 or newer

## Development

```sh
npm install --legacy-peer-deps
npm run dev
```

The app runs at http://localhost:8080.

## Production

```sh
npm run build
npm start
```

Set `JOB_SEARCH_DB_PATH` to store the database somewhere other than `data/job-search.db`.

## Tests

```sh
npm test
```
