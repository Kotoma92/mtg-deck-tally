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
  const [retries, setRetries] = useState(0);
  const [imgError, setImgError] = useState(false);
  const isDone = done ?? card.found >= card.qty;

  const imgSrc = `${cardImageUrl(card.name, "normal")}${retries > 0 ? `&r=${retries}` : ""}`;

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
            <div className="fallback-top">
              <span className="fallback-name">{card.name}</span>
              {card.info?.manaCost && <span className="fallback-mana mono">{card.info.manaCost}</span>}
            </div>
            {card.info?.typeLine && <span className="fallback-type">{card.info.typeLine}</span>}
          </div>
        ) : (
          <img
            key={retries}
            src={imgSrc}
            alt={card.name}
            loading="lazy"
            onError={() => {
              if (retries < 2) {
                setTimeout(() => setRetries((r) => r + 1), 1000 * (retries + 1));
              } else {
                setImgError(true);
              }
            }}
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
