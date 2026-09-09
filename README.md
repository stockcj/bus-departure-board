# Bus Departure Board

A live departure board for a handful of Cambridgeshire bus stops. React + Vite
front end, with a serverless function that scrapes the official
[cambridgeshirebus.info](https://www.cambridgeshirebus.info) live-display page and
caches the result.

## How it works

- **`src/`** – React single-page app. Polls `/api/departure` every 60s and renders
  the next 5 departures for the selected stop.
- **`api/departure.js`** – Vercel serverless function. Fetches the stop's live
  page, parses the departure rows out of the HTML with `jsdom`, and returns JSON.
  Responses are cached for 60s (Redis if `REDIS_URL` is set, otherwise an
  in-process map).
- **`src/stops.js`** – the list of stops shown in the picker. Add one by appending
  its `stopRef` and a display name.

## Local development

```
npm install
npm run dev
```

`npm run dev` runs the Vite dev server *and* the `api/` handlers (via the
`devApi` plugin in `vite.config.js`), so the whole app works with no Redis
instance – departures are cached in memory.

To exercise the Redis path locally:

```
REDIS_URL=redis://127.0.0.1:6379 npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server + API on http://localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm run lint` | ESLint |

## Deployment

Deployed on Vercel. `vercel.json` builds the static site to `dist/` and runs
`api/**/*.js` as Node functions. Set `REDIS_URL` in the Vercel project env for
shared caching across function invocations.

## Notes

This depends on scraping a third-party page – if `cambridgeshirebus.info`
changes its markup, the parser in `api/departure.js` will need updating.

`/api/departure` is rate limited to 30 requests per minute per IP (fixed
window, Redis-backed when `REDIS_URL` is set, otherwise per-instance). Over
the limit returns `429` with a `Retry-After` header.
