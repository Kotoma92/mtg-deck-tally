import type { DeckCard, SortMode } from "./types";

/** Broad card types, in the order players usually sort a physical deck. */
const TYPE_ORDER = [
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
  const line = card.info?.typeLine ?? "";
  if (!line) {
    if (/land/i.test(card.section)) return "Land";
    if (/creature/i.test(card.section)) return "Creature";
    if (/instant/i.test(card.section)) return "Instant";
    if (/sorcery/i.test(card.section)) return "Sorcery";
    if (/artifact/i.test(card.section)) return "Artifact";
    if (/enchant/i.test(card.section)) return "Enchantment";
    if (/battle/i.test(card.section)) return "Battle";
    return "Other";
  }
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

function manaBucketOf(card: DeckCard): string {
  const isLand = /\bLand\b/i.test(card.info?.typeLine ?? "") || /land/i.test(card.section);
  if (isLand) return "Lands";
  if (!card.info) return "Other";
  const cmc = Math.floor(card.info.cmc ?? 0);
  if (cmc >= 7) return "7+ Mana Value";
  return `${cmc} Mana Value`;
}

const MANA_ORDER = [
  "0 Mana Value",
  "1 Mana Value",
  "2 Mana Value",
  "3 Mana Value",
  "4 Mana Value",
  "5 Mana Value",
  "6 Mana Value",
  "7+ Mana Value",
  "Lands",
  "Other",
];

export type CardGroup = { name: string; cards: DeckCard[] };

export function groupCards(cards: DeckCard[], mode: SortMode): CardGroup[] {
  if (mode === "alpha") {
    const distinctSections = new Set(cards.map((c) => c.section.trim().toLowerCase()));
    if (distinctSections.size <= 1) {
      return [
        {
          name: "Deck",
          cards: [...cards].sort((a, b) => a.name.localeCompare(b.name)),
        },
      ];
    }
    const groups = new Map<string, DeckCard[]>();
    for (const card of cards) {
      const bucket = groups.get(card.section);
      if (bucket) bucket.push(card);
      else groups.set(card.section, [card]);
    }
    return [...groups.entries()].map(([name, list]) => ({
      name,
      cards: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }

  const groups = new Map<string, DeckCard[]>();
  for (const card of cards) {
    const key = mode === "type" ? typeOf(card) : manaBucketOf(card);
    const bucket = groups.get(key);
    if (bucket) bucket.push(card);
    else groups.set(key, [card]);
  }

  const ordered = [...groups.entries()].map(([name, list]) => ({
    name,
    cards: [...list].sort((a, b) => a.name.localeCompare(b.name)),
  }));

  const orderList = mode === "type" ? TYPE_ORDER : MANA_ORDER;
  ordered.sort((a, b) => {
    const idxA = orderList.indexOf(a.name);
    const idxB = orderList.indexOf(b.name);
    const posA = idxA === -1 ? 999 : idxA;
    const posB = idxB === -1 ? 999 : idxB;
    return posA - posB;
  });

  return ordered;
}

export const countCards = (cards: DeckCard[]) =>
  cards.reduce(
    (acc, card) => ({ found: acc.found + card.found, total: acc.total + card.qty }),
    { found: 0, total: 0 },
  );
