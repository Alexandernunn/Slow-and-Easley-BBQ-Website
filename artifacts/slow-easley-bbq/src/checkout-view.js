import { restaurant } from '../menu-data.js';

// Page-body markup only. The generator owns the document shell; checkout.js
// owns cart rendering, pickup availability, Square mounts, and submission.
export function checkoutView() {
  return `
    <main id="main" class="se-checkout-page">
      <div class="se-checkout-wrap">
        <nav class="se-checkout-back" aria-label="Checkout navigation">
          <a href="/menu/" data-testid="link-back-to-menu"><span aria-hidden="true">←</span> Back to the menu</a>
          <span class="se-checkout-back-divider" aria-hidden="true"></span>
          <span>Pickup order</span>
        </nav>

        <header class="se-checkout-intro">
          <div>
            <p class="se-checkout-kicker">Slow &amp; Easley <span aria-hidden="true">/</span> Pickup checkout</p>
            <h1>Good food.<br><span>Almost yours.</span></h1>
          </div>
          <div class="se-checkout-intro-aside">
            <span class="se-checkout-pickup-tag">Pickup only</span>
            <p>Review your order, pick a time, then pay securely. We&rsquo;ll have it ready at the counter.</p>
          </div>
        </header>

        <div class="se-checkout-grid">
          <div class="se-checkout-primary">
            <form id="checkout-form" class="se-checkout-form" novalidate>
              <section class="se-checkout-section" aria-labelledby="se-details-heading">
                <div class="se-checkout-section-head">
                  <span class="se-checkout-index" aria-hidden="true">01</span>
                  <div>
                    <p class="se-checkout-eyebrow">First things first</p>
                    <h2 id="se-details-heading">Who&rsquo;s picking up?</h2>
                  </div>
                </div>
                <div class="se-checkout-fields">
                  <div class="se-checkout-field se-checkout-field-wide">
                    <label for="checkout-name">Name <span aria-hidden="true">*</span></label>
                    <input id="checkout-name" name="name" type="text" autocomplete="name" required maxlength="100" placeholder="Your name" data-testid="input-checkout-name">
                  </div>
                  <div class="se-checkout-field">
                    <label for="checkout-phone">Phone <span aria-hidden="true">*</span></label>
                    <input id="checkout-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30" placeholder="(615) 555-0123" data-testid="input-checkout-phone">
                  </div>
                  <div class="se-checkout-field">
                    <label for="checkout-email">Email <span aria-hidden="true">*</span></label>
                    <input id="checkout-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com" data-testid="input-checkout-email">
                  </div>
                </div>
                <p class="se-checkout-help">Your receipt and order updates go to this email.</p>
              </section>

              <section class="se-checkout-section" aria-labelledby="se-pickup-heading">
                <div class="se-checkout-section-head">
                  <span class="se-checkout-index" aria-hidden="true">02</span>
                  <div>
                    <p class="se-checkout-eyebrow">Come &amp; get it</p>
                    <h2 id="se-pickup-heading">Pickup time</h2>
                  </div>
                </div>
                <div class="se-checkout-pickup-box">
                  <div class="se-checkout-location-label">Pickup at Slow &amp; Easley BBQ</div>
                  <address>${restaurant.address.street}<br>${restaurant.address.city}, ${restaurant.address.region} ${restaurant.address.postalCode}</address>
                  <p class="se-checkout-hours">Open ${restaurant.hours}</p>
                </div>
                <div class="se-checkout-field">
                  <label for="checkout-pickup-slot">Choose a pickup time <span aria-hidden="true">*</span></label>
                  <select id="checkout-pickup-slot" name="pickupSlot" required aria-describedby="checkout-hours-status" data-testid="select-checkout-pickup-slot">
                    <option value="">Checking available times…</option>
                  </select>
                  <p id="checkout-hours-status" class="se-checkout-availability" role="status" aria-live="polite" data-testid="status-checkout-hours">Checking pickup hours and availability…</p>
                </div>
              </section>

              <section class="se-checkout-section" aria-labelledby="se-payment-heading">
                <div class="se-checkout-section-head">
                  <span class="se-checkout-index" aria-hidden="true">03</span>
                  <div>
                    <p class="se-checkout-eyebrow">Last stop</p>
                    <h2 id="se-payment-heading">Payment</h2>
                  </div>
                </div>
                <p class="se-checkout-help se-checkout-payment-intro">Pay securely with Square. Your card details are entered in Square&rsquo;s payment form, not on this site.</p>
                <div class="se-checkout-field">
                  <span class="se-checkout-field-label" id="se-card-label">Card</span>
                  <div id="checkout-card" class="se-checkout-card-mount" aria-labelledby="se-card-label" data-testid="mount-checkout-card"></div>
                </div>
                <div class="se-checkout-wallets" aria-label="Other payment methods">
                  <div id="checkout-apple-pay" class="se-checkout-wallet-mount" data-testid="mount-checkout-apple-pay"></div>
                  <div id="checkout-google-pay" class="se-checkout-wallet-mount" data-testid="mount-checkout-google-pay"></div>
                  <div id="checkout-cash-app-pay" class="se-checkout-wallet-mount" data-testid="mount-checkout-cash-app-pay"></div>
                </div>
                <button id="checkout-pay-button" class="se-checkout-pay" type="submit" disabled data-testid="button-checkout-pay">
                  Pay for pickup <span aria-hidden="true">→</span>
                </button>
                <p id="checkout-error" class="se-checkout-error" role="alert" hidden data-testid="status-checkout-error"></p>
                <p id="checkout-status" class="se-checkout-status" role="status" aria-live="polite" data-testid="status-checkout-payment"></p>
                <p class="se-checkout-final-note">Your order is not placed until payment is confirmed.</p>
              </section>
            </form>
          </div>

          <aside class="se-checkout-summary" aria-labelledby="se-summary-heading">
            <div class="se-checkout-summary-top">
              <div>
                <p class="se-checkout-eyebrow">Before the smoke clears</p>
                <h2 id="se-summary-heading">Your order</h2>
              </div>
              <a href="/menu/" data-testid="link-edit-order">Edit order</a>
            </div>
            <ul id="checkout-order-summary" class="se-checkout-items" aria-live="polite" data-testid="list-checkout-order-summary">
              <li class="se-checkout-items-pending">Loading your order…</li>
            </ul>
            <div class="se-checkout-field se-checkout-notes">
              <label for="checkout-item-notes">Notes for the kitchen <span class="se-checkout-optional">(optional)</span></label>
              <textarea id="checkout-item-notes" name="itemNotes" rows="3" maxlength="500" placeholder="Anything we should know about your order?" data-testid="input-checkout-item-notes"></textarea>
            </div>
            <div class="se-checkout-total-row">
              <span>Total</span>
              <strong id="checkout-total" aria-live="polite" data-testid="text-checkout-total">—</strong>
            </div>
            <p class="se-checkout-total-note">Final total is shown before you pay.</p>
            <div class="se-checkout-summary-footer">
              <span class="se-checkout-rule" aria-hidden="true"></span>
              <p>Rather order by phone?</p>
              <a id="checkout-call-fallback" href="tel:${restaurant.phone}" data-testid="link-checkout-call-fallback">Call ${restaurant.displayPhone}</a>
            </div>
          </aside>
        </div>
      </div>
    </main>`;
}

