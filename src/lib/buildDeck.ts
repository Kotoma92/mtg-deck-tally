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
  // Store both the exact printing key, section-specific key, and fallback card name so changing printings in Moxfield preserves checkmarks!
  const priorProgress = new Map<string, number>();
  for (const card of previous?.cards ?? []) {
    if (card.info?.scryfallId) {
      priorProgress.set(`${card.section}::${card.name.toLowerCase()}::${card.info.scryfallId}`, card.found);
      priorProgress.set(`${card.name.toLowerCase()}::${card.info.scryfallId}`, card.found);
    }
    priorProgress.set(`${card.section}::${card.name.toLowerCase()}`, card.found);
    if (!priorProgress.has(card.name.toLowerCase())) {
      priorProgress.set(card.name.toLowerCase(), card.found);
    }
  }

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

    const sectionSpecificKey = `${card.section}::${card.name.toLowerCase()}::${scryfallId ?? ""}`;
    const sectionNameKey = `${card.section}::${card.name.toLowerCase()}`;
    const progressKey = `${card.name.toLowerCase()}::${scryfallId ?? ""}`;
    const previousFound =
      priorProgress.get(sectionSpecificKey) ??
      priorProgress.get(sectionNameKey) ??
      priorProgress.get(progressKey) ??
      priorProgress.get(card.name.toLowerCase()) ??
      0;

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
  const sectionProgress = new Map(
    (previous?.cards ?? []).map((card) => [`${card.section}::${card.name.toLowerCase()}`, card.found]),
  );
  const nameProgress = new Map(
    (previous?.cards ?? []).map((card) => [card.name.toLowerCase(), card.found]),
  );

  const cards: DeckCard[] = rawCards.map((card) => {
    const info = index.get(card.name.toLowerCase());
    const prevFound =
      sectionProgress.get(`${card.section}::${card.name.toLowerCase()}`) ??
      nameProgress.get(card.name.toLowerCase()) ??
      0;
    return {
      ...card,
      name: info?.name ?? card.name,
      info,
      found: Math.min(prevFound, card.qty),
    };
  });

  const eligibleCommanders: DeckCard[] = [];
  const seenEligible = new Set<string>();
  for (const c of cards) {
    const key = c.name.toLowerCase();
    const isMain = !/side|consider|maybe/i.test(c.section);
    if (c.info?.canBeCommander && isMain && !seenEligible.has(key)) {
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

type ImportedDeck = {
  source: DeckSource;
  name?: string;
  commanders: string[];
  cards: RawCard[];
  error?: string;
};

export async function buildDeckFromUrl(
  url: string,
  previous?: Deck | null,
  refresh = false,
): Promise<Deck> {
  const queryUrl = `/api/deck?url=${encodeURIComponent(url)}${refresh ? `&refresh=1&_t=${Date.now()}` : ""}`;
  const response = await fetch(queryUrl, {
    cache: refresh ? "no-cache" : "default",
  });
  const payload = (await response.json()) as ImportedDeck;
  if (!response.ok) throw new Error(payload.error ?? "Couldn't load that deck.");

  // Keep an equivalent text form with section headings so "Edit list" preserves boards.
  const bySection = new Map<string, RawCard[]>();
  for (const card of payload.cards) {
    const sec = card.section || "Deck";
    const list = bySection.get(sec) ?? [];
    list.push(card);
    bySection.set(sec, list);
  }
  const rawText = [...bySection.entries()]
    .map(([sec, list]) => `${sec}\n` + list.map((card) => `${card.qty} ${card.name}`).join("\n"))
    .join("\n\n");
  return buildDeck({ ...payload, url, rawText }, previous);
}
