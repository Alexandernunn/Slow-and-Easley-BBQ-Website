import { api, escapeHtml, estimatedUnit, getCart, money, orderLines } from './order-store.js';

const form = document.querySelector('#checkout-form');
const status = document.querySelector('#checkout-status');
const errorNode = document.querySelector('#checkout-error');
const slotSelect = document.querySelector('#checkout-pickup-slot');
const hoursNode = document.querySelector('#checkout-hours-status');
const payButton = document.querySelector('#checkout-pay-button');
const summary = document.querySelector('#checkout-order-summary');
const total = document.querySelector('#checkout-total');
const PENDING_KEY = 'slow-easley-pending-payment-v1';
const RECEIPT_KEY = 'slow-easley-confirmed-order-v1';
const zone = 'America/Chicago';
let cart = getCart();
let catalog = new Map();
let quote = null;
let card = null;
let payments = null;
let processing = false;
let ready = false;

const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const pickupLabel = new Intl.DateTimeFormat('en-US', {
  timeZone: zone, weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  timeZoneName: 'short'
});

function error(message) {
  errorNode.textContent = message;
  errorNode.hidden = !message;
}

function nowOpen(now = new Date()) {
  const fields = Object.fromEntries(clock.formatToParts(now).map(({ type, value }) => [type, value]));
  const minutes = Number(fields.hour) * 60 + Number(fields.minute);
  return ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(fields.weekday)
    && minutes >= 11 * 60 && minutes <= 19 * 60 + 30;
}

function updateButton() {
  payButton.disabled = !ready || !card || !quote || !slotSelect.value || !nowOpen() || processing;
  if (quote) payButton.firstChild.textContent = `Pay ${money(quote.amountCents)} for pickup `;
}

function updateSlots() {
  const now = new Date();
  const previous = slotSelect.value;
  slotSelect.innerHTML = '<option value="">Choose a pickup time</option>';
  if (!nowOpen(now)) {
    let nextOpen = '';
    for (let offset = 15 * 60_000; offset < 8 * 24 * 60 * 60_000; offset += 15 * 60_000) {
      const candidate = new Date(Math.ceil((now.getTime() + offset) / 900_000) * 900_000);
      const parts = Object.fromEntries(clock.formatToParts(candidate).map(({ type, value }) => [type, value]));
      if (['Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(parts.weekday) &&
        parts.hour === '11' && parts.minute === '00') {
        nextOpen = pickupLabel.format(candidate);
        break;
      }
    }
    hoursNode.textContent = `Online ordering is closed. We open ${nextOpen || 'Wednesday at 11 AM Central'}. Call us for help.`;
    slotSelect.disabled = true;
    updateButton();
    return;
  }
  for (let t = Math.ceil((now.getTime() + 20 * 60_000) / 900_000) * 900_000;
    t < now.getTime() + 7 * 86400_000; t += 900_000) {
    const time = new Date(t);
    const fields = Object.fromEntries(clock.formatToParts(time).map(({ type, value }) => [type, value]));
    const minutes = Number(fields.hour) * 60 + Number(fields.minute);
    if (!['Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(fields.weekday) ||
      minutes < 11 * 60 || minutes > 19 * 60 + 30) continue;
    const option = new Option(pickupLabel.format(time), time.toISOString());
    slotSelect.add(option);
  }
  slotSelect.disabled = slotSelect.options.length < 2;
  slotSelect.value = previous && [...slotSelect.options].some(option => option.value === previous) ? previous : '';
  hoursNode.textContent = slotSelect.disabled
    ? 'No pickup times are available. Please call us.'
    : 'Pickup Wednesday–Sunday, 11:00 AM–7:30 PM Central. Choose a time at least 20 minutes ahead.';
  updateButton();
}

function renderCart() {
  const rows = orderLines(cart, catalog);
  if (!rows.length || rows.length !== cart.length) {
    throw new Error('Your saved order contains an item that is no longer available in Square. Return to the menu and rebuild your order.');
  }
  summary.innerHTML = rows.map(({ row, item }) => {
    const options = item.modifiers.flatMap(group => group.options).filter(option => row.modifierIds.includes(option.id));
    return `<li class="se-checkout-item"><div><strong>${row.quantity} × ${escapeHtml(item.name)}</strong>
      ${options.length ? `<small>${options.map(option => escapeHtml(option.name)).join(', ')}</small>` : ''}
      ${row.notes ? `<small>Note: ${escapeHtml(row.notes)}</small>` : ''}</div>
      <span>${money(estimatedUnit(item, row.modifierIds) * row.quantity)}</span></li>`;
  }).join('');
}

async function getQuote() {
  const result = await api('quote-order', {
    method: 'POST', body: JSON.stringify({ items: cart })
  });
  if (result.currency !== 'USD' || !Number.isSafeInteger(result.amountCents) || result.amountCents < 1) {
    throw new Error('Square did not return a valid total. Please call to order.');
  }
  quote = result;
  total.textContent = money(quote.amountCents);
  updateButton();
}

function loadSquareScript(environment) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = environment === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Square payment form could not load. Please call us.'));
    document.head.append(script);
  });
}

