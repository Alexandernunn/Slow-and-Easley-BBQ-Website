# Slow & Easley BBQ & Soul Food

The homepage, `/menu/`, `/about/`, `/checkout/`, and `/confirmation/` are generated as static HTML. Edit `menu-data.js` for the website's authoritative items, stable IDs, prices, and business information; edit `netlify/functions/_shared/website-order.mjs` for special ordering choices. Online pickup uses this menu and Netlify Functions to create itemized custom Square orders; Square catalog items are not required. The browser never determines charge amounts. If Square is not configured, the menu stays browse-only with phone and Uber Eats delivery links.

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

The website menu is visible to search engines and phone-order customers. When the functions are available, the orderable version of the same menu adds explicit selections: two different sides for each entrée, Cajun/regular preparation and optional $1 cheese for fish entrées, and regular/spicy for additional sauce. The server reads the same menu source, rejects unknown IDs or selections, and creates custom Square order lines with server-owned prices. Edits to website prices or availability **do not sync to Square's item catalog or inventory**. Existing Square-ID carts are reset when this version is deployed; customers must rebuild them. `/checkout/` shows Square's calculated total including applicable taxes before payment. Ordering accepts a pickup time only Wednesday–Sunday 11 AM–7:30 PM America/Chicago, on a 15-minute slot at least 20 minutes ahead, while currently open.

## Square setup and sandbox verification

Create a Square **Sandbox** application at the chosen Sandbox location; Square item catalog entries are not required. Configure and verify taxes applicable to **custom amounts** at that location. Custom items do not automatically inherit item-specific catalog taxes; the server explicitly applies the enabled Square tax rules for custom amounts to the order. If the merchant confirms these orders are tax-exempt, `SQUARE_ALLOW_NO_TAX=true` explicitly permits zero tax; do not set that flag just to bypass a missing tax setup. Set these variables in Netlify **Site configuration → Environment variables** with Functions scope (or in Replit Secrets for development), never in `VITE_*`, HTML, `.replit`, or source control:

| Variable | Use |
| --- | --- |
| `SQUARE_APPLICATION_ID` | Public Web Payments application ID |
| `SQUARE_LOCATION_ID` | Public pickup and payment location ID |
| `SQUARE_ACCESS_TOKEN` | **Secret** server-side API token |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | **Secret** webhook verification key |
| `SQUARE_ENVIRONMENT` | `sandbox` (default) or `production` |
| `SQUARE_WEBHOOK_NOTIFICATION_URL` | Exact registered webhook URL; set if the URL differs from the default below |
| `SQUARE_LIVE_ENABLED` | Set to `true` only after production checks; production otherwise fails closed |
| `SQUARE_WEBSITE_MENU_ENABLED` | Additional production safety gate for this new website-priced checkout; set to `true` only after verifying website prices, Square taxes, and Sandbox orders with the merchant |
| `SQUARE_ALLOW_NO_TAX` | Optional; `true` only if the merchant confirms these orders require no sales tax |

The webhook notification URL to paste into the Square Developer Dashboard for the supplied Netlify site is **`https://slowandeasely.netlify.app/.netlify/functions/square-webhook`**. Subscribe to `payment.updated`, `order.updated`, and `refund.created`. If a custom domain or other site URL is used, register that exact URL in Square and set `SQUARE_WEBHOOK_NOTIFICATION_URL` to the same exact string. A signed webhook is verified against the raw request body and that URL; unsigned requests are rejected.

To run locally, install dependencies with `pnpm install`, add the Sandbox variables using your local secure environment setup, then run `pnpm --package=netlify-cli dlx netlify dev --filter @workspace/slow-easley-bbq` from the repository root (or `netlify dev --filter @workspace/slow-easley-bbq` if the CLI is installed). The `--filter` selects this app in the monorepo; without it, the CLI prompts for a project. Netlify's dev server serves the static site and `/.netlify/functions/*`. The Replit Vite preview alone does **not** serve Netlify Functions, so it intentionally displays phone-order-only mode. A webhook registered to the public Netlify site cannot reach a local machine unless you arrange a public HTTPS tunnel and set the exact tunneled URL in Square and `SQUARE_WEBHOOK_NOTIFICATION_URL`.

Before enabling real payments, verify in Sandbox with Square's **documented Sandbox test cards**: website menu options, custom-order tax calculation, successful card payment, declined card (no confirmation, unpaid pickup canceled), pickup time validation, webhook signature rejection/acceptance, receipt email settings, and that the order appears in Square's Sandbox order manager. Wallets appear only on compatible browsers/domains; Apple Pay/Google Pay require Square's domain setup. Use Square's current test card list rather than real card numbers. No real Sandbox charge has been run in this workspace without merchant Sandbox credentials.

For production, confirm the current website prices/options with the merchant, configure matching production application/location/token, custom-amount taxes/receipt settings, and webhook key in Netlify; confirm registered domain, wallet eligibility, and POS fulfillment settings. **Only after Sandbox and merchant verification** enable `SQUARE_WEBSITE_MENU_ENABLED=true` alongside `SQUARE_ENVIRONMENT=production` and `SQUARE_LIVE_ENABLED=true`. The last two may already be set on the Netlify site, but the additional website-menu gate remains off by default to prevent untested real charges. Do not copy Sandbox credentials into production or assume a successful build verifies payment processing. After changing Netlify variables, trigger a new deploy. If a payment response is uncertain, do not retry with a different attempt: contact the restaurant with the order/attempt IDs to reconcile it in Square.