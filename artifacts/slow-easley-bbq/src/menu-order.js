import { menu } from '../menu-data.js';

const STORAGE_KEY = 'slow-easley-order-v1';
const catalog = new Map(menu.flatMap((section, si) =>
  section.items.map((item, ii) => [`${si}-${ii}`, { ...item, section: si }])));
const sides = menu.find(section => section.category === 'Sides').items.map(item => item.name);
const itemDialog = document.querySelector('#item-dialog');
const itemForm = document.querySelector('#item-form');
const cartDialog = document.querySelector('#cart-dialog');
const checkoutDialog = document.querySelector('#checkout-dialog');
const cartItems = document.querySelector('#cart-items');
let selectedId = null;
let cart = loadCart();
const categoryNav = document.querySelector('.category-nav');
const categoryLinks = [...categoryNav.querySelectorAll('a')];
const floatingCart = document.querySelector('.floating-cart');
const categoryHeadings = categoryLinks.map(link =>
  document.getElementById(link.hash.slice(1)).querySelector('.menu-section-heading'));
let ignoreScrollUntil = 0;
let scrollFrame = 0;

document.querySelectorAll('.category-nav a, .order-hero-actions a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault();
    history.pushState(null, '', link.getAttribute('href'));
    const headerHeight = document.querySelector('header').getBoundingClientRect().height;
    const navHeight = document.querySelector('.category-nav').getBoundingClientRect().height;
    const heading = target.querySelector('.menu-section-heading') || target;
    window.scrollTo({
      top: Math.max(0, window.scrollY + heading.getBoundingClientRect().top - headerHeight - navHeight - 16),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
    setActiveCategory(categoryLinks.findIndex(categoryLink => categoryLink.hash === link.hash));
    ignoreScrollUntil = performance.now() + 850;
  });
});

function setActiveCategory(index) {
  if (index < 0) return;
  categoryLinks.forEach((link, i) => {
    if (i === index) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  categoryNav.style.setProperty('--active-offset', `${index * 100}%`);
}

function syncActiveCategory() {
  const headerHeight = document.querySelector('header').getBoundingClientRect().height;
  floatingCart.classList.toggle('is-visible', categoryNav.getBoundingClientRect().top <= headerHeight + 2);
  if (performance.now() < ignoreScrollUntil) return;
  const threshold = headerHeight + categoryNav.getBoundingClientRect().height + 28;
  let index = 0;
  categoryHeadings.forEach((heading, i) => {
    if (heading.getBoundingClientRect().top <= threshold) index = i;
  });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) index = categoryLinks.length - 1;
  if (categoryLinks[index].getAttribute('aria-current') !== 'location') setActiveCategory(index);
}

window.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    syncActiveCategory();
  });
}, { passive: true });
window.addEventListener('load', syncActiveCategory);

function loadCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(row =>
      row && catalog.has(row.id) &&
      Number.isInteger(row.qty) && row.qty > 0 && row.qty <= 99 &&
      Array.isArray(row.sides) && row.sides.length <= 2 &&
      row.sides.every(side => sides.includes(side)) &&
      typeof row.cheese === 'boolean' &&
      (row.style === '' || (['Regular', 'Cajun'].includes(row.style) && /fish/i.test(catalog.get(row.id).name))) &&
      (catalog.get(row.id).section === 0 ? row.sides.length === 2 : row.sides.length === 0) &&
      (!row.cheese || /fish/i.test(catalog.get(row.id).name))
    ).slice(0, 100);
  } catch {
    return [];
  }
}

const money = amount => `$${amount.toFixed(2)}`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const unitPrice = row => catalog.get(row.id).price + (row.cheese ? 1 : 0);
const rowKey = row => JSON.stringify([row.id, row.sides, row.cheese, row.style]);

// Future live checkout should send only IDs, quantities and selections to a server.
// The server must revalidate the menu and calculate prices before creating a Square payment link.
function checkoutDraft() {
  const items = cart.map(row => {
    const item = catalog.get(row.id);
    return {
      category: menu[item.section].category,
      name: item.name,
      quantity: row.qty,
      sides: row.sides,
      style: row.style,
      cheese: row.cheese,
      unitPriceCents: Math.round(unitPrice(row) * 100)
    };
  });
  return {
    items,
    subtotalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
  };
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* unavailable storage */ }
  document.querySelectorAll('[data-cart-count]').forEach(node => {
    node.textContent = String(cart.reduce((sum, row) => sum + row.qty, 0));
  });
  renderCart();
}

function add(row) {
  const existing = cart.find(entry => rowKey(entry) === rowKey(row));
  if (existing) existing.qty = Math.min(99, existing.qty + 1);
  else cart.push({ ...row, qty: 1 });
  save();
  itemDialog.close();
  cartDialog.showModal();
}

function sideSelect(label, name) {
  return `<label class="option-label">${label}<select name="${name}" required>
    <option value="">Choose a side</option>
    ${sides.map(side => `<option value="${escapeHtml(side)}">${escapeHtml(side)}</option>`).join('')}
  </select></label>`;
}

