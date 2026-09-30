import { SquareClient, SquareEnvironment } from "square";

export const CURRENCY = "USD";
export const TIME_ZONE = "America/Chicago";
const SQUARE_WEBHOOK_URL = "https://slowandeasely.netlify.app/.netlify/functions/square-webhook";

export class HttpError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function squareSettings(env = process.env) {
  const applicationId = env.SQUARE_APPLICATION_ID?.trim();
  const locationId = env.SQUARE_LOCATION_ID?.trim();
  const accessToken = env.SQUARE_ACCESS_TOKEN?.trim();
  const environment = (env.SQUARE_ENVIRONMENT || "sandbox").trim().toLowerCase();

  if (!applicationId || !locationId || !accessToken) {
    throw new HttpError(503, "Square ordering is not configured.");
  }
  if (!["sandbox", "production"].includes(environment)) {
    throw new HttpError(503, "Square environment must be sandbox or production.");
  }
  if (environment === "production") {
    if (env.SQUARE_LIVE_ENABLED !== "true") {
      throw new HttpError(503, "Live Square ordering is disabled.");
    }
    if (env.SQUARE_WEBSITE_MENU_ENABLED !== "true") {
      throw new HttpError(503, "Website-menu checkout is awaiting merchant verification.");
    }
    if (!env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim()) {
      throw new HttpError(503, "Live Square ordering requires webhook signature verification to be configured.");
    }
  }

  return { applicationId, locationId, accessToken, environment };
}

export function squareClient(settings = squareSettings()) {
  return new SquareClient({
    token: settings.accessToken,
    environment: settings.environment === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox
  });
}

export function methodNotAllowed(allowed) {
  return jsonResponse(405, { error: `Use ${allowed}.` }, { Allow: allowed });
}

export function jsonResponse(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    },
    body: JSON.stringify(data)
  };
}

export function handleOptions() {
  return jsonResponse(204, {});
}

export function parseJsonBody(event) {
  let body = event.body ?? "";
  if (event.isBase64Encoded) {
    body = Buffer.from(body, "base64").toString("utf8");
  }
  if (!body || Buffer.byteLength(body) > 128 * 1024) {
    throw new HttpError(body ? 413 : 400, body ? "Request is too large." : "A JSON request body is required.");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export async function withErrors(handler) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.statusCode, { error: error.message, ...error.details });
    }
    const message = error instanceof Error ? error.message : "";
    const name = error instanceof Error ? error.name : "UnknownError";
    const statusCode = Number(error?.statusCode ?? error?.status);
    console.error("Square request failed", {
      name,
      statusCode: Number.isInteger(statusCode) ? statusCode : undefined,
      squareErrors: Array.isArray(error?.errors)
        ? error.errors.map((item) => item?.code).filter(Boolean)
        : undefined,
      messageLength: message.length
    });
    return jsonResponse(
      statusCode === 400 || statusCode === 404 ? 400 : 502,
      { error: "Square could not complete this request. Please try again or call the restaurant." }
    );
  }
}

export async function loadCatalog(client, locationId) {
  const objects = [];
  let cursor;
  let pages = 0;
  do {
    if (++pages > 100) throw new HttpError(502, "Square catalog pagination exceeded its safety limit.");
    const response = await client.catalog.search({
      objectTypes: ["ITEM", "ITEM_VARIATION", "CATEGORY", "IMAGE", "MODIFIER_LIST", "MODIFIER"],
      includeRelatedObjects: true,
      limit: 100,
      ...(cursor ? { cursor } : {})
    });
    objects.push(...(response.objects || []), ...(response.relatedObjects || []));
    cursor = response.cursor;
  } while (cursor);

  const byId = new Map();
  for (const object of objects) {
    if (object?.id && object.isDeleted !== true) byId.set(object.id, object);
  }
  return makeCatalog(byId, locationId);
}