export function confirmationView() {
  return `
    <main id="main" class="se-checkout-page se-confirmation-page">
      <div class="se-checkout-wrap">
        <nav class="se-checkout-back" aria-label="Confirmation navigation">
          <a href="/" data-testid="link-confirmation-home"><span aria-hidden="true">←</span> Back home</a>
          <span class="se-checkout-back-divider" aria-hidden="true"></span>
          <span>Pickup confirmation</span>
        </nav>

        <header class="se-confirmation-hero">
          <p class="se-checkout-kicker">Slow &amp; Easley <span aria-hidden="true">/</span> Pickup order</p>
          <div class="se-confirmation-mark" aria-hidden="true">S&amp;E</div>
           <h1 id="confirmation-heading">Checking order<span>.</span></h1>
           <p id="confirmation-message">We&rsquo;re checking your payment confirmation.</p>
        </header>

        <div class="se-confirmation-grid">
          <section class="se-confirmation-receipt" aria-labelledby="se-confirmation-order-heading">
            <div class="se-confirmation-receipt-head">
              <div>
                <p class="se-checkout-eyebrow">Keep this handy</p>
                <h2 id="se-confirmation-order-heading">Your receipt</h2>
              </div>
              <div class="se-confirmation-number">
                <span>Order number</span>
                <strong id="confirmation-order-number" data-testid="text-confirmation-order-number">—</strong>
              </div>
            </div>
            <h3 class="se-confirmation-list-heading">What you ordered</h3>
            <ul id="confirmation-items" class="se-checkout-items" data-testid="list-confirmation-items">
              <li class="se-checkout-items-pending">Loading order details…</li>
            </ul>
            <div class="se-checkout-total-row">
              <span>Paid total</span>
              <strong id="confirmation-total" data-testid="text-confirmation-total">—</strong>
            </div>
          </section>

          <aside class="se-confirmation-pickup" aria-labelledby="se-confirmation-pickup-heading">
            <p class="se-checkout-eyebrow">Next up</p>
            <h2 id="se-confirmation-pickup-heading">Come &amp; get it.</h2>
            <div class="se-confirmation-detail">
              <span>Pickup time</span>
              <strong id="confirmation-pickup" data-testid="text-confirmation-pickup">—</strong>
            </div>
            <div class="se-confirmation-detail">
              <span>Pickup address</span>
              <address id="confirmation-address" data-testid="text-confirmation-address">${restaurant.address.street}<br>${restaurant.address.city}, ${restaurant.address.region} ${restaurant.address.postalCode}</address>
            </div>
            <p class="se-confirmation-help">Questions about your order? Give us a call.</p>
            <a id="confirmation-call-link" class="se-confirmation-call" href="tel:${restaurant.phone}" data-testid="link-confirmation-call">Call ${restaurant.displayPhone} <span aria-hidden="true">→</span></a>
          </aside>
        </div>
        <div class="se-confirmation-bottom">
          <p>See you soon.</p>
          <a href="/menu/" data-testid="link-confirmation-menu">Back to the menu <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </main>`;
}