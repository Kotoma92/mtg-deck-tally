import type { Deck } from "./types";

const KEY = "mtg-deck-tally/deck/v1";

/** Progress survives reloads -- the whole point is checking a deck over several sittings. */
export function loadDeck(): Deck | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const deck = JSON.parse(raw) as Deck;
    return deck?.cards?.length ? deck : null;
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