function makeCatalog(byId, locationId) {
  const items = new Map();
  const modifiers = new Map();
  const images = new Map();
  const categories = new Map();
  const modifierLists = new Map();
  const variationsByItem = new Map();

  for (const object of byId.values()) {
    if (object.type === "ITEM") items.set(object.id, object);
    if (object.type === "ITEM_VARIATION") {
      const itemId = object.itemVariationData?.itemId;
      if (itemId) variationsByItem.set(itemId, [...(variationsByItem.get(itemId) || []), object]);
    }
    if (object.type === "MODIFIER") modifiers.set(object.id, object);
    if (object.type === "IMAGE") images.set(object.id, object);
    if (object.type === "CATEGORY") categories.set(object.id, object);
    if (object.type === "MODIFIER_LIST") modifierLists.set(object.id, object);
  }

  function atLocation(object) {
    if (!object) return false;
    if (object.absentAtLocationIds?.includes(locationId)) return false;
    if (object.presentAtAllLocations === false && !object.presentAtLocationIds?.includes(locationId)) return false;
    return true;
  }

  function locationMoney(money, overrides) {
    const override = overrides?.find((entry) => entry.locationId === locationId && entry.priceMoney);
    return override?.priceMoney || money;
  }

  function moneyCents(money, overrides) {
    const selected = locationMoney(money, overrides);
    if (!selected || selected.currency !== CURRENCY || selected.amount == null) return null;
    const cents = Number(selected.amount);
    return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
  }

  function itemModifiers(item) {
    const lists = [];
    for (const info of item.itemData?.modifierListInfo || []) {
      if (info.enabled === false) continue;
      const list = modifierLists.get(info.modifierListId);
      if (!list || !atLocation(list)) continue;
      const listData = list.modifierListData || {};
      const minSelectedModifiers = modifierSelectionMinimum(info.minSelectedModifiers, listData.minSelectedModifiers);
      const maxSelectedModifiers = modifierSelectionMaximum(
        info.maxSelectedModifiers,
        listData.maxSelectedModifiers,
        listData.selectionType
      );
      const overrides = new Map((info.modifierOverrides || []).map((override) => [override.modifierId, override]));
      const options = (listData.modifiers || []).flatMap((entry) => {
        const modifier = modifiers.get(entry.id);
        const data = modifier?.modifierData;
        const override = overrides.get(entry.id);
        const isHiddenOnline = override?.hiddenOnlineOverride === "YES"
          || (override?.hiddenOnlineOverride !== "NO" && data?.hiddenOnline === true);
        if (!modifier || !data || !atLocation(modifier) || isHiddenOnline) return [];
        const priceCents = data.priceMoney || data.locationOverrides?.some((locationOverride) => locationOverride.locationId === locationId)
          ? moneyCents(data.priceMoney, data.locationOverrides)
          : 0;
        if (priceCents == null) return [];
        return [{ id: modifier.id, name: data.name || "Option", priceCents }];
      });
      if (options.length || minSelectedModifiers > 0) {
        lists.push({
          id: list.id,
          name: listData.name || "Options",
          options,
          minSelectedModifiers,
          maxSelectedModifiers,
          allowQuantities: info.allowQuantities === "YES" || (info.allowQuantities !== "NO" && listData.allowQuantities === true)
        });
      }
    }
    return lists;
  }

  const entries = [];
  for (const item of items.values()) {
    const data = item.itemData;
    if (!data?.name || data.isArchived === true || (data.productType && data.productType !== "REGULAR") || !atLocation(item)) continue;
    const modifierGroups = itemModifiers(item);
    if (modifierGroups.some((group) =>
      group.minSelectedModifiers > 0
      && (!group.options.length || (group.minSelectedModifiers > group.options.length && !group.allowQuantities))
    )) continue;
    for (const variation of variationsByItem.get(item.id) || []) {
      const variationData = variation.itemVariationData;
      if (variationData.sellable === false || !atLocation(variation)) continue;
      if (variationData.pricingType === "VARIABLE_PRICING") continue;
      const priceCents = moneyCents(variationData.priceMoney, variationData.locationOverrides);
      if (priceCents == null) continue;

      const imageId = variationData.imageIds?.[0] || data.imageIds?.[0] || item.imageId;
      const categoryId = data.categories?.[0]?.id || data.categoryId;
      const image = images.get(imageId)?.imageData?.url || null;
      const category = categories.get(categoryId)?.categoryData?.name || "Uncategorized";
      const variationName = variationData.name?.trim();
      const name = variationName && !["regular", "default"].includes(variationName.toLowerCase())
        ? `${data.buyerFacingName || data.name} – ${variationName}`
        : data.buyerFacingName || data.name;

      entries.push({
        itemId: item.id,
        variationId: variation.id,
        name,
        description: data.descriptionPlaintext || data.description || "",
        category,
        priceCents,
        imageUrl: image,
        modifiers: modifierGroups.map(({
          id,
          name: modifierName,
          options,
          minSelectedModifiers,
          maxSelectedModifiers,
          allowQuantities
        }) => ({
          id,
          name: modifierName,
          options,
          minSelectedModifiers,
          maxSelectedModifiers,
          allowQuantities
        })),
        _modifierGroups: modifierGroups
      });
    }
  }

  const byVariation = new Map(entries.map((entry) => [entry.variationId, entry]));
  return { entries, byVariation, byId, modifiers };
}

