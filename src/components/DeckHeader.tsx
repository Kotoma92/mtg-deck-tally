import { COLOR_HEX, COLOR_TEXT_ON, WUBRG, colorLabel } from "../lib/colors";
import type { Deck, GroupMode } from "../lib/types";

type Props = {
  deck: Deck;
  found: number;
  total: number;
  query: string;
  groupMode: GroupMode;
  onQuery: (value: string) => void;
  onGroupMode: (mode: GroupMode) => void;
  onToggleColor: (color: string) => void;
  onReset: () => void;
  onEdit: () => void;
  onNew: () => void;
};

export function DeckHeader({
  deck, found, total, query, groupMode,
  onQuery, onGroupMode, onToggleColor, onReset, onEdit, onNew,
}: Props) {
  const remaining = total - found;

  return (
    <header>
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
          </span>
        )}
      </div>

      <div className="color-picker">
        {WUBRG.split("").map((color) => {
          const active = deck.colors.includes(color);
          return (
            <button
              key={color}
              className="pip-toggle"
              aria-pressed={active}
              title={`Toggle ${color}`}
              onClick={() => onToggleColor(color)}
              style={
                active
                  ? { background: COLOR_HEX[color], borderColor: COLOR_HEX[color], color: COLOR_TEXT_ON[color] }
                  : undefined
              }
            >
              {color}
            </button>
          );
        })}
        <span className="guild-label">{colorLabel(deck.colors)}</span>
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
    </header>
  );
}
