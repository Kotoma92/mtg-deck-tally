import type { Deck } from "./types";

const KEY = "mtg-deck-tally/deck/v1";

/** Progress survives reloads -- the whole point is checking a deck over several sittings. */
export function loadDeck(): Deck | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const deck = JSON.parse(raw) as Deck;
    if (!deck?.cards?.length) return null;
    if (deck.commanders?.length) {
      const commanderSet = new Set(deck.commanders.map((c) => c.toLowerCase()));
      deck.cards = deck.cards.filter((c) => !commanderSet.has(c.name.toLowerCase()));
    }
    return deck;
  } catch {
    return null;
  }
}

export function saveDeck(deck: Deck): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(deck));
  } catch {
    // Private windows and full quotas both land here; the app still works.
  }
}

export function clearDeck(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
