import { parseDeckUrl, fetchDeck } from "../../shared/deck-sources.mjs";

const json = (body, status = 200, cacheControl = "public, max-age=300") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      "access-control-allow-origin": "*",
    },
  });

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) return json({ error: "Add a ?url= parameter with a deck link." }, 400);

  const target = parseDeckUrl(targetUrl);
  if (!target) {
    return json({ error: "That doesn't look like a Moxfield or Archidekt deck link." }, 400);
  }

  const isRefresh = url.searchParams.has("refresh") || url.searchParams.has("_t");
  const cacheControl = isRefresh ? "no-cache, no-store, must-revalidate" : "public, max-age=60";

  try {
    return json(await fetchDeck(target), 200, cacheControl);
  } catch (err) {
    return json({ error: err.message }, err.status ?? 502);
  }
}
