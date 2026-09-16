import { useMemo, useState } from "react";
import type { DeckCard } from "../lib/types";
import { ManaCost } from "./ManaCost";

type Props = {
  eligibleCards: DeckCard[];
  initialSelected?: string[];
  onConfirm: (commanders: string[]) => void;
  onCancel: () => void;
};

export function CommanderPicker({
  eligibleCards,
  initialSelected = [],
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<string[]>(() => {
    // Keep initial selections that are actually eligible
    const eligibleSet = new Set(eligibleCards.map((c) => c.name.toLowerCase()));
    return initialSelected.filter((name) => eligibleSet.has(name.toLowerCase())).slice(0, 2);
  });
  const [filter, setFilter] = useState("");

  function toggleCard(name: string) {
    const isSelected = selected.some((s) => s.toLowerCase() === name.toLowerCase());
    if (isSelected) {
      setSelected((curr) => curr.filter((s) => s.toLowerCase() !== name.toLowerCase()));
    } else {
      // Allow up to 2 commanders (for partner / friends forever / background)
      if (selected.length < 2) {
        setSelected((curr) => [...curr, name]);
      } else {
        // If already 2 selected, replace the 2nd one
        setSelected((curr) => [curr[0], name]);
      }
    }
  }

  const filteredCards = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return eligibleCards;
    return eligibleCards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.info?.typeLine ?? "").toLowerCase().includes(q),
    );
  }, [eligibleCards, filter]);

  return (
    <div className="commander-picker">
      <div className="commander-picker-head">
        <h2>Choose your Commander</h2>
        <p className="help">
          Moxfield text exports don&apos;t specify the commander. Select your commander
          below (or select 2 for partner commanders). Only commander-eligible cards are shown.
        </p>
      </div>

      {eligibleCards.length > 5 && (
        <div className="mox-filter-row">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter eligible commanders…"
            aria-label="Filter commanders"
          />
        </div>
      )}

      <div className="commander-picker-grid" role="list" aria-label="Eligible commanders">
        {filteredCards.map((card) => {
          const selIndex = selected.findIndex(
            (s) => s.toLowerCase() === card.name.toLowerCase(),
          );
          const isSelected = selIndex !== -1;
          const badgeText = isSelected
            ? selIndex === 0
              ? selected.length === 2
                ? "Commander 1"
                : "Commander"
              : "Partner"
            : undefined;

          return (
            <button
              key={card.name}
              type="button"
              className={`commander-picker-card${isSelected ? " selected" : ""}`}
              onClick={() => toggleCard(card.name)}
              aria-pressed={isSelected}
            >
              <div className="commander-card-info">
                <div className="commander-card-title-row">
                  <span className="commander-card-name">{card.name}</span>
                  {card.info?.manaCost && <ManaCost cost={card.info.manaCost} />}
                </div>
                {card.info?.typeLine && (
                  <span className="commander-card-type">{card.info.typeLine}</span>
                )}
              </div>
              {badgeText && <span className="commander-badge">{badgeText}</span>}
            </button>
          );
        })}
      </div>

      <div className="actions">
        <button type="button" onClick={onCancel}>
          Back to edit list
        </button>
        <button type="button" onClick={() => onConfirm([])} title="For non-Commander 60-card decks">
          No commander
        </button>
        <button
          type="button"
          className="primary"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
          {selected.length === 2
            ? "Confirm Partners (2)"
            : selected.length === 1
              ? "Confirm Commander (1)"
              : "Select a commander"}
        </button>
      </div>
    </div>
  );
}
