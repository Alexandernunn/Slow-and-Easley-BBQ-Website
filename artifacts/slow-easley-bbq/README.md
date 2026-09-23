# Slow & Easley BBQ & Soul Food

The public website is generated as static HTML from `menu-data.js`. Edit that file to update menu prices, descriptions, or business information. Run `pnpm --filter @workspace/slow-easley-bbq run dev` in the managed website workflow to regenerate the page; the production build regenerates it automatically.

## Before publishing

Replace these placeholders in `menu-data.js`:

- `siteConfig.canonicalUrl`: the real published HTTPS domain. This sets canonical, Open Graph, Twitter, Restaurant JSON-LD, sitemap, and robots URLs. Do not publish with `example.com`.
- `restaurant.address.street`, `city`, and `postalCode`: actual street address, city, ZIP. Confirm state/region and country.
- `restaurant.phone` and `displayPhone`: the real E.164 number and its readable equivalent. Until provided, all call buttons are non-clickable.
- `restaurant.hours` and `openingHours`: visible opening hours and corresponding structured schedule. For `openingHours`, use objects such as `{ dayOfWeek: ["Monday", "Tuesday"], opens: "11:00", closes: "20:00" }`; do not guess business hours.
- `restaurant.geo.latitude` and `longitude`: actual coordinates. The map link appears only after a street address **and** coordinates have been set.
- `restaurant.social.facebook` and `instagram`: actual profile URLs. Until provided, the icons are non-clickable.

Replace the branded placeholder social image at `public/og-image.png` (1200 × 630), the `public/apple-touch-icon.png` (180 × 180), and the static map placeholder in `generate.js` with approved imagery when available. If adding photographs, serve responsive AVIF/WebP with a JPEG fallback, dimensions, descriptive alt text, and lazy loading below the fold. A raster hero should be preloaded and marked `fetchpriority="high"`; the current CSS/SVG hero needs no image request.

Once the actual domain and business details are in place, validate the published URL with Google's Rich Results Test and PageSpeed Insights. Structured data is generated from the same menu as the visible HTML, but search appearance and field Core Web Vitals cannot be guaranteed from a local audit.