import {
  buildSquareOrderRequest,
  CURRENCY,
  handleOptions,
  jsonResponse,
  loadCatalog,
  methodNotAllowed,
  normalizeCents,
  normalizeOrderItems,
  parseJsonBody,
  squareClient,
  squareSettings,
  validateOrderItems,
  withErrors
} from "./_shared/square-utils.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return methodNotAllowed("POST");

  return withErrors(async () => {
    const input = parseJsonBody(event);
    const settings = squareSettings();
    const items = normalizeOrderItems(input.items);
    const client = squareClient(settings);
    const catalog = await loadCatalog(client, settings.locationId);
    const validated = validateOrderItems(items, catalog);
    const result = await client.orders.calculate({
      order: buildSquareOrderRequest(validated, settings.locationId)
    });
    const totalMoney = result.order?.totalMoney;
    if (totalMoney?.currency && totalMoney.currency !== CURRENCY) {
      throw new Error("Square returned an unsupported currency.");
    }
    return jsonResponse(200, {
      amountCents: normalizeCents(totalMoney?.amount),
      currency: totalMoney?.currency || CURRENCY
    });
  });
}