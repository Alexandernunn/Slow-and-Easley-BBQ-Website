import { menu } from "../../../artifacts/slow-easley-bbq/menu-data.js";
import { CURRENCY, HttpError } from "./square-utils.mjs";

const cents = price => {
  const amount = Math.round(price * 100);
  if (!Number.isSafeInteger(amount) || amount < 0 || Math.abs(price * 100 - amount) > 1e-7) {
    throw new Error("The website menu contains an invalid price.");
  }
  return amount;
};

const sides = menu.find(section => section.category === "Sides")?.items || [];
const sideGroup = {
  id: "entree-sides",
  name: "Two sides",
  minSelectedModifiers: 2,
  maxSelectedModifiers: 2,
  allowQuantities: false,
  options: sides.map(item => ({ id: item.id, name: item.name, priceCents: 0 }))
};
const fishStyle = {
  id: "fish-style",
  name: "Fish preparation",
  minSelectedModifiers: 1,
  maxSelectedModifiers: 1,
  allowQuantities: false,
  options: [
    { id: "fish-regular", name: "Regular", priceCents: 0 },
    { id: "fish-cajun", name: "Cajun", priceCents: 0 }
  ]
};
const fishCheese = {
  id: "fish-cheese-choice",
  name: "Add cheese",
  minSelectedModifiers: 0,
  maxSelectedModifiers: 1,
  allowQuantities: false,
  options: [{ id: "fish-cheese", name: "Cheese", priceCents: 100 }]
};
const sauceType = {
  id: "sauce-type",
  name: "Sauce",
  minSelectedModifiers: 1,
  maxSelectedModifiers: 1,
  allowQuantities: false,
  options: [
    { id: "sauce-regular", name: "Regular", priceCents: 0 },
    { id: "sauce-spicy", name: "Spicy", priceCents: 0 }
  ]
};

const burgerCheese = {
  id: "burger-cheese",
  name: "Cheese",
  minSelectedModifiers: 1,
  maxSelectedModifiers: 1,
  allowQuantities: false,
  options: [
    { id: "burger-cheese-regular", name: "Regular cheese", priceCents: 0 },
    { id: "burger-cheese-pepper-jack", name: "Pepper Jack cheese", priceCents: 0 }
  ]
};
const burgerBacon = {
  id: "burger-extra-bacon",
  name: "Extra bacon",
  minSelectedModifiers: 0,
  maxSelectedModifiers: 1,
  allowQuantities: false,
  options: [{ id: "burger-bacon-two-strips", name: "Add 2 strips of bacon", priceCents: 100 }]
};

const allItems = menu.flatMap(section => section.items.map(item => ({
  itemId: item.id,
  name: item.name,
  category: section.category,
  categoryNote: section.note || "",
  description: item.description || "",
  priceCents: cents(item.price),
  imageUrl: null,
  modifiers: [
    ...(section.category === "Entrées" ? [sideGroup] : []),
    ...(["entree-whitefish", "entree-fish-spaghetti"].includes(item.id) ? [fishStyle, fishCheese] : []),
    ...(item.id === "sauce-additional" ? [sauceType] : []),
    ...(section.category === "Burgers" && item.id.includes("cheeseburger") ? [burgerCheese] : []),
    ...(section.category === "Burgers" ? [burgerBacon] : [])
  ]
})));
const byId = new Map(allItems.map(item => [item.itemId, item]));
if (byId.size !== allItems.length || allItems.some(item => !item.itemId || !item.name)) {
  throw new Error("Website menu item IDs must be unique and nonempty.");
}

export function publicWebsiteMenu() {
  return { items: allItems, currency: CURRENCY };
}

export function normalizeWebsiteItems(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new HttpError(400, "Provide between 1 and 30 order items.");
  }
  const rows = input.map(entry => {
    if (!entry || typeof entry.itemId !== "string" || !entry.itemId.trim()) {
      throw new HttpError(400, "Each item needs a website menu ID. Return to the menu and rebuild your cart.");
    }
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99) {
      throw new HttpError(400, "Item quantities must be whole numbers from 1 to 99.");
    }
    const modifierIds = entry.modifierIds ?? [];
    if (!Array.isArray(modifierIds) || modifierIds.length > 30 || modifierIds.some(id => typeof id !== "string" || !id)) {
      throw new HttpError(400, "Menu choices must be an array of IDs.");
    }
    const notes = entry.notes ?? "";
    if (typeof notes !== "string" || notes.length > 500) throw new HttpError(400, "Item notes must be 500 characters or fewer.");
    return { itemId: entry.itemId.trim(), quantity: entry.quantity, modifierIds, notes: notes.trim() };
  });
  if (rows.reduce((sum, row) => sum + row.quantity, 0) > 99) {
    throw new HttpError(400, "The total number of items cannot exceed 99.");
  }
  return rows;
}

