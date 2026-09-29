import { CART_KEY, escapeHtml, money } from './order-store.js';

const heading = document.querySelector('#confirmation-heading');
const message = document.querySelector('#confirmation-message');
let order;
try {
  order = JSON.parse(sessionStorage.getItem('slow-easley-confirmed-order-v1') || 'null');
} catch { order = null; }
if (!order?.paymentId || !order?.orderId || !order?.orderNumber || !Number.isSafeInteger(order?.amountCents)) {
  heading.textContent = 'No confirmed order.';
  message.textContent = 'This page only shows after Square confirms payment. If you recently tried to pay, call us to check the order before trying again.';
  document.querySelector('.se-confirmation-grid').hidden = true;
} else {
  heading.innerHTML = 'Order received<span>.</span>';
  message.textContent = 'Payment confirmed. We’ll get to work; you come hungry.';
  document.querySelector('#confirmation-order-number').textContent = order.orderNumber;
  document.querySelector('#confirmation-items').innerHTML = order.items.map(item =>
    `<li class="se-checkout-item"><div><strong>${item.quantity} × ${escapeHtml(item.name)}</strong>
      ${item.modifiers?.length ? `<small>${item.modifiers.map(modifier => escapeHtml(modifier.name)).join(', ')}</small>` : ''}
      ${item.notes ? `<small>Note: ${escapeHtml(item.notes)}</small>` : ''}</div>
      <span>${money((item.unitPriceCents ?? item.priceCents) * item.quantity)}</span></li>`).join('');
  document.querySelector('#confirmation-total').textContent = money(order.amountCents);
  document.querySelector('#confirmation-pickup').textContent = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric',
    minute: '2-digit', timeZoneName: 'short'
  }).format(new Date(order.pickupAt));
  localStorage.removeItem(CART_KEY);
}