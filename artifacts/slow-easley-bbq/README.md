# Slow & Easley BBQ & Soul Food

The public homepage and `/menu/` are generated as static HTML from `menu-data.js`. Edit that file to update menu prices, descriptions, or business information. Run `pnpm --filter @workspace/slow-easley-bbq run dev` in the managed website workflow to regenerate the pages; the production build regenerates them automatically. The order cart on `/menu/` runs in the browser, remembers selections locally, and opens a prepared SMS message for the customer to send. It does not submit an order to a server, take payment, or confirm availability.

## Before publishing

Replace these placeholders in `menu-data.js`:

- `siteConfig.canonicalUrl`: currently `https://slowandeasleybbq.com`, sourced from the public site the owner supplied. Ensure this deployment is actually connected to that domain before publishing, or update the canonical URL to the correct live address.
- `restaurant.address.street`, `city`, and `postalCode`: actual street address, city, ZIP. Confirm state/region and country.
- `restaurant.phone` and `displayPhone`: currently `(615) 988-0697`, sourced from the public site. Confirm it is the right number for food orders and texts before launch; it is used by the cart's SMS handoff.
- `restaurant.hours` and `openingHours`: visible opening hours and corresponding structured schedule. For `openingHours`, use objects such as `{ dayOfWeek: ["Monday", "Tuesday"], opens: "11:00", closes: "20:00" }`; do not guess business hours.
- `restaurant.geo.latitude` and `longitude`: actual coordinates. The map link appears only after a street address **and** coordinates have been set.
- `restaurant.social.facebook` and `instagram`: sourced from the public site. Confirm those are the intended profiles.

Replace the branded placeholder social image at `public/og-image.png` (1200 × 630), the `public/apple-touch-icon.png` (180 × 180), and the static map placeholder in `generate.js` with approved imagery when available. If adding photographs, serve responsive AVIF/WebP with a JPEG fallback, dimensions, descriptive alt text, and lazy loading below the fold. A raster hero should be preloaded and marked `fetchpriority="high"`; the current CSS/SVG hero needs no image request.

Once the actual domain and business details are in place, validate the published URL with Google's Rich Results Test and PageSpeed Insights. Structured data is generated from the same menu as the visible HTML, but search appearance and field Core Web Vitals cannot be guaranteed from a local audit.

## Ordering

All priced items can be added from `/menu/`. Entrées require two included side choices; the applicable fish options support Cajun/regular and +$1 cheese. The order total is an estimate before tax. Customers must send the prepared text message and receive confirmation from the restaurant; no online checkout or payment is provided.

The cart also has a **Square checkout preview**. It shows a review screen using the current cart lines and item selections; its payment action is disabled. No Square account is connected, and the preview does not collect card details, create an order, or take payment. When live checkout is added, send only the item identities, quantities, and choices to a server, recalculate prices and taxes there, then create a Square-hosted payment link server-side. Do not trust the browser's displayed subtotal as an authoritative charge.