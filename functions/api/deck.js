import { parseDeckUrl, fetchDeck } from "../../shared/deck-sources.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Decks are public data and the response is identical for every caller,
      // so let the CDN absorb repeat loads of the same list.
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });

export async function onRequestGet({ request }) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return json({ error: "Add a ?url= parameter with a deck link." }, 400);

  const target = parseDeckUrl(url);
  if (!target) {
    return json({ error: "That doesn't look like a Moxfield or Archidekt deck link." }, 400);
  }

  try {
    return json(await fetchDeck(target));
  } catch (err) {
    return json({ error: err.message }, err.status ?? 502);
  }
}
