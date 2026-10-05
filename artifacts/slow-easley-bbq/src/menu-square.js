import { api, escapeHtml, estimatedUnit, getCart, money, orderLines, setCart } from './order-store.js';

const menu = new Map();
const status = document.querySelector('#ordering-status');
const nav = document.querySelector('.category-nav');
const itemDialog = document.querySelector('#item-dialog');
const itemForm = document.querySelector('#item-form');
const cartDialog = document.querySelector('#cart-dialog');
const cartItems = document.querySelector('#cart-items');
const checkoutLink = document.querySelector('#checkout-pickup');
const floatingCart = document.querySelector('.floating-cart');
let cart = getCart();
let selected = null;
let categoryLinks = [...nav.querySelectorAll('a')];
let headings = categoryLinks.map(link => document.getElementById(link.hash.slice(1))?.querySelector('.menu-section-heading'));
let scrollFrame = 0;
let ignoreScrollUntil = 0;

const requiresSetup = item => {
  if (!/^entr[eé]es?$/i.test(item.category)) return '';
  if (!item.modifiers.some(group => /sides?/i.test(group.name) && Number(group.minSelectedModifiers) === 2)) {
    return 'Square needs a required two-side choice for this entrée.';
  }
  if (/fish/i.test(item.name) && !/(cajun|regular)/i.test(item.name)
    && !item.modifiers.some(group => /(style|preparation)/i.test(group.name) && Number(group.minSelectedModifiers) >= 1)) {
    return 'Square needs a fish-style choice for this entrée.';
  }
  return '';
};

function refreshCart() {
  const count = cart.reduce((sum, row) => sum + row.quantity, 0);
  document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = String(count); });
  const rows = orderLines(cart, menu);
  cartItems.innerHTML = rows.length ? rows.map(({ row, item }, index) => {
    const selectedOptions = item.modifiers.flatMap(group => group.options).filter(option => row.modifierIds.includes(option.id));
    return `<div class="cart-row">
      <div class="cart-row-main"><strong>${escapeHtml(item.name)}</strong><span>${money(estimatedUnit(item, row.modifierIds) * row.quantity)}</span></div>
      ${selectedOptions.length ? `<p>${selectedOptions.map(option => escapeHtml(option.name)).join(', ')}</p>` : ''}
      ${row.notes ? `<p>Note: ${escapeHtml(row.notes)}</p>` : ''}
      <div class="quantity-controls">
        <button type="button" data-qty="${index}" data-change="-1" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
        <span aria-label="Quantity ${row.quantity}">${row.quantity}</span>
        <button type="button" data-qty="${index}" data-change="1" aria-label="Add one ${escapeHtml(item.name)}">+</button>
        <button class="remove-row" type="button" data-remove="${index}">Remove</button>
      </div>
    </div>`;
  }).join('') : '<p class="empty-cart">Your order is empty. Select a menu item or call to order.</p>';
  document.querySelector('#cart-subtotal').textContent = money(rows.reduce((sum, { row, item }) =>
    sum + estimatedUnit(item, row.modifierIds) * row.quantity, 0));
  checkoutLink.setAttribute('aria-disabled', String(!rows.length || rows.length !== cart.length));
  checkoutLink.href = `${import.meta.env.BASE_URL}checkout/`;
}

function saveCart() {
  try { setCart(cart); } catch {
    status.textContent = 'This browser could not save your order. Please call the restaurant to order.';
    cart = [];
  }
  refreshCart();
}

function updateNavigation() {
  categoryLinks = [...nav.querySelectorAll('a')];
  headings = categoryLinks.map(link => document.getElementById(link.hash.slice(1))?.querySelector('.menu-section-heading'));
  nav.style.setProperty('--category-count', String(categoryLinks.length));
  syncActiveCategory();
}

function setActiveCategory(index) {
  if (index < 0) return;
  categoryLinks.forEach((link, i) => i === index
    ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'));
  nav.style.setProperty('--active-offset', `${index * 100}%`);
}

function syncActiveCategory() {
  const headerHeight = document.querySelector('header').getBoundingClientRect().height;
  floatingCart.classList.toggle('is-visible', nav.getBoundingClientRect().top <= headerHeight + 2);
  if (performance.now() < ignoreScrollUntil) return;
  const threshold = headerHeight + nav.getBoundingClientRect().height + 28;
  let index = 0;
  headings.forEach((heading, i) => {
    if (heading?.getBoundingClientRect().top <= threshold) index = i;
  });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) index = categoryLinks.length - 1;
  if (categoryLinks[index]?.getAttribute('aria-current') !== 'location') setActiveCategory(index);
}