export function publicMenu(catalog) {
  return {
    items: catalog.entries.map(({ _modifierGroups, ...entry }) => entry),
    currency: CURRENCY
  };
}

export function normalizeOrderItems(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new HttpError(400, "Provide between 1 and 30 order items.");
  }
  const items = input.map((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.variationId !== "string" || !entry.variationId.trim()) {
      throw new HttpError(400, "Each order item needs a Square variationId.");
    }
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99) {
      throw new HttpError(400, "Item quantities must be whole numbers from 1 to 99.");
    }
    const modifierIds = entry.modifierIds ?? [];
    if (!Array.isArray(modifierIds) || modifierIds.length > 30 || modifierIds.some((id) => typeof id !== "string" || !id)) {
      throw new HttpError(400, "modifierIds must be an array of Square modifier IDs.");
    }
    const notes = entry.notes == null ? "" : entry.notes;
    if (typeof notes !== "string" || notes.length > 500) {
      throw new HttpError(400, "Item notes must be 500 characters or fewer.");
    }
    return { variationId: entry.variationId.trim(), quantity: entry.quantity, modifierIds, notes: notes.trim() };
  });
  if (items.reduce((sum, item) => sum + item.quantity, 0) > 99) {
    throw new HttpError(400, "The total number of items cannot exceed 99.");
  }
  return items;
}

export function validateOrderItems(items, catalog) {
  return items.map((item) => {
    const menuItem = catalog.byVariation.get(item.variationId);
    if (!menuItem) throw new HttpError(400, "One or more selected items are no longer orderable. Refresh the menu and try again.");

    const groups = menuItem._modifierGroups;
    const allowedById = new Map(groups.flatMap((group) => group.options.map((option) => [option.id, { group, option }])));
    const chosen = item.modifierIds.map((id) => {
      const result = allowedById.get(id);
      if (!result) throw new HttpError(400, "A selected option is not available for this item.");
      return result;
    });
    for (const group of groups) {
      const selectedCount = chosen.filter(({ group: selectedGroup }) => selectedGroup.id === group.id).length;
      const minimum = group.minSelectedModifiers;
      const maximum = group.maxSelectedModifiers;
      const selectedIds = chosen
        .filter(({ group: selectedGroup }) => selectedGroup.id === group.id)
        .map(({ option }) => option.id);
      if (!group.allowQuantities && new Set(selectedIds).size !== selectedIds.length) {
        throw new HttpError(400, `Choose ${group.name} options only once.`);
      }
      if (minimum > 0 && selectedCount < minimum) {
        throw new HttpError(400, `Choose at least ${minimum} option${minimum === 1 ? "" : "s"} from ${group.name}.`);
      }
      if (maximum > 0 && selectedCount > maximum) {
        throw new HttpError(400, `Choose no more than ${maximum} option${maximum === 1 ? "" : "s"} from ${group.name}.`);
      }
    }
    return {
      source: item,
      menuItem,
      lineItem: {
        catalogObjectId: item.variationId,
        quantity: String(item.quantity),
        ...(item.notes ? { note: item.notes } : {}),
        ...(item.modifierIds.length ? {
          modifiers: [...new Set(item.modifierIds)].map((catalogObjectId) => ({
            catalogObjectId,
            ...(item.modifierIds.filter((id) => id === catalogObjectId).length > 1
              ? { quantity: String(item.modifierIds.filter((id) => id === catalogObjectId).length) }
              : {})
          }))
        } : {})
      }
    };
  });
}

