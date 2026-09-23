import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { siteConfig, restaurant, menu } from './menu-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Honest Placeholders checks
const hasRealPhone = !restaurant.displayPhone.includes('[PLACEHOLDER]');
const hasRealAddress = !restaurant.address.street.includes('[PLACEHOLDER]');
const hasRealPostalCode = !restaurant.address.postalCode.includes('[ZIP]');
const hasRealCoordinates = Number.isFinite(restaurant.geo.latitude) && Number.isFinite(restaurant.geo.longitude);
const hasRealHours = !restaurant.hours.includes('[PLACEHOLDER]');
const hasRealSocialFacebook = !restaurant.social.facebook.includes('placeholder');
const hasRealSocialInstagram = !restaurant.social.instagram.includes('placeholder');
const isRealCity = !restaurant.address.city.includes('[CITY]');
const displayCity = isRealCity ? restaurant.address.city : '[CITY]';
const siteUrl = siteConfig.canonicalUrl.replace(/\/$/, ''); // ensure no trailing slash

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": restaurant.name,
  "image": `${siteUrl}/og-image.png`,
  "url": siteUrl,
  ...(hasRealPhone && { "telephone": restaurant.phone }),
  "address": {
    "@type": "PostalAddress",
    "streetAddress": hasRealAddress ? restaurant.address.street : "",
    "addressLocality": isRealCity ? restaurant.address.city : "",
    "addressRegion": restaurant.address.region,
    ...(hasRealPostalCode && { "postalCode": restaurant.address.postalCode }),
    "addressCountry": restaurant.address.country
  },
  ...(hasRealCoordinates && { "geo": {
    "@type": "GeoCoordinates",
    "latitude": restaurant.geo.latitude,
    "longitude": restaurant.geo.longitude
  } }),
  "servesCuisine": ["Barbecue", "Soul Food"],
  "priceRange": "$",
  ...(hasRealHours && restaurant.openingHours.length > 0 && {
    "openingHoursSpecification": restaurant.openingHours.map(({ dayOfWeek, opens, closes }) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek,
      opens,
      closes
    }))
  }),
  "hasMenu": {
    "@type": "Menu",
    "name": "Slow & Easley Menu",
    "url": `${siteUrl}/menu/`,
    "hasMenuSection": menu.map(section => ({
      "@type": "MenuSection",
      "name": section.category,
      "description": section.note || "",
      "hasMenuItem": section.items.map(item => ({
        "@type": "MenuItem",
        "name": item.name,
        "description": item.description || "",
        "offers": {
          "@type": "Offer",
          "price": item.price,
          "priceCurrency": "USD"
        }
      }))
    }))
  }
};

const money = amount => `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
const renderOrderMenu = () => menu.map((section, sectionIndex) => `
  <section class="menu-section" id="category-${sectionIndex}">
    <div class="menu-section-heading">
      <div><p class="menu-kicker">0${sectionIndex + 1} / The menu</p><h2>${section.category}</h2></div>
      ${section.note ? `<p>${section.note}</p>` : ''}
    </div>
    <ul class="menu-items">
      ${section.items.map((item, itemIndex) => `
        <li class="menu-card">
          <div class="menu-card-top">
            <h3>${item.name}</h3><strong>${money(item.price)}</strong>
          </div>
          ${item.description ? `<p>${item.description}</p>` : '<p class="menu-card-spacer" aria-hidden="true"></p>'}
          <button class="add-item" type="button" data-item="${sectionIndex}-${itemIndex}" aria-label="Add to order: ${item.name}">Add to order <span aria-hidden="true">＋</span></button>
        </li>`).join('')}
    </ul>
  </section>`).join('');

const html = `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${restaurant.name} | Tennessee BBQ</title>
  <meta name="description" content="Smoked BBQ, fried whitefish, and scratch-made soul food in ${displayCity}. View our menu and order today.">
  <meta name="theme-color" content="#0a0a0a">
  
  <meta property="og:title" content="${restaurant.name}">
  <meta property="og:description" content="Smoked BBQ, fried whitefish, and scratch-made soul food in ${displayCity}.">
  <meta property="og:image" content="${siteUrl}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${siteUrl}">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${restaurant.name}">
  <meta name="twitter:description" content="Smoked BBQ, fried whitefish, and scratch-made soul food in ${displayCity}.">
  <meta name="twitter:image" content="${siteUrl}/og-image.png">
  
  <link rel="canonical" href="${siteUrl}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" href="/fonts/bebas-neue-latin.woff2" as="font" type="font/woff2" crossorigin>
  <style>html{background:#0a0a0a;color:#fff}body{margin:0;font-family:Barlow,system-ui,sans-serif}header{background:#0a0a0a}h1{font-family:"Bebas Neue",Impact,sans-serif}</style>
  
  <link rel="stylesheet" href="/src/style.css">
  
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd)}
  </script>
