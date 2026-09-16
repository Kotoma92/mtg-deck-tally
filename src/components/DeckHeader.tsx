import { useState } from "react";
import { cardArtUrl } from "../lib/cards";
import { colorLabel } from "../lib/colors";
import type { ColumnLayout, Deck, SortMode } from "../lib/types";

type Props = {
  deck: Deck;
  found: number;
  total: number;
  query: string;
  sortMode: SortMode;
  layout: ColumnLayout;
  onQuery: (value: string) => void;
  onSortMode: (mode: SortMode) => void;
  onLayout: (layout: ColumnLayout) => void;
  onSubmitQuery?: () => void;
  onReset: () => void;
  onEdit: () => void;
  onNew: () => void;
};

export function DeckHeader({
  deck, found, total, query, sortMode, layout,
  onQuery, onSortMode, onLayout, onSubmitQuery, onReset, onEdit, onNew,
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
            onKeyDown={(event) => {
              if (event.key === "Enter" && onSubmitQuery) {
                event.preventDefault();
                onSubmitQuery();
              }
            }}
            placeholder="Jump to a card… (Enter to check)"
            autoComplete="off"
          />
          <div className="segmented" role="group" aria-label="Sort and group cards by">
            <button
              aria-pressed={sortMode === "alpha"}
              onClick={() => onSortMode("alpha")}
              title="Sort alphabetically A–Z"
            >
              Alphabetical
            </button>
            <button
              aria-pressed={sortMode === "mana"}
              onClick={() => onSortMode("mana")}
              title="Group by mana value curve"
            >
              Mana Value
            </button>
            <button
              aria-pressed={sortMode === "type"}
              onClick={() => onSortMode("type")}
              title="Group by card type"
            >
              Type
            </button>
          </div>
          <div className="segmented" role="group" aria-label="Columns">
            <button
              aria-pressed={layout === "auto"}
              onClick={() => onLayout("auto")}
              title="Auto columns based on screen width"
            >
              Auto
            </button>
            <button
              aria-pressed={layout === "1"}
              onClick={() => onLayout("1")}
              title="1 column"
            >
              1
            </button>
            <button
              aria-pressed={layout === "2"}
              onClick={() => onLayout("2")}
              title="2 columns"
            >
              2
            </button>
            <button
              aria-pressed={layout === "3"}
              onClick={() => onLayout("3")}
              title="3 columns"
            >
              3
            </button>
            <button
              aria-pressed={layout === "4"}
              onClick={() => onLayout("4")}
              title="4 columns"
            >
              4
            </button>
          </div>
          <button
            onClick={() => {
              if (found === 0 || window.confirm("Reset all checkmarks?")) {
                onReset();
              }
            }}
            title="Clear all checkmarks"
          >
            Reset
          </button>
          <button onClick={onEdit}>Edit list</button>
          <button onClick={onNew}>New deck</button>
        </div>
      </div>
    </header>
  );
}
