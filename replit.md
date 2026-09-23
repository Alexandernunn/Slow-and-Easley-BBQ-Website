# Slow & Easley BBQ & Soul Food

Mobile-first static restaurant site with a crawlable menu and local search metadata.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/slow-easley-bbq run dev` — regenerate and preview the restaurant website using its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The restaurant website does not need an API, database, or secret.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/slow-easley-bbq/menu-data.js` — menu, prices, and business details.
- `artifacts/slow-easley-bbq/generate.js` — static HTML, JSON-LD, sitemap, and robots generator.
- `artifacts/slow-easley-bbq/src/style.css` — lightweight site styles and self-hosted fonts.
- `artifacts/slow-easley-bbq/README.md` — launch checklist and placeholder replacement instructions.

## Architecture decisions

- The public site intentionally ships no React runtime despite using the Vite artifact template; static HTML keeps menu text available to crawlers without JavaScript.
- Business details are placeholders until verified, so phone, map, and social interactions are disabled rather than leading visitors to invented destinations.

## Product

One-page menu, restaurant story, location and hours area, responsive call-to-order controls, and search/social metadata.

## User preferences

- Prioritize page speed and Google SEO over effects and framework complexity; keep the menu and its schema generated from the same data source.

## Gotchas

- Replace the canonical domain and verified contact/location/hours details before publishing; see the artifact README. A local Lighthouse score does not establish real-user Core Web Vitals.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
