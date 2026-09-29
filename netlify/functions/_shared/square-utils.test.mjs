import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCatalog,
  normalizeOrderItems,
  publicMenu,
  ensureRestaurantOpen,
  isRestaurantCurrentlyOpen,
  jsonResponse,
  handlePaymentFailure,
  squareSettings,
  validateOrderItems,
  validatePickupAt
} from "./square-utils.mjs";
import { handler as createOrderHandler } from "../create-order.mjs";

const locationId = "loc-1";
const testNow = new Date("2030-01-02T17:00:00.000Z");

function createOrderTestDependencies(orderTotalCents) {
  let paymentCalls = 0;
  const item = {
    variationId: "var-1",
    name: "Smoked chicken",
    priceCents: 1000,
    _modifierGroups: [{
      id: "modifier-list-1",
      name: "Cheese",
      minSelectedModifiers: 0,
      maxSelectedModifiers: 2,
      allowQuantities: true,
      options: [{ id: "modifier-1", name: "Cheddar", priceCents: 200 }]
    }]
  };
  const client = {
    orders: {
      async create() {
        return {
          order: {
            id: "order-1",
            ticketName: "42",
            totalMoney: { amount: BigInt(orderTotalCents), currency: "USD" }
          }
        };
      },
      async get() {
        return {
          order: {
            id: "order-1",
            locationId,
            version: 4,
            state: "OPEN",
            fulfillments: [{ uid: "fulfillment-1", type: "PICKUP", state: "PROPOSED" }]
          }
        };
      },
      async update(request) {
        if (request.order.state === "CANCELED") {
          return { order: { id: "order-1", state: "CANCELED" } };
        }
        return {
          order: {
            id: "order-1",
            locationId,
            version: 5,
            state: "OPEN",
            fulfillments: [{ uid: "fulfillment-1", type: "PICKUP", state: "CANCELED" }]
          }
        };
      }
    },
    payments: {
      async create() {
        paymentCalls += 1;
        return { payment: { id: "payment-1", status: "COMPLETED" } };
      }
    }
  };
  return {
    client,
    paymentCalls: () => paymentCalls,
    now: testNow,
    settings: { locationId },
    catalog: { byVariation: new Map([[item.variationId, item]]) }
  };
}

function createOrderEvent(expectedAmountCents) {
  return {
    httpMethod: "POST",
    body: JSON.stringify({
      attemptId: "d9428888-122b-4fd9-9a4a-1d6a4a9b7a50",
      sourceId: "square-token",
      expectedAmountCents,
      items: [{ variationId: "var-1", quantity: 2, modifierIds: ["modifier-1"] }],
      customer: { name: "Test Customer", phone: "5551234567", email: "test@example.com" },
      pickupAt: "2030-01-02T17:30:00.000Z"
    })
  };
}

function catalogFixture() {
  const objects = [
    {
      id: "item-1",
      type: "ITEM",
      itemData: {
        name: "Smoked chicken",
        descriptionPlaintext: "Slow smoked.",
        productType: "REGULAR",
        categories: [{ id: "cat-1" }],
        modifierListInfo: [{
          modifierListId: "list-1",
          enabled: true,
          minSelectedModifiers: 0,
          maxSelectedModifiers: 2,
          allowQuantities: "YES"
        }]
      }
    },
    {
      id: "var-1",
      type: "ITEM_VARIATION",
      itemVariationData: {
        itemId: "item-1",
        name: "Regular",
        pricingType: "FIXED_PRICING",
        priceMoney: { amount: 1200n, currency: "USD" }
      }
    },
    {
      id: "var-hidden",
      type: "ITEM_VARIATION",
      itemVariationData: {
        itemId: "item-1",
        name: "Unavailable",
        pricingType: "VARIABLE_PRICING",
        sellable: false
      }
    },
    { id: "cat-1", type: "CATEGORY", categoryData: { name: "Dinner" } },
    { id: "image-1", type: "IMAGE", imageData: { url: "https://images.example.test/menu.jpg" } },
    {
      id: "list-1",
      type: "MODIFIER_LIST",
      modifierListData: {
        name: "Sauce",
        modifiers: [{ id: "modifier-1" }],
        minSelectedModifiers: 0,
        maxSelectedModifiers: 2,
        allowQuantities: true
      }
    },
    {
      id: "modifier-1",
      type: "MODIFIER",
      modifierData: {
        name: "Extra sauce",
        priceMoney: { amount: 100n, currency: "USD" }
      }
    }
  ];
  let calls = 0;
  const client = {
    catalog: {
      async search() {
        calls += 1;
        return { objects, cursor: undefined };
      }
    }
  };
  return { client, getCalls: () => calls };
}

