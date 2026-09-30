export const CART_KEY = 'slow-easley-website-cart-v3';
const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/.netlify/functions`;

export const money = cents => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD'
}).format(cents / 100);

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export function getCart() {
  try {
    const rows = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(rows) ? rows.filter(row =>
      row && typeof row.itemId === 'string' && row.itemId &&
      Number.isInteger(row.quantity) && row.quantity > 0 && row.quantity <= 99 &&
      Array.isArray(row.modifierIds) && row.modifierIds.every(id => typeof id === 'string') &&
      typeof row.notes === 'string' && row.notes.length <= 500
    ).slice(0, 30) : [];
  } catch { return []; }
}

export function setCart(rows) {
  localStorage.setItem(CART_KEY, JSON.stringify(rows));
}

export async function api(name, options = {}) {
  const response = await fetch(`${apiBase}/${name}`, {
    cache: 'no-store',
    ...options,
    ...(options.body ? { headers: { 'Content-Type': 'application/json', ...options.headers } } : {})
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Ordering service returned an invalid response. Please call us.'); }
  if (!response.ok) {
    const error = new Error(data?.error || 'Online ordering is unavailable. Please call us.');
    error.status = response.status;
    if (data && typeof data === 'object') Object.assign(error, data);
    throw error;
  }
  return data;
}

export function orderLines(rows, catalog) {
  return rows.map(row => ({ row, item: catalog.get(row.itemId) }))
    .filter(({ item }) => item);
}

export function estimatedUnit(item, modifierIds) {
  const optionPrices = item.modifiers.flatMap(group => group.options);
  return item.priceCents + modifierIds.reduce((sum, id) =>
    sum + (optionPrices.find(option => option.id === id)?.priceCents || 0), 0);
}