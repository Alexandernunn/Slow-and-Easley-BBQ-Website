import {
  handleOptions,
  jsonResponse,
  methodNotAllowed,
  squareSettings,
  withErrors
} from "./_shared/square-utils.mjs";
import { publicWebsiteMenu } from "./_shared/website-order.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "GET") return methodNotAllowed("GET");

  return withErrors(async () => {
    squareSettings();
    return jsonResponse(200, publicWebsiteMenu());
  });
}