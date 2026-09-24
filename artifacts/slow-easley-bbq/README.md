# Slow & Easley BBQ & Soul Food

The public homepage, `/menu/`, and combined `/about/` location page are generated as static HTML from `menu-data.js`. Edit that file to update menu prices, descriptions, or business information. Run `pnpm --filter @workspace/slow-easley-bbq run dev` in the managed website workflow to regenerate the pages; the production build regenerates them automatically. The order cart on `/menu/` runs in the browser and remembers selections locally. It does not submit an order to a server, take payment, or confirm availability.

## Deploy to Netlify

Connect this repository to a new Netlify site. Leave the **base directory** at the repository root; the root `netlify.toml` supplies the build command and publishes `artifacts/slow-easley-bbq/dist/public`. Netlify installs the pinned pnpm version from the root `package.json` and uses Node 22. The build generates the three static pages, fonts, images, robots file, and sitemap; it does not need the separate API server, a database, or secrets.

Netlify supplies its primary site `URL` at build time. The generated canonical links, social image URLs, and sitemap use that address (including a custom domain once configured). To override it, set a build environment variable named `SITE_URL` to an HTTPS origin, such as `https://example.com`, and trigger a new deploy. If you connect a custom domain after the first deploy, redeploy so these URLs point to it.

For a manual upload instead of a Git-connected deploy, run `PORT=25338 BASE_PATH=/ pnpm --filter @workspace/slow-easley-bbq run build` from the repository root and upload the **contents** of `artifacts/slow-easley-bbq/dist/public`. The menu keeps orders in each visitor's browser and asks them to call; it does not accept online payments.

## Before publishing

Confirm the following before publishing:

- `siteConfig.canonicalUrl`: currently `https://slowandeasleybbq.com`, sourced from the public site the owner supplied. This remains the fallback outside Netlify; verify the deployed canonical domain or provide `SITE_URL` when building elsewhere.
- `restaurant.address`: 3612 Gallatin Pike, Nashville, TN 37216. Street, city, and hours came from the supplied location announcement; the ZIP and exact-address coordinates were cross-checked with address listings and OpenStreetMap geocoding.
- `restaurant.phone` and `displayPhone`: currently `(615) 988-0697`, sourced from the public site. Confirm it is the right number for food orders before launch; it is used by the call links.
- `restaurant.hours` and `openingHours`: Wednesday–Sunday, 11:00 AM–7:30 PM, based on the supplied announcement. Monday and Tuesday are not listed as open.
- `restaurant.geo.latitude` and `longitude`: exact-address coordinates from OpenStreetMap geocoding. The directions link uses the street address so visitors land on the right location even if map providers update their coordinates.
- `restaurant.social.facebook` and `instagram`: sourced from the public site. Confirm those are the intended profiles.

Replace the branded placeholder social image at `public/og-image.png` (1200 × 630) and the `public/apple-touch-icon.png` (180 × 180) with approved imagery when available. The address card links to Google Maps and intentionally uses a decorative background rather than a fake map. If adding photographs, serve responsive AVIF/WebP with a JPEG fallback, dimensions, descriptive alt text, and lazy loading below the fold. A raster hero should be preloaded and marked `fetchpriority="high"`; the current CSS/SVG hero needs no image request.

Once the actual domain and business details are in place, validate the published URL with Google's Rich Results Test and PageSpeed Insights. Structured data is generated from the same menu as the visible HTML, but search appearance and field Core Web Vitals cannot be guaranteed from a local audit.

## Ordering

All priced items can be added from `/menu/`. Entrées require two included side choices; the applicable fish options support Cajun/regular and +$1 cheese. The order total is an estimate before tax. Customers must call and receive confirmation from the restaurant; no online checkout or payment is provided.

The cart also has a **Square checkout preview**. It shows a review screen using the current cart lines and item selections; its payment action is disabled. No Square account is connected, and the preview does not collect card details, create an order, or take payment. When live checkout is added, send only the item identities, quantities, and choices to a server, recalculate prices and taxes there, then create a Square-hosted payment link server-side. Do not trust the browser's displayed subtotal as an authoritative charge.