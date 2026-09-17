import { useState } from "react";
import { cardImageUrl } from "../lib/cards";
import type { DeckCard } from "../lib/types";

type Props = {
  card: DeckCard;
  stacked?: boolean;
  illegal?: boolean;
  done?: boolean;
  onMark: () => void;
  onUndo?: () => void;
};

export function VisualCard({ card, stacked, illegal, done, onMark, onUndo }: Props) {
  const [imgError, setImgError] = useState(false);
  const isDone = done ?? card.found >= card.qty;

  return (
    <div
      className={`visual-card${stacked ? " is-stacked" : ""}${isDone ? " is-done" : ""}`}
      role="button"
      tabIndex={0}
      title={card.name}
      aria-label={`${card.name}, ${card.found} of ${card.qty} found`}
      onClick={onMark}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onMark();
        }
      }}
    >
      <div className="visual-card-frame">
        {imgError ? (
          <div className="visual-card-fallback">
            <span className="fallback-name">{card.name}</span>
            {card.info?.typeLine && <span className="fallback-type">{card.info.typeLine}</span>}
          </div>
        ) : (
          <img
            src={cardImageUrl(card.name, "normal")}
            alt={card.name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}

        {/* Badges */}
        {card.qty > 1 && (
          <span className="visual-badge qty-badge" title={`${card.found} of ${card.qty} found`}>
            {card.found > 0 && !isDone ? `${card.found}/${card.qty}` : `×${card.qty}`}
          </span>
        )}

        {illegal && (
          <span className="visual-badge illegal-badge" title="Outside your commander's color identity">
            off-identity
          </span>
        )}

        {/* Found overlay */}
        {isDone && (
          <div className="visual-card-done-overlay" aria-hidden>
            <span className="done-check-icon">✓</span>
          </div>
        )}

        {/* Multi-copy undo */}
        {card.qty > 1 && card.found > 0 && onUndo && (
          <button
            type="button"
            className="visual-undo-btn"
            title="Undo last check"
            onClick={(e) => {
              e.stopPropagation();
              onUndo();
            }}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
