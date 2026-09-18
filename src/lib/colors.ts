export const WUBRG = "WUBRG";

const COLOR_NAMES: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

// Keys are in WUBRG order so any colour set has exactly one spelling.
const GUILDS: Record<string, string> = {
  WU: "Azorius", UB: "Dimir", BR: "Rakdos", RG: "Gruul", WG: "Selesnya",
  WB: "Orzhov", UR: "Izzet", BG: "Golgari", WR: "Boros", UG: "Simic",
};

const TRIOMES: Record<string, string> = {
  WUG: "Bant", WUB: "Esper", UBR: "Grixis", BRG: "Jund", WRG: "Naya",
  WBG: "Abzan", WUR: "Jeskai", UBG: "Sultai", WBR: "Mardu", URG: "Temur",
};

/** Put a set of colour letters into canonical WUBRG order. */
export function canonicalColors(letters: Iterable<string>): string[] {
  const present = new Set(letters);
  return WUBRG.split("").filter((c) => present.has(c));
}

/** "Rakdos", "Mono-Red", "Four-Color (no Red)" -- how players actually say it. */
export function colorLabel(letters: string[]): string {
  const key = letters.join("");
  switch (letters.length) {
    case 0:
      return "Colorless";
    case 1:
      return `Mono-${COLOR_NAMES[letters[0]]}`;
    case 2:
      return GUILDS[key] ?? key;
    case 3:
      return TRIOMES[key] ?? key;
    case 4: {
      const missing = WUBRG.split("").find((c) => !letters.includes(c))!;
      return `Four-Color (no ${COLOR_NAMES[missing]})`;
    }
    default:
      return "Five-Color";
  }
}

/** True when a card may not legally go in a deck led by these commanders. */
export function outsideIdentity(
  cardIdentity: string,
  commanderIdentity: string[],
  hasCommander: boolean = true,
): boolean {
  if (!hasCommander) return false;
  return cardIdentity.split("").some((c) => !commanderIdentity.includes(c));
}