</head>
<body class="font-sans antialiased bg-[#0a0a0a] text-white overflow-x-hidden pt-[60px] md:pt-[76px]">
  
  <!-- Ambient CSS Fire Effects -->
  <div class="fixed inset-0 pointer-events-none z-[-1] overflow-hidden" aria-hidden="true">
    <div class="bg-glow absolute bottom-0 left-1/4 w-[60vw] h-[60vh]"></div>
    <div class="bg-glow absolute top-1/4 right-0 w-[40vw] h-[50vh]" style="animation-delay: -2s; opacity: 0.5;"></div>
  </div>

  <!-- Header / Nav -->
  <header class="fixed top-0 w-full z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-zinc-900">
    <div class="container mx-auto px-4 py-3 flex justify-between items-center">
      <a href="#" aria-label="S&E BBQ home" class="font-display text-2xl md:text-3xl tracking-widest text-white hover:text-[#d91f26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f26]">S&E BBQ</a>
      <nav class="hidden md:flex space-x-8 items-center" aria-label="Main Navigation">
        <a href="/menu/" class="font-display tracking-widest uppercase hover:text-[#d91f26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f26]">Menu</a>
        <a href="#about" class="font-display tracking-widest uppercase hover:text-[#d91f26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f26]">About</a>
        <a href="#location" class="font-display tracking-widest uppercase hover:text-[#d91f26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f26]">Location</a>
      </nav>
      ${hasRealPhone ? `
      <a href="tel:${restaurant.phone}" aria-label="Call to Order" class="hidden md:inline-block bg-[#d91f26] text-white font-display tracking-widest uppercase px-6 py-2 hover:bg-white hover:text-[#d91f26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
        Call to Order
      </a>
      ` : `
      <span class="hidden md:inline-block border border-zinc-700 text-zinc-300 font-display tracking-widest uppercase px-6 py-2" title="Phone number coming soon">
        Call to Order (Soon)
      </span>
      `}
    </div>
  </header>

  <main>
    <!-- Hero Section -->
    <section class="relative min-h-[90vh] md:min-h-[85vh] flex flex-col items-center justify-center py-20 px-4 text-center">
      <!-- TN State Silhouette Background -->
      <div class="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 500 120" fill="none" stroke="#d91f26" stroke-width="3" class="w-[90%] max-w-4xl" xmlns="http://www.w3.org/2000/svg">
          <path d="M20,40 L120,30 L220,20 L350,15 L480,25 L475,70 L430,75 L410,95 L370,100 L320,105 L260,110 L200,105 L150,100 L80,105 L25,95 Z" />
        </svg>
      </div>

      <div class="relative z-10 max-w-4xl mx-auto space-y-6">
        <h1 class="font-display text-6xl md:text-8xl lg:text-9xl tracking-tight leading-none uppercase text-white drop-shadow-2xl">
          Slow <span class="text-[#d91f26]">&amp;</span> Easley<br/>
          <span class="text-4xl md:text-6xl lg:text-7xl block mt-2 text-zinc-300">${restaurant.tagline}</span>
        </h1>
        <p class="text-xl md:text-2xl text-zinc-400 font-medium max-w-2xl mx-auto mt-6">
          Authentic Tennessee BBQ, crispy fried whitefish, and down-home soul food.
        </p>
        
        <div class="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="/menu/" class="w-full sm:w-auto bg-[#d91f26] text-white font-display text-xl tracking-widest uppercase px-8 py-4 hover:bg-white hover:text-[#d91f26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            View Menu
          </a>
          ${hasRealPhone ? `
          <a href="tel:${restaurant.phone}" class="w-full sm:w-auto border-2 border-white text-white font-display text-xl tracking-widest uppercase px-8 py-4 hover:bg-white hover:text-[#0a0a0a] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f26]">
            Call to Order
          </a>
          ` : `
          <span class="w-full sm:w-auto border-2 border-zinc-600 text-zinc-400 font-display text-xl tracking-widest uppercase px-8 py-4 cursor-not-allowed" title="Phone number coming soon">
            Call to Order (Soon)
          </span>
          `}
        </div>
      </div>
    </section>

    <section id="menu" class="py-20 px-4 border-t border-zinc-900 text-center">
      <p class="text-[#ff5259] uppercase tracking-[.22em] text-sm font-semibold">What we're serving</p>
      <h2 class="font-display text-5xl md:text-7xl uppercase mt-3 mb-4">The good stuff</h2>
      <p class="text-zinc-300 max-w-xl mx-auto mb-8">BBQ, fried whitefish, soul-food sides and more. Browse the full menu and build your order.</p>
      <a href="/menu/" class="inline-block bg-[#d91f26] text-white font-display text-2xl tracking-wider uppercase px-10 py-4 hover:bg-white hover:text-black">See the menu &amp; order</a>
    </section>

    <!-- About Section -->
    <section id="about" class="py-24 px-4 bg-zinc-950 relative border-y border-zinc-900">
      <div class="container mx-auto max-w-4xl text-center">
        <h2 class="font-display text-5xl md:text-6xl tracking-widest uppercase mb-8">The Smokehouse</h2>
        <div class="space-y-6 text-lg md:text-xl text-zinc-300 leading-relaxed">
          <p>
            Welcome to Slow &amp; Easley BBQ &amp; Soul Food. We believe in taking our time. Authentic Tennessee BBQ isn't rushed—it's slow-smoked over hardwoods until it's fall-off-the-bone tender.
          </p>
          <p>
            Located right here in ${displayCity}, we serve up more than just pulled pork and smoked wings. We're proud of our scratch-made soul food and our famous crispy fried whitefish, made exactly the way it should be.
          </p>
          <p class="font-display text-3xl text-[#d91f26] pt-6 tracking-widest uppercase">
            Real Smoke. Real Soul.
          </p>
        </div>
      </div>
    </section>

    <!-- Hours & Location -->
    <section id="location" class="py-24 px-4">
      <div class="container mx-auto max-w-6xl">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 class="font-display text-5xl md:text-6xl tracking-widest uppercase mb-4">Come &amp; Get It</h2>
            <div class="w-24 h-1 bg-[#d91f26] mb-12"></div>
            
            <div class="space-y-10">
              <div>
                <h3 class="font-display text-2xl text-[#d91f26] tracking-wider uppercase mb-3 flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  Location
                </h3>
                <p class="text-zinc-300 text-xl">
             ${hasRealAddress && hasRealCoordinates ? `
                    ${restaurant.address.street}<br/>
                    ${displayCity}, ${restaurant.address.region} ${restaurant.address.postalCode}
                  ` : `
                    Address Pending<br/>
                    ${displayCity}, ${restaurant.address.region}
                  `}
                </p>
              </div>
              
              <div>
                <h3 class="font-display text-2xl text-[#d91f26] tracking-wider uppercase mb-3 flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Hours
                </h3>
                <p class="text-zinc-300 text-xl">
                  ${hasRealHours ? restaurant.hours : 'Hours Pending'}
                </p>
              </div>
              
              <div>
                <h3 class="font-display text-2xl text-[#d91f26] tracking-wider uppercase mb-3 flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  Contact
                </h3>
                ${hasRealPhone ? `
                  <a href="tel:${restaurant.phone}" class="text-zinc-300 hover:text-[#d91f26] text-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f26]">${restaurant.displayPhone}</a>
                ` : `
                  <span class="text-zinc-300 text-xl">Phone Pending</span>
                `}
              </div>
            </div>
          </div>
          
          <div class="relative w-full aspect-video md:aspect-square lg:aspect-video bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden">
            ${hasRealAddress ? `
            <a href="https://maps.google.com/?q=${restaurant.geo.latitude},${restaurant.geo.longitude}" target="_blank" rel="noopener noreferrer" aria-label="Open location in Google Maps" class="absolute inset-0 group focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#d91f26]">
              <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23111'/%3E%3Cpath d='M0,100 L800,200 M0,300 L800,100 M200,0 L300,600 M600,0 L500,600' stroke='%23222' stroke-width='4'/%3E%3Ctext x='400' y='300' font-family='sans-serif' font-size='24' fill='%23666' text-anchor='middle'%3EMAP PLACEHOLDER%3C/text%3E%3C/svg%3E" alt="Map placeholder for Slow &amp; Easley location" class="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" loading="lazy" width="800" height="600" />
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <div class="bg-[#d91f26] text-white p-4 rounded-full mb-3 shadow-[0_0_20px_rgba(217,31,38,0.5)] group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                </div>
                <span class="bg-[#0a0a0a]/90 font-display tracking-widest uppercase px-6 py-2 text-white border border-zinc-800 group-hover:border-[#d91f26] transition-colors">Get Directions</span>
              </div>
            </a>
            ` : `
            <div class="absolute inset-0 group">
              <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23111'/%3E%3Cpath d='M0,100 L800,200 M0,300 L800,100 M200,0 L300,600 M600,0 L500,600' stroke='%23222' stroke-width='4'/%3E%3Ctext x='400' y='300' font-family='sans-serif' font-size='24' fill='%23666' text-anchor='middle'%3ELOCATION PENDING%3C/text%3E%3C/svg%3E" alt="Location pending map placeholder" class="w-full h-full object-cover opacity-30" loading="lazy" width="800" height="600" />
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="bg-[#0a0a0a]/90 font-display tracking-widest uppercase px-6 py-2 text-zinc-300 border border-zinc-800">Map Coming Soon</span>
              </div>
            </div>
            `}
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="bg-zinc-950 pt-16 pb-24 md:pb-12 border-t border-zinc-900 text-center md:text-left relative z-20">
    <div class="container mx-auto px-4 max-w-6xl">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        <div>
          <h4 class="font-display text-2xl tracking-widest uppercase mb-4 text-white">Slow &amp; Easley</h4>
          <p class="text-zinc-400">Tennessee BBQ &amp; Soul Food</p>
        </div>
        
        <div>
          <h4 class="font-display text-xl tracking-widest uppercase mb-4 text-white">Visit Us</h4>
          <address class="not-italic text-zinc-300">
            ${hasRealAddress ? `
              ${restaurant.address.street}<br/>
              ${displayCity}, ${restaurant.address.region} ${restaurant.address.postalCode}<br/><br/>
            ` : `
              Address Pending<br/>
              ${displayCity}, ${restaurant.address.region}<br/><br/>
            `}
            ${hasRealPhone ? `
              <a href="tel:${restaurant.phone}" class="hover:text-[#d91f26] transition-colors">${restaurant.displayPhone}</a>
            ` : `
              <span class="cursor-not-allowed">Phone Pending</span>
            `}
          </address>
        </div>
        
        <div>
          <h4 class="font-display text-xl tracking-widest uppercase mb-4 text-white">Connect</h4>
          <div class="flex justify-center md:justify-start space-x-6">
            ${hasRealSocialFacebook ? `
            <a href="${restaurant.social.facebook}" aria-label="Follow us on Facebook" class="text-zinc-400 hover:text-[#d91f26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f26]">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
            </a>
            ` : `
            <span class="text-zinc-400" role="img" aria-label="Facebook coming soon" title="Facebook coming soon">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
            </span>
            `}
            ${hasRealSocialInstagram ? `
            <a href="${restaurant.social.instagram}" aria-label="Follow us on Instagram" class="text-zinc-400 hover:text-[#d91f26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f26]">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            </a>
            ` : `
            <span class="text-zinc-400" role="img" aria-label="Instagram coming soon" title="Instagram coming soon">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            </span>
            `}
          </div>
        </div>
      </div>
      
      <div class="border-t border-zinc-900 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-zinc-400">
        <p>&copy; ${new Date().getFullYear()} ${restaurant.name}. All rights reserved.</p>
        <p class="mt-4 md:mt-0">Built for speed.</p>
      </div>
    </div>
  </footer>

  <!-- Sticky Mobile Call Button -->
  ${hasRealPhone ? `
  <div class="fixed bottom-0 left-0 w-full md:hidden z-[100]">
    <a href="tel:${restaurant.phone}" aria-label="Call Now" class="flex items-center justify-center w-full bg-[#d91f26] text-white py-5 font-display text-2xl tracking-widest uppercase shadow-[0_-4px_20px_rgba(0,0,0,0.5)] active:bg-white active:text-[#d91f26] transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      Call Now
    </a>
  </div>
  ` : `
  <div class="fixed bottom-0 left-0 w-full md:hidden z-[100]">
    <div class="flex items-center justify-center w-full bg-zinc-900 text-zinc-500 py-5 font-display text-2xl tracking-widest uppercase shadow-[0_-4px_20px_rgba(0,0,0,0.5)] cursor-not-allowed">
      Call Now (Soon)
    </div>
  </div>
  `}

</body>
</html>`;

// Keep the delivered HTML compact without changing text content or structured data.
fs.writeFileSync(path.join(__dirname, 'index.html'), html.replace(/\n[ \t]+/g, ' ').replace(/>\s+</g, '><').trim(), 'utf-8');

// A separate, statically rendered menu page. Ordering is a progressive enhancement:
// the cards and prices remain available to search engines and no-script visitors.
const homeHead = html.match(/<head>[\s\S]*?<\/head>/)[0];
const menuHead = homeHead
  .replace(`<title>${restaurant.name} | Tennessee BBQ</title>`, `<title>Menu &amp; Order | ${restaurant.name}</title>`)
  .replace(`Smoked BBQ, fried whitefish, and scratch-made soul food in ${displayCity}. View our menu and order today.`, `Explore the full Slow & Easley BBQ & Soul Food menu, add your favorites to an order, then text us to confirm availability and pickup.`)
  .replace(`<meta property="og:title" content="${restaurant.name}">`, `<meta property="og:title" content="Menu &amp; Order | ${restaurant.name}">`)
  .replace(`<meta name="twitter:title" content="${restaurant.name}">`, `<meta name="twitter:title" content="Menu &amp; Order | ${restaurant.name}">`)
  .replace(`<meta property="og:url" content="${siteUrl}">`, `<meta property="og:url" content="${siteUrl}/menu/">`)
  .replace(`<link rel="canonical" href="${siteUrl}">`, `<link rel="canonical" href="${siteUrl}/menu/">`)
  .replace('</head>', '  <script type="module" src="/src/menu-order.js"></script>\n</head>');
const menuHeader = html.match(/<!-- Header \/ Nav -->[\s\S]*?<\/header>/)[0]
  .replace('href="#" aria-label="S&E BBQ home"', 'href="/" aria-label="S&E BBQ home"')
  .replace('href="#about"', 'href="/#about"')
  .replace('href="#location"', 'href="/#location"');
const menuFooter = html.match(/<!-- Footer -->[\s\S]*?<\/footer>/)[0];
const menuHtml = `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
${menuHead}
<body class="font-sans antialiased bg-[#0a0a0a] text-white overflow-x-hidden pt-[60px] md:pt-[76px]">
${menuHeader}
<main id="main" class="order-page">
  <div class="order-hero">
    <p class="menu-kicker">Slow smoked · Made with soul</p>
    <h1>The menu<span class="hero-period">.</span></h1>
    <p>Pick your favorites. We’ll get the details ready for you to text us.</p>
    <div class="order-hero-actions">
      <a href="#category-0">Explore the menu ↓</a>
      <button type="button" data-open-cart>View order <span data-cart-count>0</span></button>
    </div>
  </div>
  <div class="order-layout">
    <nav class="category-nav" aria-label="Menu categories">
      ${menu.map((section, i) => `<a href="#category-${i}">${section.category}</a>`).join('')}
    </nav>
    ${renderOrderMenu()}
  </div>
  <div class="order-ending"><span>Good food takes time.</span><p>Call or text to confirm your order and pickup details.</p></div>
  <noscript><p class="text-center p-6">To build an order, enable JavaScript, or call us at <a href="tel:${restaurant.phone}">${restaurant.displayPhone}</a>.</p></noscript>
</main>
${menuFooter}
<button class="floating-cart" type="button" data-open-cart aria-label="View order"><span>View order</span><span data-cart-count>0</span></button>
<dialog id="item-dialog" class="order-dialog" aria-labelledby="item-dialog-title">
  <form id="item-form">
    <div class="dialog-heading"><div><p class="menu-kicker">Make it yours</p><h2 id="item-dialog-title"></h2></div><button class="dialog-close" type="button" data-close aria-label="Close">×</button></div>
    <div id="item-options"></div>
    <button class="dialog-primary" type="submit">Add to order <span id="item-dialog-price"></span></button>
  </form>
</dialog>
<dialog id="cart-dialog" class="order-dialog cart-dialog" aria-labelledby="cart-title">
  <div class="dialog-heading"><div><p class="menu-kicker">Your favorites</p><h2 id="cart-title">Your order</h2></div><button class="dialog-close" type="button" data-close aria-label="Close">×</button></div>
  <div id="cart-items"></div>
  <div class="cart-summary"><span>Estimated subtotal</span><strong id="cart-subtotal">$0.00</strong></div>
  <p class="cart-disclaimer">Tax, availability, and pickup details are confirmed by the restaurant. This is not a placed or paid order.</p>
  <a id="text-order" class="dialog-primary" href="sms:${restaurant.phone}">Text this order</a>
  <button id="preview-checkout" class="dialog-secondary" type="button" disabled>Preview Square checkout · demo</button>
  <button id="copy-order" class="dialog-secondary" type="button">Copy order details</button>
  <a class="call-order" href="tel:${restaurant.phone}">Or call ${restaurant.displayPhone}</a>
  <p id="cart-status" role="status" aria-live="polite"></p>
</dialog>
<dialog id="checkout-dialog" class="order-dialog checkout-dialog" aria-labelledby="checkout-title">
  <div class="dialog-heading"><div><p class="menu-kicker">Checkout preview</p><h2 id="checkout-title">Review your order</h2></div><button class="dialog-close" type="button" data-close aria-label="Close">×</button></div>
  <p class="checkout-demo-banner"><strong>Demo only</strong> — Square is not connected. No payment or order can be submitted here.</p>
  <div class="checkout-steps" aria-label="Checkout steps"><span class="is-current">1. Review</span><span>2. Pickup</span><span>3. Square payment</span></div>
  <div class="checkout-section-heading"><h3>Your items</h3><button id="edit-order" type="button">Edit order</button></div>
  <div id="checkout-items" class="checkout-items"></div>
  <div class="checkout-totals">
    <div><span>Subtotal</span><strong id="checkout-subtotal"></strong></div>
    <div><span>Tax &amp; fees</span><span>Calculated at live checkout</span></div>
    <div class="checkout-total"><span>Estimated total before tax</span><strong id="checkout-total"></strong></div>
  </div>
  <div class="checkout-next">
    <span class="checkout-next-number">02 / Pickup &amp; payment</span>
    <p>When checkout is connected, customers will confirm pickup details and continue to Square’s secure payment page.</p>
    <button type="button" disabled>Continue to Square — not connected</button>
    <small>No card details are requested or stored in this demo.</small>
  </div>
</dialog>
</body>
</html>`;
fs.mkdirSync(path.join(__dirname, 'menu'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'menu', 'index.html'), menuHtml.replace(/\n[ \t]+/g, ' ').replace(/>\s+</g, '><').trim(), 'utf-8');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/menu/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf-8');

const robots = `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml`;

fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots, 'utf-8');

console.log('✅ Generated home, menu, sitemap.xml, and robots.txt from menu-data.js');
