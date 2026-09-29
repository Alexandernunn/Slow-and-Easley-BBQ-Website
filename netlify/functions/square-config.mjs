import {
  handleOptions,
  jsonResponse,
  methodNotAllowed,
  squareSettings,
  withErrors
} from "./_shared/square-utils.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "GET") return methodNotAllowed("GET");

  return withErrors(async () => {
    const { applicationId, locationId, environment } = squareSettings();
    return jsonResponse(200, { applicationId, locationId, environment });
  });
}