function showOptions(id) {
  const item = catalog.get(id);
  if (!item) return;
  if (item.section !== 0) {
    add({ id, sides: [], cheese: false, style: '' });
    return;
  }
  selectedId = id;
  document.querySelector('#item-dialog-title').textContent = item.name;
  document.querySelector('#item-dialog-price').textContent = money(item.price);
  document.querySelector('#item-options').innerHTML = `
    <p class="option-intro">Your entrée comes with two sides. Choose each one below.</p>
    ${sideSelect('First included side', 'side1')}
    ${sideSelect('Second included side', 'side2')}
    ${/fish/i.test(item.name) ? '<label class="cheese-option"><input type="checkbox" name="cheese"> Add cheese to fish (+$1.00)</label>' : ''}
    ${/fish/i.test(item.name) ? '<label class="option-label">Fish style<select name="style"><option value="Regular">Regular</option><option value="Cajun">Cajun</option></select></label>' : ''}
  `;
  itemForm.reset();
  itemDialog.showModal();
}

function renderCart() {
  const subtotal = cart.reduce((sum, row) => sum + unitPrice(row) * row.qty, 0);
  cartItems.innerHTML = cart.length ? cart.map((row, index) => {
    const item = catalog.get(row.id);
    return `<div class="cart-row">
      <div class="cart-row-main"><strong>${escapeHtml(item.name)}</strong><span>${money(unitPrice(row) * row.qty)}</span></div>
      ${row.sides.length ? `<p>With ${row.sides.map(escapeHtml).join(' &amp; ')}</p>` : ''}
      ${row.style ? `<p>${escapeHtml(row.style)} style</p>` : ''}
      ${row.cheese ? '<p>With cheese</p>' : ''}
      <div class="quantity-controls">
        <button type="button" data-qty="${index}" data-change="-1" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
        <span aria-label="Quantity ${row.qty}">${row.qty}</span>
        <button type="button" data-qty="${index}" data-change="1" aria-label="Add one ${escapeHtml(item.name)}">+</button>
        <button class="remove-row" type="button" data-remove="${index}">Remove</button>
      </div>
    </div>`;
  }).join('') : '<p class="empty-cart">Your order is empty. Add anything from the menu to get started.</p>';
  document.querySelector('#cart-subtotal').textContent = money(subtotal);
  document.querySelector('#preview-checkout').disabled = cart.length === 0;
  if (checkoutDialog.open) renderCheckout();
}

function renderCheckout() {
  const draft = checkoutDraft();
  document.querySelector('#checkout-items').innerHTML = draft.items.map(item => `
    <div class="checkout-line">
      <div><strong>${item.quantity} × ${escapeHtml(item.name)}</strong>
        ${item.style ? `<small>${escapeHtml(item.style)} style</small>` : ''}
        ${item.sides.length ? `<small>Sides: ${item.sides.map(escapeHtml).join(', ')}</small>` : ''}
        ${item.cheese ? '<small>With cheese</small>' : ''}
      </div>
      <span>${money(item.unitPriceCents * item.quantity / 100)}</span>
    </div>`).join('');
  document.querySelector('#checkout-subtotal').textContent = money(draft.subtotalCents / 100);
  document.querySelector('#checkout-total').textContent = money(draft.subtotalCents / 100);
}

document.addEventListener('click', event => {
  const addButton = event.target.closest('[data-item]');
  if (addButton) showOptions(addButton.dataset.item);
  if (event.target.closest('[data-open-cart]')) cartDialog.showModal();
  const close = event.target.closest('[data-close]');
  if (close) close.closest('dialog').close();
  const qtyButton = event.target.closest('[data-qty]');
  if (qtyButton) {
    const index = Number(qtyButton.dataset.qty);
    if (cart[index]) {
      cart[index].qty += Number(qtyButton.dataset.change);
      if (cart[index].qty <= 0) cart.splice(index, 1);
      save();
    }
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) { cart.splice(Number(remove.dataset.remove), 1); save(); }
});

itemForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!selectedId || !catalog.has(selectedId)) return;
  const form = new FormData(itemForm);
  const chosenSides = [form.get('side1'), form.get('side2')];
  if (!chosenSides.every(side => sides.includes(side))) return;
  add({ id: selectedId, sides: chosenSides, cheese: form.has('cheese'), style: String(form.get('style') || '') });
});

document.querySelector('#item-options').addEventListener('change', event => {
  if (event.target.name === 'cheese') {
    document.querySelector('#item-dialog-price').textContent =
      money(catalog.get(selectedId).price + (event.target.checked ? 1 : 0));
  }
});

document.querySelector('#preview-checkout').addEventListener('click', () => {
  if (!cart.length) return;
  renderCheckout();
  cartDialog.close();
  checkoutDialog.showModal();
});

document.querySelector('#edit-order').addEventListener('click', () => {
  checkoutDialog.close();
  cartDialog.showModal();
});

for (const dialog of [itemDialog, cartDialog, checkoutDialog]) {
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}
save();