async function completePayment(sourceId) {
  if (processing || !ready || !quote || !slotSelect.value || !nowOpen()) {
    error('Online ordering is unavailable or closed. Please call the restaurant.');
    return;
  }
  if (!form.reportValidity()) {
    error('Please complete your name, phone, email, and pickup time before paying.');
    return;
  }
  processing = true;
  updateButton();
  error('');
  status.textContent = 'Checking your total and processing payment. Please do not leave this page.';
  try {
    const current = await api('quote-order', { method: 'POST', body: JSON.stringify({ items: cart }) });
    if (current.amountCents !== quote.amountCents) {
      quote = current;
      total.textContent = money(quote.amountCents);
      ready = false;
      throw new Error('Square updated your total. Please refresh checkout, review the updated total, and tokenize a new payment.');
    }
    const attemptId = crypto.randomUUID();
    sessionStorage.setItem(PENDING_KEY, attemptId);
    const items = cart.map((row, index) => ({
      variationId: row.variationId, quantity: row.quantity,
      modifierIds: row.modifierIds,
      notes: index === 0
        ? [row.notes, document.querySelector('#checkout-item-notes').value.trim()].filter(Boolean).join(' | ').slice(0, 500)
        : row.notes
    }));
    const receipt = await api('create-order', {
      method: 'POST',
      body: JSON.stringify({
        attemptId, sourceId, items, expectedAmountCents: quote.amountCents,
        customer: {
          name: document.querySelector('#checkout-name').value.trim(),
          phone: document.querySelector('#checkout-phone').value.trim(),
          email: document.querySelector('#checkout-email').value.trim()
        },
        pickupAt: slotSelect.value
      })
    });
    if (!receipt.paymentId || !receipt.orderId || !receipt.orderNumber || receipt.amountCents !== quote.amountCents) {
      throw new Error('Payment status is uncertain. Do not pay again; call the restaurant to check your order.');
    }
    sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
    sessionStorage.removeItem(PENDING_KEY);
    localStorage.removeItem('slow-easley-square-cart-v2');
    location.assign(`${import.meta.env.BASE_URL}confirmation/`);
  } catch (caught) {
    status.textContent = '';
    if (caught.paymentAttempted === false && caught.orderCanceled === true) {
      sessionStorage.removeItem(PENDING_KEY);
      ready = false;
      error(`${caught.message} Refresh checkout to review the latest total before paying.`);
    } else if (caught.status === 402 && caught.orderCanceled === true) {
      sessionStorage.removeItem(PENDING_KEY);
      error(`${caught.message} Your card was not approved. Please try another payment method or call us.`);
    } else {
      error(caught.message || 'Payment could not be confirmed. Do not try again; call the restaurant.');
      if (sessionStorage.getItem(PENDING_KEY)) {
        ready = false;
        error('We could not confirm whether your payment completed. Do not pay again. Call (615) 988-0697 with your name to check your order.');
      }
    }
  } finally {
    processing = false;
    updateButton();
  }
}

