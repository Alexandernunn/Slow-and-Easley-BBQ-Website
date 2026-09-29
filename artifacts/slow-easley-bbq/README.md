# Slow & Easley BBQ & Soul Food

The homepage, `/menu/`, `/about/`, `/checkout/`, and `/confirmation/` are generated as static HTML. Edit `menu-data.js` for the crawlable menu snapshot and business information. Online pickup uses the live Square catalog and Netlify Functions; the browser never determines charge amounts. If Square is not configured, the menu stays browse-only with phone and Uber Eats delivery links.

## Deploy to Netlify

Connect this repository to Netlify. Leave the **base directory** at the repository root; the root `netlify.toml` supplies the build command, function directory, and publish path (`artifacts/slow-easley-bbq/dist/public`). Netlify uses Node 22. The build generates the static pages and SEO assets; online checkout requires the Netlify Functions and Square settings below. Do **not** deploy with a manual drag-and-drop of only `dist/public` if you need online checkout: that omits the functions.

Netlify supplies its primary site `URL` at build time. The generated canonical links, social image URLs, and sitemap use that address (including a custom domain once configured). To override it, set a build environment variable named `SITE_URL` to an HTTPS origin, such as `https://example.com`, and trigger a new deploy. If you connect a custom domain after the first deploy, redeploy so these URLs point to it.

For a static-only upload, run `PORT=25338 BASE_PATH=/ pnpm --filter @workspace/slow-easley-bbq run build` from the repository root and upload the **contents** of `artifacts/slow-easley-bbq/dist/public`. Without the Netlify Functions, online ordering remains disabled; call and delivery links still work.

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

The **Order delivery** links open the separate delivery storefront configured in `siteConfig.deliveryUrl`. Delivery availability, hours, pricing, and checkout are handled there. Items in the website's cart do not transfer to that storefront.

The menu's static snapshot is visible to search engines and phone-order customers. Once configured, the browser replaces it with current Square catalog items, variations, images, prices, and modifier choices. Square must have the restaurant's current items, location prices, required two-side entrée modifier list, fish style and optional cheese where applicable, and applicable taxes. An entrée missing its required selections is shown as phone-order only; unknown/stale catalog IDs cannot be charged. The cart is saved locally; `/checkout/` shows Square's authoritative tax-inclusive total before enabling payment. Ordering accepts a pickup time only Wednesday–Sunday 11 AM–7:30 PM America/Chicago, on a 15-minute slot at least 20 minutes ahead, while currently open.

## Square setup and sandbox verification

Create a Square **Sandbox** application and catalog at the chosen Sandbox location. Set these variables in Netlify **Site configuration → Environment variables** (or in Replit Secrets for development), never in `VITE_*`, HTML, or source control:

| Variable | Use |
| --- | --- |
| `SQUARE_APPLICATION_ID` | Public Web Payments application ID |
| `SQUARE_LOCATION_ID` | Public catalog and payment location ID |
| `SQUARE_ACCESS_TOKEN` | **Secret** server-side API token |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | **Secret** webhook verification key |
| `SQUARE_ENVIRONMENT` | `sandbox` (default) or `production` |
| `SQUARE_WEBHOOK_NOTIFICATION_URL` | Exact registered webhook URL; set if the URL differs from the default below |
| `SQUARE_LIVE_ENABLED` | Set to `true` only after production checks; production otherwise fails closed |

The webhook notification URL to paste into the Square Developer Dashboard for the supplied Netlify site is **`https://slowandeasely.netlify.app/.netlify/functions/square-webhook`**. Subscribe to `payment.updated`, `order.updated`, and `refund.created`. If a custom domain or other site URL is used, register that exact URL in Square and set `SQUARE_WEBHOOK_NOTIFICATION_URL` to the same exact string. A signed webhook is verified against the raw request body and that URL; unsigned requests are rejected.

To run locally, install dependencies with `pnpm install`, add the Sandbox variables using your local secure environment setup, then run `pnpm --package=netlify-cli dlx netlify dev --filter @workspace/slow-easley-bbq` from the repository root (or `netlify dev --filter @workspace/slow-easley-bbq` if the CLI is installed). The `--filter` selects this app in the monorepo; without it, the CLI prompts for a project. Netlify's dev server serves the static site and `/.netlify/functions/*`. The Replit Vite preview alone does **not** serve Netlify Functions, so it intentionally displays phone-order-only mode. A webhook registered to the public Netlify site cannot reach a local machine unless you arrange a public HTTPS tunnel and set the exact tunneled URL in Square and `SQUARE_WEBHOOK_NOTIFICATION_URL`.

Before enabling real payments, verify in Sandbox with Square's **documented Sandbox test cards**: catalog and required modifiers, tax-inclusive quoted total, successful card payment, declined card (no confirmation, unpaid pickup canceled), pickup time validation, webhook signature rejection/acceptance, receipt email settings, and that the order appears in Square's Sandbox order manager. Wallets appear only on compatible browsers/domains; Apple Pay/Google Pay require Square's domain setup. Use Square's current test card list rather than real card numbers. No real Sandbox charge has been run in this workspace without merchant credentials.

For production, configure the matching production application/location/token, catalog/taxes/receipt settings, and webhook key in Netlify; confirm your registered domain, wallet eligibility, POS fulfillment settings, and a small real end-to-end pickup order with the merchant. **Only then** set `SQUARE_ENVIRONMENT=production` and `SQUARE_LIVE_ENABLED=true`. Do not copy Sandbox credentials into production or assume a successful build verifies payment processing. After changing Netlify variables, trigger a new deploy. If a payment response is uncertain, do not retry with a different attempt: contact the restaurant with the order/attempt IDs to reconcile it in Square.