export function validateCustomer(customer) {
  if (!customer || typeof customer !== "object") throw new HttpError(400, "Customer contact information is required.");
  const name = typeof customer.name === "string" ? customer.name.trim() : "";
  const email = typeof customer.email === "string" ? customer.email.trim() : "";
  const phoneInput = typeof customer.phone === "string" ? customer.phone.trim() : "";
  if (name.length < 1 || name.length > 100) throw new HttpError(400, "Enter a customer name.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const digits = phoneInput.replace(/\D/g, "");
  if (/[A-Za-z]/.test(phoneInput) || digits.length < 9 || digits.length > 16) {
    throw new HttpError(400, "Enter a valid phone number.");
  }
  const phone = phoneInput.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+${digits}`;
  return { name, phone, email };
}

export function validatePickupAt(pickupAt, now = new Date()) {
  if (typeof pickupAt !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(pickupAt)) {
    throw new HttpError(400, "Pickup time must be an ISO timestamp with a timezone.");
  }
  const timestamp = Date.parse(pickupAt);
  if (!Number.isFinite(timestamp)) throw new HttpError(400, "Pickup time is invalid.");
  if (timestamp % 60_000 !== 0) throw new HttpError(400, "Pickup time must be on a whole minute.");
  if (timestamp < now.getTime() + 20 * 60 * 1000) {
    throw new HttpError(400, "Pickup time must be at least 20 minutes from now.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const hour = Number(fields.hour);
  const minute = Number(fields.minute);
  const weekday = fields.weekday;
  if (!["Wed", "Thu", "Fri", "Sat", "Sun"].includes(weekday)) {
    throw new HttpError(400, "Pickup is available Wednesday through Sunday only.");
  }
  if (fields.second !== "00" || minute % 15 !== 0) {
    throw new HttpError(400, "Choose a pickup time on a 15-minute slot.");
  }
  const minuteOfDay = hour * 60 + minute;
  if (minuteOfDay < 11 * 60 || minuteOfDay > 19 * 60 + 30) {
    throw new HttpError(400, "Pickup times are available from 11:00 AM through 7:30 PM Central.");
  }
  return new Date(timestamp).toISOString();
}

function centralTimeParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function isRestaurantCurrentlyOpen(now = new Date()) {
  const { weekday, hour, minute } = centralTimeParts(now);
  return ["Wed", "Thu", "Fri", "Sat", "Sun"].includes(weekday)
    && Number(hour) * 60 + Number(minute) >= 11 * 60
    && Number(hour) * 60 + Number(minute) <= 19 * 60 + 30;
}

export function ensureRestaurantOpen(now = new Date()) {
  if (!isRestaurantCurrentlyOpen(now)) {
    throw new HttpError(400, "Online ordering is closed. We are open Wednesday through Sunday, 11:00 AM–7:30 PM Central.");
  }
}

function modifierSelectionMinimum(itemValue, listValue) {
  const itemMinimum = Number(itemValue);
  if (itemValue != null && Number.isFinite(itemMinimum) && itemMinimum >= 0) return itemMinimum;
  const listMinimum = Number(listValue);
  return listValue != null && Number.isFinite(listMinimum) && listMinimum >= 0 ? listMinimum : 0;
}

function modifierSelectionMaximum(itemValue, listValue, legacySelectionType) {
  const itemMaximum = Number(itemValue);
  if (itemValue != null && Number.isFinite(itemMaximum) && itemMaximum >= 0) return itemMaximum;
  const listMaximum = Number(listValue);
  if (listValue != null && Number.isFinite(listMaximum) && listMaximum >= 0) return listMaximum;
  return legacySelectionType === "SINGLE" ? 1 : 0;
}

export function buildSquareOrderRequest(validatedItems, locationId, options = {}) {
  return {
    locationId,
    lineItems: validatedItems.map(({ lineItem }) => lineItem),
    pricingOptions: { autoApplyTaxes: true },
    ...options
  };
}

export function normalizeCents(amount) {
  const cents = Number(amount);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new HttpError(502, "Square did not return a valid order total.");
  return cents;
}

export function confirmedOrderItems(validatedItems) {
  return validatedItems.map(({ source, menuItem }) => {
    const selected = new Map();
    for (const id of source.modifierIds) {
      const option = menuItem._modifierGroups
        .flatMap((group) => group.options)
        .find((entry) => entry.id === id);
      if (!option) throw new HttpError(502, "A selected Square modifier could not be confirmed.");
      const current = selected.get(id);
      selected.set(id, {
        id,
        name: option.name,
        unitPriceCents: option.priceCents,
        quantity: (current?.quantity || 0) + 1
      });
    }
    const modifiers = [...selected.values()];
    const unitPriceCents = menuItem.priceCents
      + modifiers.reduce((sum, modifier) => sum + modifier.unitPriceCents * modifier.quantity, 0);
    const lineTotalCents = unitPriceCents * source.quantity;
    if (!Number.isSafeInteger(unitPriceCents) || !Number.isSafeInteger(lineTotalCents)) {
      throw new HttpError(502, "Square returned an invalid item price.");
    }
    return {
      variationId: source.variationId,
      name: menuItem.name,
      quantity: source.quantity,
      modifierIds: source.modifierIds,
      modifiers,
      notes: source.notes,
      priceCents: menuItem.priceCents,
      unitPriceCents,
      lineTotalCents
    };
  });
}

export function idempotencyKey(prefix, attemptId) {
  // The UUID is retained verbatim in a deterministic key scoped to the operation.
  return `${prefix}-${attemptId}`;
}

const DEFINITIVE_DECLINE_CODES = new Set([
  "CARD_DECLINED",
  "CARD_DECLINED_CALL_ISSUER",
  "CARD_DECLINED_VERIFICATION_REQUIRED",
  "INSUFFICIENT_FUNDS",
  "CARD_EXPIRED",
  "CVV_FAILURE",
  "VERIFY_CVV_FAILURE",
  "ADDRESS_VERIFICATION_FAILURE",
  "CARD_TOKEN_USED"
]);

export function isDefinitivePaymentDecline(error) {
  const errors = Array.isArray(error?.errors) ? error.errors : [];
  return errors.length > 0 && errors.every((entry) =>
    entry?.category === "PAYMENT_METHOD_ERROR" && DEFINITIVE_DECLINE_CODES.has(entry?.code)
  );
}

export async function cancelUnpaidPickupFulfillment(client, orderId, attemptId) {
  const response = await client.orders.get({ orderId });
  const order = response.order;
  if (!order || order.state === "COMPLETED") return { fulfillmentCanceled: false, orderCanceled: false };
  if (order.state === "CANCELED") return { fulfillmentCanceled: true, orderCanceled: true };
  const fulfillment = order.fulfillments?.find((entry) => entry.type === "PICKUP");
  if (!fulfillment?.uid) return { fulfillmentCanceled: false, orderCanceled: false };
  if (fulfillment.state !== "CANCELED" && (fulfillment.state !== "PROPOSED" || order.version == null)) {
    return { fulfillmentCanceled: false, orderCanceled: false };
  }

  let latestOrder = order;
  if (fulfillment.state !== "CANCELED") {
    const updated = await client.orders.update({
      orderId,
      idempotencyKey: idempotencyKey("cancel-fulfillment", attemptId),
      order: {
        locationId: order.locationId,
        version: order.version,
        fulfillments: [{ uid: fulfillment.uid, state: "CANCELED" }]
      }
    });
    latestOrder = updated.order;
    const updatedFulfillment = latestOrder?.fulfillments?.find((entry) => entry.uid === fulfillment.uid);
    if (updatedFulfillment?.state !== "CANCELED") {
      return { fulfillmentCanceled: false, orderCanceled: latestOrder?.state === "CANCELED" };
    }
  }
  if (latestOrder?.state === "CANCELED") return { fulfillmentCanceled: true, orderCanceled: true };
  if (latestOrder?.state !== "OPEN" || latestOrder.version == null) {
    return { fulfillmentCanceled: true, orderCanceled: false };
  }

  try {
    const canceled = await client.orders.update({
      orderId,
      idempotencyKey: idempotencyKey("cancel-order", attemptId),
      order: {
        locationId: latestOrder.locationId,
        version: latestOrder.version,
        state: "CANCELED"
      }
    });
    return {
      fulfillmentCanceled: true,
      orderCanceled: canceled.order?.state === "CANCELED"
    };
  } catch (error) {
    console.error("Square declined-payment order cancellation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      statusCode: Number(error?.statusCode ?? error?.status) || undefined,
      orderId
    });
    return { fulfillmentCanceled: true, orderCanceled: false };
  }
}

export async function handlePaymentFailure(client, error, order, attemptId, options = {}) {
  const definitive = options.definitive ?? isDefinitivePaymentDecline(error);
  if (definitive) {
    let fulfillmentCanceled = false;
    let orderCanceled = false;
    try {
      ({ fulfillmentCanceled, orderCanceled } = await cancelUnpaidPickupFulfillment(client, order.id, attemptId));
    } catch (cancellationError) {
      console.error("Square declined-payment fulfillment cancellation failed", {
        name: cancellationError instanceof Error ? cancellationError.name : "UnknownError",
        statusCode: Number(cancellationError?.statusCode ?? cancellationError?.status) || undefined,
        orderId: order.id
      });
    }
    const message = orderCanceled
      ? "Payment was declined and the unpaid Square order was canceled. You may try again with a new checkout."
      : fulfillmentCanceled
        ? "Payment was declined and its pickup fulfillment was canceled, but Square did not confirm the order itself canceled. Do not retry; call the restaurant and provide the order and attempt IDs."
        : "Payment was declined, but Square could not confirm the pickup fulfillment canceled. Do not retry; call the restaurant and provide the order and attempt IDs.";
    throw new HttpError(402, message, {
      orderId: order.id,
      attemptId,
      paymentId: options.paymentId || undefined,
      fulfillmentCanceled,
      orderCanceled
    });
  }
  throw new HttpError(
    503,
    "Payment status is uncertain. Do not start another checkout or use a new attempt. Contact the restaurant and provide the order and attempt IDs.",
    { orderId: order.id, attemptId, paymentStatus: "unknown" }
  );
}

export function webhookNotificationUrl(env = process.env) {
  return env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim() || SQUARE_WEBHOOK_URL;
}
