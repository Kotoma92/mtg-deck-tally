/** A card as it exists in the bundled Scryfall index. */
export type CardInfo = {
  name: string;
  colorIdentity: string;
  typeLine: string;
  manaCost: string;
  cmc: number;
  canBeCommander: boolean;
  scryfallId?: string;
};

/** A line of the decklist, plus how many copies you've checked off so far. */
export type DeckCard = {
  name: string;
  qty: number;
  section: string;
  found: number;
  info?: CardInfo;
};

export type DeckSource = "paste" | "moxfield" | "archidekt";

export type Deck = {
  source: DeckSource;
  name?: string;
  url?: string;
  /** The pasted text, kept so "Edit list" can reopen exactly what you typed. */
  rawText: string;
  cards: DeckCard[];
  commanders: string[];
  commanderCards?: DeckCard[];
  /** The commander's colour identity, used to flag off-identity cards. */
  colors: string[];
};

export type SortMode = "alpha" | "mana" | "type";

export type ViewMode = "text" | "stacked" | "full";
