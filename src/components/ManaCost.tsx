import { memo } from "react";

type Props = {
  cost: string;
};

export function manaSymbolUrl(symbol: string): string {
  const clean = symbol.replace(/[{}/]/g, "").toUpperCase();
  if (clean === "12") return "https://svgs.scryfall.io/card-symbols/HALF.svg";
  if (clean === "∞") return "https://svgs.scryfall.io/card-symbols/INFINITY.svg";
  return `https://svgs.scryfall.io/card-symbols/${clean}.svg`;
}

export const ManaCost = memo(function ManaCost({ cost }: Props) {
  if (!cost) return null;

  const rawTokens = cost.match(/\{[^}]+\}|\/\//g) || [];
  const tokens = [...rawTokens];
  while (tokens.length && tokens[tokens.length - 1] === "//") tokens.pop();
  while (tokens.length && tokens[0] === "//") tokens.shift();
  if (!tokens.length) return null;

  return (
    <span className="mana-cost" aria-label={`Mana cost: ${cost}`}>
      {tokens.map((token, index) => {
        if (token === "//") {
          return (
            <span key={index} className="mana-sep" aria-hidden>
              //
            </span>
          );
        }
        return (
          <img
            key={index}
            className="mana-symbol"
            src={manaSymbolUrl(token)}
            alt={token}
            loading="lazy"
            aria-hidden
          />
        );
      })}
    </span>
  );
});