test("catalog results expose only fixed-price sellable Square variations", async () => {
  const fixture = catalogFixture();
  const catalog = await loadCatalog(fixture.client, locationId);
  assert.equal(fixture.getCalls(), 1);
  assert.deepEqual(publicMenu(catalog), {
    items: [{
      itemId: "item-1",
      variationId: "var-1",
      name: "Smoked chicken",
      description: "Slow smoked.",
      category: "Dinner",
      priceCents: 1200,
      imageUrl: null,
      modifiers: [{
        id: "list-1",
        name: "Sauce",
          options: [{ id: "modifier-1", name: "Extra sauce", priceCents: 100 }],
          minSelectedModifiers: 0,
          maxSelectedModifiers: 2,
          allowQuantities: true
      }]
    }],
    currency: "USD"
  });
});

test("fresh catalog validation makes Square variation and modifier IDs authoritative", async () => {
  const { client } = catalogFixture();
  const catalog = await loadCatalog(client, locationId);
  const normalized = normalizeOrderItems([{
    variationId: "var-1",
    quantity: 2,
    modifierIds: ["modifier-1", "modifier-1"],
    notes: "Sauce on side"
  }]);
  const [validated] = validateOrderItems(normalized, catalog);
  assert.deepEqual(validated.lineItem, {
    catalogObjectId: "var-1",
    quantity: "2",
    note: "Sauce on side",
    modifiers: [{ catalogObjectId: "modifier-1", quantity: "2" }]
  });
  assert.throws(() => validateOrderItems(
    normalizeOrderItems([{
      variationId: "var-1",
      quantity: 1,
      modifierIds: ["modifier-1", "modifier-1", "modifier-1"]
    }]),
    catalog
  ), /no more than 2/);
  assert.throws(() => validateOrderItems(
    normalizeOrderItems([{ variationId: "var-1", quantity: 1, modifierIds: ["not-an-option"] }]),
    catalog
  ), /not available/);
  assert.throws(() => validateOrderItems(
    normalizeOrderItems([{ variationId: "var-hidden", quantity: 1 }]),
    catalog
  ), /no longer orderable/);
});

test("pickup slots use Central hours, weekday, 15-minute increments, and lead time", () => {
  const now = new Date("2030-01-02T16:30:00.000Z");
  assert.equal(
    validatePickupAt("2030-01-02T17:00:00.000Z", now),
    "2030-01-02T17:00:00.000Z"
  );
  assert.throws(() => validatePickupAt("2030-01-02T16:45:00.000Z", now), /20 minutes/);
  assert.throws(() => validatePickupAt("2030-01-02T17:05:00.000Z", now), /15-minute slot/);
  assert.throws(() => validatePickupAt("2030-01-07T17:00:00.000Z", now), /Wednesday through Sunday/);
  assert.throws(() => validatePickupAt("2030-01-03T01:45:00.000Z", now), /11:00 AM through 7:30 PM/);
});

test("new checkouts require current Chicago business hours", () => {
  assert.equal(isRestaurantCurrentlyOpen(new Date("2030-01-02T17:00:00.000Z")), true);
  assert.equal(isRestaurantCurrentlyOpen(new Date("2030-01-03T01:30:00.000Z")), true);
  assert.equal(isRestaurantCurrentlyOpen(new Date("2030-01-02T16:59:00.000Z")), false);
  assert.equal(isRestaurantCurrentlyOpen(new Date("2030-01-03T01:31:00.000Z")), false);
  assert.equal(isRestaurantCurrentlyOpen(new Date("2030-01-01T17:00:00.000Z")), false);
  assert.throws(() => ensureRestaurantOpen(new Date("2030-01-01T17:00:00.000Z")), /Online ordering is closed/);
});

