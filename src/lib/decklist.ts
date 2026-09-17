import type { DeckCard } from "./types";

/** "1 Sol Ring", "4x Lightning Bolt", "1 Beast Within (C21) 198 *F*" */
const LINE = /^(\d+)\s*x?\s+(.+)$/i;

/**
 * Strip the printing details exporters append to a card name: a set code in
 * parentheses and everything after it, and a trailing foil marker.
 */
function cleanName(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\).*$/, "")
    .replace(/\s*\*[fF]\*\s*$/, "")
    .trim();
}

/** Normalise a section heading: "SIDEBOARD (15)" and "Sideboard:" both mean Sideboard. */
function cleanHeading(raw: string): string {
  const heading = raw
    .replace(/[:\-]+$/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim();
  if (!heading) return "Deck";
  if (/maybe|consider/i.test(heading)) return "Considering";
  if (/\bside/i.test(heading)) return "Sideboard";
  if (/command/i.test(heading)) return "Commander";
  if (/compan/i.test(heading)) return "Companion";
  return heading.charAt(0).toUpperCase() + heading.slice(1).toLowerCase();
}

/**
 * Parse a pasted decklist. Anything that isn't a quantity line is treated as a
 * section heading, which is how Moxfield, Archidekt and Arena exports all mark
 * their Commander / Deck / Sideboard blocks.
 */
export function parseDecklist(text: string): DeckCard[] {
  const cards = new Map<string, DeckCard>();
  let section = "Deck";

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) continue;

    const match = trimmed.match(LINE);
    if (!match) {
      section = cleanHeading(trimmed);
      continue;
    }

    const name = cleanName(match[2]);
    if (!name) continue;
    const qty = parseInt(match[1], 10);
    const key = `${section}::${name.toLowerCase()}`;
    const existing = cards.get(key);
    if (existing) existing.qty += qty;
    else cards.set(key, { name, qty, section, found: 0 });
  }

  return [...cards.values()];
}

/** Cards listed under a Commander heading, which is how exports mark them. */
export function commandersFromSections(cards: DeckCard[]): string[] {
  return cards.filter((card) => /commander/i.test(card.section)).map((card) => card.name);
}

/**
 * Fall back to the card index when a list has no Commander heading: a singleton
 * legendary that could legally head the deck is almost certainly the commander.
 */
export function inferCommanders(cards: DeckCard[]): string[] {
  const eligible = cards.filter(
    (card) => card.qty === 1 && card.info?.canBeCommander && !/side|consider|maybe/i.test(card.section),
  );
  return eligible.length === 1 ? [eligible[0].name] : [];
}
