export const WUBRG = "WUBRG";

export const COLOR_HEX: Record<string, string> = {
  W: "#c2a86b",
  U: "#3f79b8",
  B: "#4a3f57",
  R: "#b8452e",
  G: "#3f7d4f",
};

export const COLOR_TEXT_ON: Record<string, string> = {
  W: "#241d10",
  U: "#eef3fa",
  B: "#efeaf2",
  R: "#fbeee9",
  G: "#eaf5ee",
};

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

/** Clockwise from the top of the colour pie, as the wheel is always drawn. */
const PIE_ANGLE: Record<string, number> = { W: -90, U: -18, B: 54, R: 126, G: 198 };

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
export function outsideIdentity(cardIdentity: string, commanderIdentity: string[]): boolean {
  if (!commanderIdentity.length) return false;
  return cardIdentity.split("").some((c) => !commanderIdentity.includes(c));
}

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h / 6) * 360, s * 100, l * 100];
}

/** Average the selected colours in RGB, then work in HSL so themes stay legible. */
function blendHsl(letters: string[]): [number, number, number] {
  const sum = letters.reduce(
    (acc, c) => {
      const [r, g, b] = hexToRgb(COLOR_HEX[c]);
      return [acc[0] + r, acc[1] + g, acc[2] + b] as [number, number, number];
    },
    [0, 0, 0] as [number, number, number],
  );
  const n = letters.length;
  return rgbToHsl(sum[0] / n, sum[1] / n, sum[2] / n);
}

/**
 * The full theme for a colour identity: accents, tinted paper, and a wash of
 * gradients placed where each colour sits on the pie.
 */
export function themeVars(letters: string[], dark: boolean): Record<string, string> {
  if (!letters.length) return {};

  const [hue, rawSat] = blendHsl(letters);
  const h = hue.toFixed(1);
  const s = clamp(rawSat, 34, 78);
  const softS = Math.max(s - 15, 20);
  const tintS = clamp(rawSat, 25, 65);

  const wash = letters.map((c) => {
    const [ch, cs] = rgbToHsl(...hexToRgb(COLOR_HEX[c]));
    const angle = (PIE_ANGLE[c] * Math.PI) / 180;
    const x = (50 + 42 * Math.cos(angle)).toFixed(0);
    const y = (50 + 85 * Math.sin(angle)).toFixed(0);
    const sat = clamp(cs, 45, 90).toFixed(0);
    return `radial-gradient(circle at ${x}% ${y}%, hsl(${ch.toFixed(1)} ${sat}% ${dark ? 54 : 60}% / ${dark ? 0.75 : 0.65}) 0%, transparent 72%)`;
  });
  const scrim = `color-mix(in srgb, var(--paper) ${dark ? 58 : 62}%, transparent)`;

  return {
    "--accent": `hsl(${h} ${s.toFixed(0)}% ${dark ? 62 : 37}%)`,
    "--accent-soft": `hsl(${h} ${softS.toFixed(0)}% ${dark ? 42 : 62}%)`,
    "--found": `hsl(${h} ${s.toFixed(0)}% ${dark ? 56 : 30}%)`,
    "--found-soft": `hsl(${h} ${softS.toFixed(0)}% ${dark ? 42 : 62}%)`,
    "--paper": dark
      ? `hsl(${h} ${(tintS * 0.7).toFixed(0)}% 9%)`
      : `hsl(${h} ${(tintS * 0.55).toFixed(0)}% 92%)`,
    "--paper-raised": dark
      ? `hsl(${h} ${(tintS * 0.65).toFixed(0)}% 15%)`
      : `hsl(${h} ${(tintS * 0.5).toFixed(0)}% 86%)`,
    "--header-wash": [`linear-gradient(${scrim}, ${scrim})`, ...wash].join(", "),
  };
}