test("Square total mismatch cancels the unpaid order and never attempts payment", async () => {
  const dependencies = createOrderTestDependencies(3000);
  const response = await createOrderHandler(createOrderEvent(3100), dependencies);
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 409);
  assert.match(body.error, /total did not match.*Refresh/i);
  assert.equal(body.paymentAttempted, false);
  assert.equal(body.orderCanceled, true);
  assert.equal(dependencies.paymentCalls(), 0);
});

test("create-order requires a positive safe integer expected amount", async () => {
  const dependencies = createOrderTestDependencies(3000);
  const response = await createOrderHandler(createOrderEvent(0), dependencies);
  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error, /expectedAmountCents must be a positive integer/);
  assert.equal(dependencies.paymentCalls(), 0);
});

test("completed order receipts include modifier labels and modifier-inclusive unit prices", async () => {
  const dependencies = createOrderTestDependencies(3000);
  const response = await createOrderHandler(createOrderEvent(3000), dependencies);
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.items[0].unitPriceCents, 1200);
  assert.equal(body.items[0].lineTotalCents, 2400);
  assert.deepEqual(body.items[0].modifiers, [{
    id: "modifier-1",
    name: "Cheddar",
    unitPriceCents: 200,
    quantity: 1
  }]);
});

test("production Square configuration requires webhook signature verification", () => {
  const env = {
    SQUARE_APPLICATION_ID: "application",
    SQUARE_LOCATION_ID: locationId,
    SQUARE_ACCESS_TOKEN: "access-token",
    SQUARE_ENVIRONMENT: "production",
    SQUARE_LIVE_ENABLED: "true"
  };
  assert.throws(() => squareSettings(env), /requires webhook signature verification/);
  assert.equal(
    squareSettings({ ...env, SQUARE_WEBHOOK_SIGNATURE_KEY: "signature-key" }).environment,
    "production"
  );
});

test("payment declines cancel the open pickup fulfillment; ambiguous failures do not", async () => {
  const updateRequests = [];
  const client = {
    orders: {
      async get() {
        return {
          order: {
            id: "order-1",
            locationId,
            version: 4n,
            state: "OPEN",
            fulfillments: [{ uid: "fulfillment-1", type: "PICKUP", state: "PROPOSED" }]
          }
        };
      },
      async update(request) {
        updateRequests.push(request);
        if (request.order.state === "CANCELED") {
          return { order: { id: "order-1", state: "CANCELED" } };
        }
        return {
          order: {
            id: "order-1",
            state: "OPEN",
            version: 5,
            fulfillments: [{ uid: "fulfillment-1", type: "PICKUP", state: "CANCELED" }]
          }
        };
      }
    }
  };
  await assert.rejects(
    handlePaymentFailure(client, {
      errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" }]
    }, { id: "order-1" }, "d9428888-122b-4fd9-9a4a-1d6a4a9b7a50"),
    (error) => error.statusCode === 402
      && error.details.fulfillmentCanceled === true
      && error.details.orderCanceled === true
  );
  assert.deepEqual(updateRequests[0].order.fulfillments, [{ uid: "fulfillment-1", state: "CANCELED" }]);
  assert.equal(updateRequests[1].order.state, "CANCELED");

  let queriedForCancellation = false;
  const ambiguousClient = {
    orders: {
      async get() {
        queriedForCancellation = true;
        throw new Error("Should not cancel an ambiguous payment");
      }
    }
  };
  await assert.rejects(
    handlePaymentFailure(ambiguousClient, { statusCode: 503 }, { id: "order-1" }, "d9428888-122b-4fd9-9a4a-1d6a4a9b7a50"),
    (error) => error.statusCode === 503 && error.details.paymentStatus === "unknown"
  );
  assert.equal(queriedForCancellation, false);
});

test("JSON responses do not enable wildcard cross-origin requests", () => {
  const response = jsonResponse(200, {});
  assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
  assert.equal(response.headers["Content-Type"], "application/json; charset=utf-8");
});