export function validateWebsiteItems(rows) {
  return rows.map(row => {
    const item = byId.get(row.itemId);
    if (!item) throw new HttpError(400, "An item is no longer on the website menu. Return to the menu and review your cart.");
    const selected = [];
    for (const group of item.modifiers) {
      const options = new Map(group.options.map(option => [option.id, option]));
      const chosen = row.modifierIds.filter(id => options.has(id));
      if (chosen.length < group.minSelectedModifiers || (group.maxSelectedModifiers && chosen.length > group.maxSelectedModifiers)) {
        throw new HttpError(400, `Choose ${group.minSelectedModifiers}${group.maxSelectedModifiers > group.minSelectedModifiers ? `–${group.maxSelectedModifiers}` : ""} option(s) from ${group.name}.`);
      }
      if (!group.allowQuantities && new Set(chosen).size !== chosen.length) {
        throw new HttpError(400, `Choose ${group.name} options only once.`);
      }
      selected.push(...chosen.map(id => options.get(id)));
    }
    if (selected.length !== row.modifierIds.length) throw new HttpError(400, "An option is not available for this item.");
    const unitPriceCents = item.priceCents + selected.reduce((sum, option) => sum + option.priceCents, 0);
    const lineTotalCents = unitPriceCents * row.quantity;
    if (!Number.isSafeInteger(lineTotalCents)) throw new HttpError(400, "Order total is too large.");
    const optionNames = selected.map(option => option.name);
    return {
      itemId: item.itemId,
      name: item.name,
      quantity: row.quantity,
      modifierIds: row.modifierIds,
      modifiers: selected.map(option => ({
        id: option.id, name: option.name, unitPriceCents: option.priceCents, quantity: 1
      })),
      notes: row.notes,
      priceCents: item.priceCents,
      unitPriceCents,
      lineTotalCents,
      lineItem: {
        name: [item.name, optionNames.length ? `(${optionNames.join(", ")})` : ""].filter(Boolean).join(" ").slice(0, 255),
        quantity: String(row.quantity),
        basePriceMoney: { amount: BigInt(unitPriceCents), currency: CURRENCY },
        ...(row.notes ? { note: row.notes } : {})
      }
    };
  });
}

// Catalog items are not needed, but Square tax rules for custom amounts must be
// applied explicitly to an ad-hoc order. Never silently assume zero sales tax.
export async function websiteOrderTaxes(client, locationId, env = process.env) {
  const taxes = [];
  let cursor;
  let pages = 0;
  do {
    if (++pages > 100) throw new HttpError(502, "Square tax pagination exceeded its safety limit.");
    const result = await client.catalog.search({
      objectTypes: ["TAX"], limit: 100, ...(cursor ? { cursor } : {})
    });
    taxes.push(...(result.objects || []));
    cursor = result.cursor;
  } while (cursor);
  const applicable = taxes.filter(tax =>
    tax.type === "TAX" && tax.isDeleted !== true && tax.taxData?.enabled !== false
    && tax.taxData?.appliesToCustomAmounts === true
    && !tax.absentAtLocationIds?.includes(locationId)
    && (tax.presentAtAllLocations !== false || tax.presentAtLocationIds?.includes(locationId))
  );
  if (!applicable.length && env.SQUARE_ALLOW_NO_TAX !== "true") {
    throw new HttpError(503, "Square has no tax enabled for custom website orders. Please call to order while the restaurant verifies its tax setup.");
  }
  return applicable.map(tax => ({ catalogObjectId: tax.id, scope: "ORDER" }));
}

export function buildWebsiteOrderRequest(validated, locationId, taxes, options = {}) {
  return {
    locationId,
    lineItems: validated.map(({ lineItem }) => lineItem),
    ...(taxes.length ? { taxes } : {}),
    ...options
  };
}