document.addEventListener('click', event => {
  const anchor = event.target.closest('.category-nav a, .order-hero-actions a[href^="#"]');
  if (anchor) {
    const target = document.getElementById(anchor.hash.slice(1));
    if (target) {
      event.preventDefault();
      history.pushState(null, '', anchor.hash);
      const headerHeight = document.querySelector('header').getBoundingClientRect().height;
      const navHeight = nav.getBoundingClientRect().height;
      const heading = target.querySelector('.menu-section-heading') || target;
      window.scrollTo({
        top: Math.max(0, scrollY + heading.getBoundingClientRect().top - headerHeight - navHeight - 16),
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
      });
      setActiveCategory(categoryLinks.findIndex(link => link.hash === anchor.hash));
      ignoreScrollUntil = performance.now() + 850;
    }
  }
  const add = event.target.closest('[data-item]');
  if (add && menu.has(add.dataset.item)) openItem(menu.get(add.dataset.item));
  if (event.target.closest('[data-open-cart]')) cartDialog.showModal();
  const close = event.target.closest('[data-close]');
  if (close) close.closest('dialog').close();
  const qty = event.target.closest('[data-qty]');
  if (qty) {
    const row = cart[Number(qty.dataset.qty)];
    if (row) {
      row.quantity += Number(qty.dataset.change);
      if (row.quantity <= 0) cart.splice(Number(qty.dataset.qty), 1);
      saveCart();
    }
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) { cart.splice(Number(remove.dataset.remove), 1); saveCart(); }
  if (event.target.closest('#checkout-pickup') && checkoutLink.getAttribute('aria-disabled') === 'true') event.preventDefault();
});

window.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    syncActiveCategory();
  });
}, { passive: true });
window.addEventListener('load', syncActiveCategory);

function openItem(item) {
  selected = item;
  document.querySelector('#item-dialog-title').textContent = item.name;
  document.querySelector('#item-dialog-price').textContent = money(item.priceCents);
  document.querySelector('#item-options').innerHTML = item.modifiers.map((group, groupIndex) => {
    const min = Number(group.minSelectedModifiers || 0);
    const max = Number(group.maxSelectedModifiers || 0);
    const type = max === 1 && min > 0 ? 'radio' : 'checkbox';
    const requirement = min ? `Choose ${min}${max > min ? `–${max}` : ''}` : (max ? `Up to ${max}` : 'Optional');
    return `<fieldset class="square-option-group" data-group="${groupIndex}">
      <legend>${escapeHtml(group.name)} <small>(${requirement})</small></legend>
      ${group.options.map(option => `<label class="cheese-option">
        <input type="${type}" name="group-${groupIndex}" value="${escapeHtml(option.id)}" ${type === 'radio' && min ? 'required' : ''}>
        ${escapeHtml(option.name)}${option.priceCents ? ` (+${money(option.priceCents)})` : ''}
      </label>`).join('')}
    </fieldset>`;
  }).join('') + '<label class="option-label">Notes for this item (optional)<textarea name="notes" maxlength="500" rows="2" placeholder="Kitchen instructions"></textarea></label>';
  itemForm.reset();
  itemDialog.showModal();
}

itemForm.addEventListener('change', () => {
  if (!selected) return;
  const chosen = [...new FormData(itemForm).entries()]
    .filter(([key]) => key.startsWith('group-')).map(([, value]) => String(value));
  document.querySelector('#item-dialog-price').textContent = money(estimatedUnit(selected, chosen));
});

itemForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!selected || requiresSetup(selected)) return;
  const data = new FormData(itemForm);
  const modifierIds = [];
  for (const [index, group] of selected.modifiers.entries()) {
    const selectedIds = data.getAll(`group-${index}`).map(String);
    const min = Number(group.minSelectedModifiers || 0);
    const max = Number(group.maxSelectedModifiers || 0);
    if (selectedIds.length < min || (max > 0 && selectedIds.length > max)) {
      const fieldset = itemForm.querySelector(`[data-group="${index}"]`);
      fieldset?.querySelector('input')?.focus();
      fieldset?.setAttribute('data-error', `Choose ${min}${max > min ? `–${max}` : ''} options`);
      return;
    }
    itemForm.querySelector(`[data-group="${index}"]`)?.removeAttribute('data-error');
    modifierIds.push(...selectedIds);
  }
  const notes = String(data.get('notes') || '').trim();
  const key = JSON.stringify([selected.itemId, [...modifierIds].sort(), notes]);
  const existing = cart.find(row => JSON.stringify([row.itemId, [...row.modifierIds].sort(), row.notes]) === key);
  if (existing) existing.quantity = Math.min(99, existing.quantity + 1);
  else cart.push({ itemId: selected.itemId, quantity: 1, modifierIds, notes });
  saveCart();
  itemDialog.close();
  cartDialog.showModal();
});

for (const dialog of [itemDialog, cartDialog]) {
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}

function renderLiveMenu(items) {
  menu.clear();
  const groups = new Map();
  for (const item of items) {
    menu.set(item.itemId, item);
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  if (!groups.size) throw new Error('Square has no orderable menu items at this location.');
  // Replace the crawlable snapshot only after a complete website-menu response arrives.
  document.querySelectorAll('.menu-section').forEach(section => section.remove());
  const originalLabels = new Map([...nav.querySelectorAll('a')].map(link =>
    [link.getAttribute('aria-label'), link.querySelector('.category-label-mobile')?.textContent]));
  nav.innerHTML = [...groups.keys()].map((category, index) =>
    `<a href="#category-${index}" aria-label="${escapeHtml(category)}"><span class="category-label-full">${escapeHtml(category)}</span><span class="category-label-mobile" aria-hidden="true">${escapeHtml(originalLabels.get(category) || category)}</span></a>`).join('');
  const layout = document.querySelector('.order-layout');
  [...groups.entries()].forEach(([category, entries], index) => {
    const section = document.createElement('section');
    section.className = 'menu-section';
    section.id = `category-${index}`;
    section.innerHTML = `<div class="menu-section-heading"><div><p class="menu-kicker">0${index + 1} / The menu</p><h2>${escapeHtml(category)}</h2></div>${entries[0].categoryNote ? `<p>${escapeHtml(entries[0].categoryNote)}</p>` : ''}</div>
      <ul class="menu-items">${entries.map(item => {
        const warning = requiresSetup(item);
        return `<li class="menu-card"><div class="menu-card-top"><h3>${escapeHtml(item.name)}</h3><strong>${money(item.priceCents)}</strong></div>
          ${item.imageUrl && /^https:\/\//i.test(item.imageUrl) ? `<img class="square-menu-image" src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" decoding="async">` : ''}
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : '<p class="menu-card-spacer" aria-hidden="true"></p>'}
          ${warning ? `<p class="menu-setup-warning">${escapeHtml(warning)} Call to order this item.</p>` : ''}
          <button class="add-item" type="button" data-item="${escapeHtml(item.itemId)}" ${warning ? 'disabled' : ''} aria-label="Add to order: ${escapeHtml(item.name)}">Add to order <span aria-hidden="true">＋</span></button></li>`;
      }).join('')}</ul>`;
    layout.append(section);
  });
  updateNavigation();
  const validCart = cart.filter(row => menu.has(row.itemId) && !requiresSetup(menu.get(row.itemId)));
  if (validCart.length !== cart.length) {
    cart = validCart;
    saveCart();
    status.textContent = 'Some saved items are no longer available on the website and were removed. Review your order before checkout.';
  } else {
    status.textContent = 'Website pickup menu is ready. Final prices and tax are confirmed before you pay.';
  }
  refreshCart();
}

document.querySelectorAll('.menu-section .add-item').forEach(button => {
  button.disabled = true;
  button.textContent = 'Call to order';
});
refreshCart();
api('get-menu').then(result => renderLiveMenu(result.items)).catch(() => {
  status.textContent = 'Online pickup is unavailable. This is a browsing menu; call us to confirm items, prices, and pickup.';
  checkoutLink.setAttribute('aria-disabled', 'true');
});