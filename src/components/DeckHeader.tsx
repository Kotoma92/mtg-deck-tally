import { useState } from "react";
import { cardArtUrl } from "../lib/cards";
import { colorLabel } from "../lib/colors";
import type { Deck, GroupMode } from "../lib/types";

type Props = {
  deck: Deck;
  found: number;
  total: number;
  query: string;
  groupMode: GroupMode;
  onQuery: (value: string) => void;
  onGroupMode: (mode: GroupMode) => void;
  onReset: () => void;
  onEdit: () => void;
  onNew: () => void;
};

export function DeckHeader({
  deck, found, total, query, groupMode,
  onQuery, onGroupMode, onReset, onEdit, onNew,
}: Props) {
  const remaining = total - found;
  const [broken, setBroken] = useState<string[]>([]);
  // A card with no art on Scryfall shouldn't leave a broken image in the banner.
  const art = deck.commanders.filter((name) => !broken.includes(name));
  const markBroken = (name: string) => setBroken((current) => [...current, name]);

  return (
    <header>
      {art.length > 0 && (
        <div className="header-art" aria-hidden>
          {art.map((name) => (
            <img key={name} src={cardArtUrl(name)} alt="" onError={() => markBroken(name)} />
          ))}
        </div>
      )}

      <div className="header-inner">
        <div className="title-row">
          <div>
            <h1>Deck Tally</h1>
            <p className="tagline">
              {remaining === 0
                ? "Every card accounted for."
                : `${remaining} card${remaining === 1 ? "" : "s"} left to find.`}
            </p>
          </div>
          <div className="progress-stat mono">
            {found} / {total} <span>found</span>
          </div>
        </div>

        <div className="progress-rail">
          <div className="progress-fill" style={{ width: total ? `${(found / total) * 100}%` : 0 }} />
        </div>

        <div className="deck-meta">
          {art.map((name) => (
            <img
              key={name}
              className="commander-thumb"
              src={cardArtUrl(name)}
              alt={name}
              title={name}
              onError={() => markBroken(name)}
            />
          ))}
          <div className="deck-meta-text">
            {deck.name && (
              <span className="deck-name">
                {deck.url ? (
                  <a href={deck.url} target="_blank" rel="noreferrer noopener">
                    {deck.name}
                  </a>
                ) : (
                  deck.name
                )}
              </span>
            )}
            {deck.commanders.length > 0 && (
              <span className="commander">
                {deck.commanders.join(" + ")}
                <span className="identity">{colorLabel(deck.colors)}</span>
              </span>
            )}
          </div>
        </div>

        <div className="controls-row">
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Jump to a card…"
            autoComplete="off"
          />
          <div className="segmented" role="group" aria-label="Group cards by">
            <button aria-pressed={groupMode === "section"} onClick={() => onGroupMode("section")}>
              Section
            </button>
            <button aria-pressed={groupMode === "type"} onClick={() => onGroupMode("type")}>
              Type
            </button>
          </div>
          <button onClick={onReset} title="Clear all checkmarks">
            Reset
          </button>
          <button onClick={onEdit}>Edit list</button>
          <button onClick={onNew}>New deck</button>
        </div>
      </div>
    </header>
  );
}