function paymentRequest() {
  return payments.paymentRequest({
    countryCode: 'US', currencyCode: 'USD',
    total: { amount: (quote.amountCents / 100).toFixed(2), label: 'Slow & Easley pickup order' }
  });
}

async function attachWallet(name, selector) {
  try {
    const wallet = await payments[name](paymentRequest());
    await wallet.attach(selector);
    document.querySelector(selector).hidden = false;
    return wallet;
  } catch {
    document.querySelector(selector).hidden = true;
    return null;
  }
}

async function boot() {
  if (!cart.length) {
    summary.innerHTML = '<li>Your order is empty. <a href="/menu/">Return to the menu</a> to choose your food.</li>';
    throw new Error('Your cart is empty. Please choose items from the menu or call us.');
  }
  if (sessionStorage.getItem(PENDING_KEY)) {
    throw new Error('A previous payment could not be confirmed. Do not pay again. Call (615) 988-0697 to check the order.');
  }
  const [config, result] = await Promise.all([api('square-config'), api('get-menu')]);
  if (!['production', 'sandbox'].includes(config.environment)) throw new Error('Square ordering is not configured.');
  catalog = new Map(result.items.map(item => [item.variationId, item]));
  renderCart();
  await getQuote();
  updateSlots();
  if (slotSelect.disabled) return;
  await loadSquareScript(config.environment);
  if (!window.Square) throw new Error('Square payment form did not initialize. Please call us.');
  payments = window.Square.payments(config.applicationId, config.locationId);
  card = await payments.card();
  await card.attach('#checkout-card');
  ready = true;
  status.textContent = 'Secure card payment is ready.';
  updateButton();

  // Wallets are optional and only shown on supported devices/browsers.
  const [apple, google] = await Promise.all([
    attachWallet('applePay', '#checkout-apple-pay'),
    attachWallet('googlePay', '#checkout-google-pay')
  ]);
  for (const [wallet, selector] of [[apple, '#checkout-apple-pay'], [google, '#checkout-google-pay']]) {
    if (!wallet) continue;
    document.querySelector(selector).addEventListener('click', async () => {
      try {
        const result = await wallet.tokenize();
        if (result.status === 'OK') await completePayment(result.token);
        else error('Wallet payment was not approved. Please try again or use a card.');
      } catch { error('Wallet payment was cancelled or unavailable.'); }
    });
  }
  try {
    const cash = await payments.cashAppPay(paymentRequest(), {
      redirectURL: location.href, referenceId: crypto.randomUUID()
    });
    cash.addEventListener('ontokenization', async event => {
      if (event.detail?.tokenResult?.status === 'OK') await completePayment(event.detail.tokenResult.token);
      else error('Cash App Pay was cancelled or unavailable.');
    });
    await cash.attach('#checkout-cash-app-pay');
    document.querySelector('#checkout-cash-app-pay').hidden = false;
  } catch {
    document.querySelector('#checkout-cash-app-pay').hidden = true;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!card || processing || !form.reportValidity()) return;
  try {
    error('');
    const result = await card.tokenize();
    if (result.status !== 'OK') {
      error('Check your card details and try again.');
      return;
    }
    await completePayment(result.token);
  } catch {
    error('Square could not tokenize this card. Check your card details or call us.');
  }
});
slotSelect.addEventListener('change', updateButton);
setInterval(updateSlots, 60_000);
updateSlots();
boot().catch(caught => {
  error(caught.message || 'Online ordering is unavailable. Please call us.');
  status.textContent = '';
  slotSelect.disabled = true;
  payButton.disabled = true;
});