import {
  handleOptions,
  jsonResponse,
  loadCatalog,
  methodNotAllowed,
  publicMenu,
  squareClient,
  squareSettings,
  withErrors
} from "./_shared/square-utils.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return handleOptions();
  if (event.httpMethod !== "GET") return methodNotAllowed("GET");

  return withErrors(async () => {
    const settings = squareSettings();
    const catalog = await loadCatalog(squareClient(settings), settings.locationId);
    return jsonResponse(200, publicMenu(catalog));
  });
}