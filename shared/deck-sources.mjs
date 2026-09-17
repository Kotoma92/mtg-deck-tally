/**
 * Fetching decks from Moxfield and Archidekt.
 *
 * Neither site sends CORS headers, so the browser cannot call them directly --
 * this module runs server-side, in the Cloudflare Worker in production
 * and in the Vite dev middleware locally, so both behave identically.
 */

const USER_AGENT = "MTGDeckTally/1.0 (+https://github.com/Kotoma92/mtg-deck-tally)";

/** Moxfield public ids are 22 URL-safe base64 characters. */
const MOXFIELD = /^(?:https?:\/\/)?(?:www\.)?moxfield\.com\/decks\/([A-Za-z0-9_-]{6,})/i;
const ARCHIDEKT = /^(?:https?:\/\/)?(?:www\.)?archidekt\.com\/decks\/(\d+)/i;

export function parseDeckUrl(input) {
  const url = (input || "").trim();
  const moxfield = url.match(MOXFIELD);
  if (moxfield) return { site: "moxfield", id: moxfield[1] };
  const archidekt = url.match(ARCHIDEKT);
  if (archidekt) return { site: "archidekt", id: archidekt[1] };
  return null;
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error(`upstream responded ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/** Turn an upstream failure into something a person can act on. */
function friendlyError(err, site) {
  const label = site === "moxfield" ? "Moxfield" : "Archidekt";
  if (err.status === 404) {
    const error = new Error(`Couldn't find that ${label} deck. Check the link, and that the deck is public.`);
    error.status = 404;
    return error;
  }
  if (err.status === 403) {
    // Moxfield sits behind Cloudflare bot protection, which rejects server-side
    // clients by TLS fingerprint -- no combination of headers gets through.
    const error = new Error(
      `${label} is blocking automated requests, so this link can't be read. Use "Paste a list" instead: open the deck, ⋯ menu → Export → Text.`,
    );
    error.status = 403;
    return error;
  }
  const error = new Error(`${label} didn't respond (HTTP ${err.status ?? "?"}). Try again, or paste the list instead.`);
  error.status = 502;
  return error;
}

/** Moxfield v3 nests boards; v2 puts them at the top level. Handle both. */
function moxfieldBoard(deck, board) {
  const cards = deck.boards ? deck.boards[board]?.cards : deck[board];
  return Object.values(cards || {});
}

async function fetchMoxfield(id) {
  let deck;
  try {
    deck = await getJson(`https://api2.moxfield.com/v3/decks/all/${id}`);
  } catch (err) {
    if (err.status !== 404) throw err;
    deck = await getJson(`https://api2.moxfield.com/v2/decks/all/${id}`);
  }

  const commanders = moxfieldBoard(deck, "commanders").map((entry) => entry.card.name);
  const cards = [];
  for (const board of ["commanders", "mainboard", "companions"]) {
    for (const entry of moxfieldBoard(deck, board)) {
      cards.push({
        name: entry.card.name,
        qty: entry.quantity ?? 1,
        section: board === "mainboard" ? "Deck" : board === "commanders" ? "Commander" : "Companion",
        scryfallId: entry.card?.scryfall_id || undefined,
      });
    }
  }
  return { source: "moxfield", name: deck.name, commanders, cards };
}

async function fetchArchidekt(id) {
  const deck = await getJson(`https://archidekt.com/api/decks/${id}/`);
  const commanders = [];
  const cards = [];

  for (const entry of deck.cards || []) {
    const name = entry.card?.oracleCard?.name ?? entry.card?.displayName;
    if (!name) continue;
    const categories = entry.categories || [];
    // Archidekt marks sideboard-ish cards with a modifier; skip maybeboard entries.
    if (entry.modifier === "Maybeboard") continue;
    const isCommander = categories.includes("Commander");
    if (isCommander) commanders.push(name);
    cards.push({
      name,
      qty: entry.quantity ?? 1,
      section: isCommander ? "Commander" : "Deck",
      scryfallId: entry.card?.uid || undefined,
    });
  }
  return { source: "archidekt", name: deck.name, commanders, cards };
}

/** Fetch and normalise a deck into { source, name, commanders[], cards[{name,qty,section}] }. */
export async function fetchDeck({ site, id }) {
  let deck;
  try {
    deck = site === "moxfield" ? await fetchMoxfield(id) : await fetchArchidekt(id);
  } catch (err) {
    throw friendlyError(err, site);
  }
  if (!deck.cards.length) {
    const error = new Error("That deck came back empty. Is it private?");
    error.status = 404;
    throw error;
  }
  return deck;
}
