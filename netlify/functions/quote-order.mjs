import {
  CURRENCY,
  handleOptions,
  jsonResponse,
  methodNotAllowed,
  normalizeCents,
  parseJsonBody,
  squareClient,
  squareSettings,
  withErrors
} from "./_shared/square-utils.mjs";
import {
  buildWebsiteOrderRequest,
  normalizeWebsiteItems,
  validateWebsiteItems,
  websiteOrderTaxes
} from "./_shared/website-order.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return methodNotAllowed("POST");

  return withErrors(async () => {
    const input = parseJsonBody(event);
    const settings = squareSettings();
    const items = normalizeWebsiteItems(input.items);
    const client = squareClient(settings);
    const validated = validateWebsiteItems(items);
    const taxes = await websiteOrderTaxes(client, settings.locationId);
    const result = await client.orders.calculate({
      order: buildWebsiteOrderRequest(validated, settings.locationId, taxes)
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