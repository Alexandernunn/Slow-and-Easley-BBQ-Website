import {
  buildSquareOrderRequest,
  cancelUnpaidPickupFulfillment,
  CURRENCY,
  confirmedOrderItems,
  ensureRestaurantOpen,
  handleOptions,
  HttpError,
  idempotencyKey,
  handlePaymentFailure,
  jsonResponse,
  loadCatalog,
  methodNotAllowed,
  normalizeOrderItems,
  parseJsonBody,
  squareClient,
  squareSettings,
  validateCustomer,
  validateOrderItems,
  validatePickupAt,
  withErrors
} from "./_shared/square-utils.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeApiFailure(error, operation) {
  console.error("Square order operation failed", {
    operation,
    name: error instanceof Error ? error.name : "UnknownError",
    statusCode: Number(error?.statusCode ?? error?.status) || undefined,
    squareErrors: Array.isArray(error?.errors)
      ? error.errors.map((entry) => entry?.code).filter(Boolean)
      : undefined
  });
}

async function cancelUnpaidOrderSafely(client, orderId, attemptId) {
  try {
    return await cancelUnpaidPickupFulfillment(client, orderId, attemptId);
  } catch (error) {
    safeApiFailure(error, "cancel-unpaid-order");
    return { fulfillmentCanceled: false, orderCanceled: false };
  }
}

export async function handler(event, dependencies = {}) {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return methodNotAllowed("POST");

  return withErrors(async () => {
    const input = parseJsonBody(event);
    if (!input || typeof input !== "object" || !UUID_PATTERN.test(input.attemptId || "")) {
      throw new HttpError(400, "attemptId must be a valid UUID.");
    }
    if (typeof input.sourceId !== "string" || input.sourceId.length < 1 || input.sourceId.length > 255) {
      throw new HttpError(400, "A Square payment source token is required.");
    }
    if (!Number.isSafeInteger(input.expectedAmountCents) || input.expectedAmountCents <= 0) {
      throw new HttpError(400, "expectedAmountCents must be a positive integer.");
    }
    const items = normalizeOrderItems(input.items);
    const customer = validateCustomer(input.customer);
    const now = dependencies.now || new Date();
    ensureRestaurantOpen(now);
    const pickupAt = validatePickupAt(input.pickupAt, now);
    const settings = dependencies.settings || squareSettings();
    const client = dependencies.client || squareClient(settings);

    // Read the catalog on every checkout; neither client item prices nor stale catalog data are trusted.
    const catalog = dependencies.catalog || await loadCatalog(client, settings.locationId);
    const validatedItems = validateOrderItems(items, catalog);
    const requestOrder = buildSquareOrderRequest(validatedItems, settings.locationId, {
      referenceId: input.attemptId,
      fulfillments: [{
        type: "PICKUP",
        lineItemApplication: "ALL",
        pickupDetails: {
          scheduleType: "SCHEDULED",
          pickupAt,
          pickupWindowDuration: "PT15M",
          recipient: {
            displayName: customer.name,
            phoneNumber: customer.phone,
            emailAddress: customer.email
          }
        }
      }]
    });

    let order;
    try {
      const response = await client.orders.create({
        idempotencyKey: idempotencyKey("order", input.attemptId),
        order: requestOrder
      });
      order = response.order;
    } catch (error) {
      safeApiFailure(error, "create-order");
      throw new HttpError(502, "We could not create the pickup order. Please try again or call the restaurant.");
    }
    if (!order?.id) throw new HttpError(502, "Square did not confirm an order. Please try again or call the restaurant.");
    const squareAmountCents = Number(order.totalMoney?.amount);
    const amountIsValid = Number.isSafeInteger(squareAmountCents) && squareAmountCents >= 0;
    const amountCents = amountIsValid ? squareAmountCents : null;
    const squareCurrency = order.totalMoney?.currency;
    if (!amountIsValid || squareCurrency !== CURRENCY || amountCents !== input.expectedAmountCents) {
      const cancellation = await cancelUnpaidOrderSafely(client, order.id, input.attemptId);
      const message = cancellation.orderCanceled
        ? "The Square total did not match your quote. No payment was taken and the unpaid order was canceled. Refresh the total and review your order before trying again."
        : "We could not verify the Square total against your quote, so no payment was attempted. Refresh the total and review your order; if the order remains open, contact the restaurant with its order ID.";
      throw new HttpError(409, message, {
        orderId: order.id,
        attemptId: input.attemptId,
        expectedAmountCents: input.expectedAmountCents,
        amountCents,
        currency: squareCurrency || null,
        fulfillmentCanceled: cancellation.fulfillmentCanceled,
        orderCanceled: cancellation.orderCanceled,
        paymentAttempted: false
      });
    }

    let payment;
    try {
      const response = await client.payments.create({
        sourceId: input.sourceId,
        idempotencyKey: idempotencyKey("payment", input.attemptId),
        amountMoney: { amount: BigInt(amountCents), currency: CURRENCY },
        orderId: order.id,
        locationId: settings.locationId,
        buyerEmailAddress: customer.email,
        buyerPhoneNumber: customer.phone,
        autocomplete: true
      });
      payment = response.payment;
    } catch (error) {
      safeApiFailure(error, "create-payment");
      // Only a definitive decline triggers cancellation. Ambiguous outcomes keep their stable attempt/order IDs for reconciliation; never mint or retry a different attempt here.
      await handlePaymentFailure(client, error, order, input.attemptId);
    }
    if (payment?.status === "FAILED") {
      await handlePaymentFailure(
        client,
        { name: "SquarePaymentFailed" },
        order,
        input.attemptId,
        { definitive: true, paymentId: payment.id }
      );
    }
    if (!payment?.id || payment.status !== "COMPLETED") {
      throw new HttpError(
        409,
        "Payment status is uncertain. Do not start another checkout or use a new attempt. Contact the restaurant and provide the order and attempt IDs.",
        { orderId: order.id, attemptId: input.attemptId, paymentId: payment?.id || null }
      );
    }

    const confirmedItems = confirmedOrderItems(validatedItems);
    return jsonResponse(200, {
      orderId: order.id,
      orderNumber: order.ticketName || order.id,
      amountCents,
      currency: order.totalMoney?.currency || CURRENCY,
      pickupAt,
      items: confirmedItems,
      paymentId: payment.id
    });
  });
}