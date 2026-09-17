import { lookupCards } from "./cards";
import { canonicalColors } from "./colors";
import { commandersFromSections, inferCommanders, parseDecklist } from "./decklist";
import type { Deck, DeckCard, DeckSource } from "./types";

type RawCard = {
  name: string;
  qty: number;
  section: string;
  scryfallId?: string;
};

type BuildInput = {
  source: DeckSource;
  name?: string;
  url?: string;
  rawText: string;
  cards: RawCard[];
  /** Supplied by Moxfield/Archidekt, which know their own commanders. */
  commanders?: string[];
};

/** Enrich a raw list with card data, work out the commander, and derive the theme. */
export async function buildDeck(input: BuildInput, previous?: Deck | null): Promise<Deck> {
  const index = await lookupCards(input.cards.map((card) => card.name));

  // Carry checked-off progress across an edit, so fixing a typo doesn't reset you.
  const priorProgress = new Map(
    (previous?.cards ?? []).map((card) => [
      `${card.name.toLowerCase()}::${card.info?.scryfallId ?? ""}`,
      card.found,
    ]),
  );

  const cards: DeckCard[] = input.cards.map((card) => {
    const baseInfo = index.get(card.name.toLowerCase());
    const scryfallId = card.scryfallId || baseInfo?.scryfallId;
    const info = baseInfo
      ? {
          ...baseInfo,
          scryfallId,
        }
      : card.scryfallId
      ? {
          name: card.name,
          colorIdentity: "",
          typeLine: "",
          manaCost: "",
          cmc: 0,
          canBeCommander: false,
          scryfallId: card.scryfallId,
        }
      : undefined;

    const progressKey = `${card.name.toLowerCase()}::${scryfallId ?? ""}`;
    const previousFound = priorProgress.get(progressKey) ?? priorProgress.get(card.name.toLowerCase()) ?? 0;

    return {
      ...card,
      // Prefer the index's spelling: it fixes casing and completes DFC names.
      name: baseInfo?.name ?? card.name,
      info,
      found: Math.min(previousFound, card.qty),
    };
  });

  let commanders = input.commanders?.length ? input.commanders : commandersFromSections(cards);
  if (!commanders.length) commanders = inferCommanders(cards);

  const identity = new Set<string>();
  for (const name of commanders) {
    const info = index.get(name.toLowerCase());
    for (const color of info?.colorIdentity ?? "") identity.add(color);
  }

  // Ditch the tallyable commander -- it's implicit that the commander is correct.
  // The tally list contains only the remaining 99 (or 98 for partner commanders) cards.
  const commanderSet = new Set(commanders.map((name) => name.toLowerCase()));
  const tallyCards = cards.filter((card) => !commanderSet.has(card.name.toLowerCase()));
  const commanderCards = cards.filter((card) => commanderSet.has(card.name.toLowerCase()));

  return {
    source: input.source,
    name: input.name,
    url: input.url,
    rawText: input.rawText,
    cards: tallyCards,
    commanders,
    commanderCards,
    colors: canonicalColors(identity),
  };
}

export type PreparedDeck = {
  rawText: string;
  cards: DeckCard[];
  eligibleCommanders: DeckCard[];
  suggestedCommanders: string[];
};

export async function prepareDeckFromText(
  text: string,
  previous?: Deck | null,
): Promise<PreparedDeck> {
  const rawCards = parseDecklist(text);
  if (!rawCards.length) throw new Error("No cards found -- paste a list like \"1 Sol Ring\".");

  const index = await lookupCards(rawCards.map((c) => c.name));
  const priorProgress = new Map(
    (previous?.cards ?? []).map((card) => [card.name.toLowerCase(), card.found]),
  );

  const cards: DeckCard[] = rawCards.map((card) => {
    const info = index.get(card.name.toLowerCase());
    return {
      ...card,
      name: info?.name ?? card.name,
      info,
      found: Math.min(priorProgress.get(card.name.toLowerCase()) ?? 0, card.qty),
    };
  });

  const eligibleCommanders: DeckCard[] = [];
  const seenEligible = new Set<string>();
  for (const c of cards) {
    const key = c.name.toLowerCase();
    if (c.info?.canBeCommander && !seenEligible.has(key)) {
      seenEligible.add(key);
      eligibleCommanders.push(c);
    }
  }
  let suggested = commandersFromSections(cards);
  if (!suggested.length) suggested = inferCommanders(cards);
  if (!suggested.length && previous?.commanders?.length) {
    const prevNames = new Set(previous.commanders.map((c) => c.toLowerCase()));
    suggested = cards.filter((c) => prevNames.has(c.name.toLowerCase())).map((c) => c.name);
  }
  if (!suggested.length && eligibleCommanders.length === 1) {
    suggested = [eligibleCommanders[0].name];
  }

  return {
    rawText: text,
    cards,
    eligibleCommanders,
    suggestedCommanders: suggested,
  };
}

export function finalizeDeck(
  prepared: { rawText: string; cards: DeckCard[] },
  commanders: string[],
): Deck {
  const commanderSet = new Set(commanders.map((name) => name.toLowerCase()));
  const tallyCards = prepared.cards.filter((card) => !commanderSet.has(card.name.toLowerCase()));
  const commanderCards = prepared.cards.filter((card) => commanderSet.has(card.name.toLowerCase()));

  const identity = new Set<string>();
  for (const card of prepared.cards) {
    if (commanderSet.has(card.name.toLowerCase())) {
      for (const color of card.info?.colorIdentity ?? "") identity.add(color);
    }
  }

  return {
    source: "paste",
    rawText: prepared.rawText,
    cards: tallyCards,
    commanders,
    commanderCards,
    colors: canonicalColors(identity),
  };
}

export async function buildDeckFromText(text: string, previous?: Deck | null): Promise<Deck> {
  const prepared = await prepareDeckFromText(text, previous);
  return finalizeDeck(prepared, prepared.suggestedCommanders);
}

type ImportedDeck = {
  source: DeckSource;
  name?: string;
  commanders: string[];
  cards: RawCard[];
  error?: string;
};

export async function buildDeckFromUrl(url: string, previous?: Deck | null): Promise<Deck> {
  const response = await fetch(`/api/deck?url=${encodeURIComponent(url)}`);
  const payload = (await response.json()) as ImportedDeck;
  if (!response.ok) throw new Error(payload.error ?? "Couldn't load that deck.");

  // Keep an equivalent text form so "Edit list" still has something to show.
  const rawText = payload.cards.map((card) => `${card.qty} ${card.name}`).join("\n");
  return buildDeck({ ...payload, url, rawText }, previous);
}
