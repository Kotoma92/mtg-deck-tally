import { lookupCards } from "./cards";
import { canonicalColors } from "./colors";
import { commandersFromSections, inferCommanders, parseDecklist } from "./decklist";
import type { Deck, DeckCard, DeckSource } from "./types";

type RawCard = { name: string; qty: number; section: string };

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
    (previous?.cards ?? []).map((card) => [card.name.toLowerCase(), card.found]),
  );

  const cards: DeckCard[] = input.cards.map((card) => {
    const info = index.get(card.name.toLowerCase());
    return {
      ...card,
      // Prefer the index's spelling: it fixes casing and completes DFC names.
      name: info?.name ?? card.name,
      info,
      found: Math.min(priorProgress.get(card.name.toLowerCase()) ?? 0, card.qty),
    };
  });

  let commanders = input.commanders?.length ? input.commanders : commandersFromSections(cards);
  if (!commanders.length) commanders = inferCommanders(cards);

  const identity = new Set<string>();
  for (const name of commanders) {
    const info = index.get(name.toLowerCase());
    for (const color of info?.colorIdentity ?? "") identity.add(color);
  }
  const autoColors = canonicalColors(identity);

  return {
    source: input.source,
    name: input.name,
    url: input.url,
    rawText: input.rawText,
    cards,
    commanders,
    colors: autoColors,
    autoColors,
  };
}

export async function buildDeckFromText(text: string, previous?: Deck | null): Promise<Deck> {
  const cards = parseDecklist(text);
  if (!cards.length) throw new Error("No cards found -- paste a list like \"1 Sol Ring\".");
  return buildDeck({ source: "paste", rawText: text, cards }, previous);
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
