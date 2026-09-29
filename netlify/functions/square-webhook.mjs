import { WebhooksHelper } from "square";
import {
  handleOptions,
  jsonResponse,
  methodNotAllowed,
  webhookNotificationUrl,
  withErrors
} from "./_shared/square-utils.mjs";

const seenEvents = new Set();
const HANDLED_EVENTS = new Set(["payment.updated", "order.updated", "refund.created"]);

function header(event, wantedName) {
  const headers = event.headers || {};
  const key = Object.keys(headers).find((name) => name.toLowerCase() === wantedName.toLowerCase());
  return key ? headers[key] : undefined;
}

function rawBody(event) {
  const body = event.body ?? "";
  return event.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "POST") return methodNotAllowed("POST");

  return withErrors(async () => {
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
    if (!signatureKey) return jsonResponse(503, { error: "Webhook verification is not configured." });

    const requestBody = rawBody(event);
    const signatureHeader = header(event, "x-square-hmacsha256-signature");
    if (!signatureHeader) return jsonResponse(401, { error: "Invalid webhook signature." });
    const valid = await WebhooksHelper.verifySignature({
      requestBody,
      signatureHeader,
      signatureKey,
      notificationUrl: webhookNotificationUrl()
    });
    if (!valid) return jsonResponse(401, { error: "Invalid webhook signature." });

    let payload;
    try {
      payload = JSON.parse(requestBody);
    } catch {
      return jsonResponse(400, { error: "Webhook body must be valid JSON." });
    }
    if (typeof payload.event_id !== "string" || !payload.event_id || typeof payload.type !== "string") {
      return jsonResponse(400, { error: "Webhook event_id and type are required." });
    }

    if (!HANDLED_EVENTS.has(payload.type)) return jsonResponse(200, { received: true, ignored: true });
    if (seenEvents.has(payload.event_id)) return jsonResponse(200, { received: true, duplicate: true });

    // These notifications are recorded by event ID only; no event is allowed to mutate orders or payments.
    console.info("Square webhook received", {
      eventId: payload.event_id,
      type: payload.type,
      objectId: payload.data?.id || payload.data?.object?.id || undefined
    });
    seenEvents.add(payload.event_id);
    if (seenEvents.size > 5000) seenEvents.delete(seenEvents.values().next().value);
    return jsonResponse(200, { received: true });
  });
}