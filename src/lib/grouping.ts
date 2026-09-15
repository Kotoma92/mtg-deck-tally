import type { DeckCard, GroupMode } from "./types";

/** Broad card types, in the order players usually sort a physical deck. */
const TYPE_ORDER = [
  "Commander",
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Battle",
  "Land",
  "Other",
];

/**
 * A card's bucket. Order matters: an Artifact Creature is a creature, and a
 * Legendary Enchantment Land is a land, which is how people actually sort them.
 */
function typeOf(card: DeckCard): string {
  if (/commander/i.test(card.section)) return "Commander";
  const line = card.info?.typeLine ?? "";
  if (!line) return "Other";
  if (/\bLand\b/i.test(line)) return "Land";
  if (/\bCreature\b/i.test(line)) return "Creature";
  if (/\bPlaneswalker\b/i.test(line)) return "Planeswalker";
  if (/\bInstant\b/i.test(line)) return "Instant";
  if (/\bSorcery\b/i.test(line)) return "Sorcery";
  if (/\bArtifact\b/i.test(line)) return "Artifact";
  if (/\bEnchantment\b/i.test(line)) return "Enchantment";
  if (/\bBattle\b/i.test(line)) return "Battle";
  return "Other";
}

export type CardGroup = { name: string; cards: DeckCard[] };

export function groupCards(cards: DeckCard[], mode: GroupMode): CardGroup[] {
  const groups = new Map<string, DeckCard[]>();
  for (const card of cards) {
    const key = mode === "type" ? typeOf(card) : card.section;
    const bucket = groups.get(key);
    if (bucket) bucket.push(card);
    else groups.set(key, [card]);
  }

  const ordered = [...groups.entries()].map(([name, list]) => ({
    name,
    cards: [...list].sort((a, b) => a.name.localeCompare(b.name)),
  }));

  ordered.sort((a, b) => {
    if (mode === "type") return TYPE_ORDER.indexOf(a.name) - TYPE_ORDER.indexOf(b.name);
    // Section order: Commander first, then whatever order the list used.
    if (/commander/i.test(a.name)) return -1;
    if (/commander/i.test(b.name)) return 1;
    return 0;
  });

  return ordered;
}

export const countCards = (cards: DeckCard[]) =>
  cards.reduce(
    (acc, card) => ({ found: acc.found + card.found, total: acc.total + card.qty }),
    { found: 0, total: 0 },
  );
