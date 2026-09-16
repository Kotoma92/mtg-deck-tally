import { useState } from "react";
import { cardImageUrl } from "../lib/cards";
import type { DeckCard } from "../lib/types";
import { ManaCost } from "./ManaCost";

type Props = {
  card: DeckCard;
  illegal: boolean;
  onMark: () => void;
  onUndo: () => void;
};

export function CardRow({ card, illegal, onMark, onUndo }: Props) {
  const [preview, setPreview] = useState(false);
  const done = card.found >= card.qty;

  // If a DFC/split card name is long, show the primary (front) face to keep the tile sleek and slim.
  // The full card name is always retained in the title attribute and for search.
  const displayName =
    card.name.includes(" // ") && card.name.length > 24
      ? card.name.split(" // ")[0]
      : card.name;

  return (
    <div
      className={`row${done ? " done" : ""}`}
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
      onMouseEnter={() => setPreview(true)}
      onMouseLeave={() => setPreview(false)}
      onFocus={() => setPreview(true)}
      onBlur={() => setPreview(false)}
    >
      <span className="qty mono">×{card.qty}</span>

      <span className="name">
        <span className="card-title" title={card.name}>
          {displayName}
        </span>
        {card.info?.manaCost && <ManaCost cost={card.info.manaCost} />}
        {!card.info && <span className="tag tag-unknown">not in index</span>}
        {illegal && (
          <span className="tag tag-illegal" title="Outside your commander's color identity">
            off-identity
          </span>
        )}
      </span>

      {done ? (
        <span className="stamp">FOUND</span>
      ) : card.qty <= 8 ? (
        <span className="pips">
          {Array.from({ length: card.qty }, (_, i) => (
            <span key={i} className={`pip${i < card.found ? " filled" : ""}`} />
          ))}
        </span>
      ) : (
        <span className="miniprogress" title={`${card.found} of ${card.qty}`}>
          <i style={{ width: `${(card.found / card.qty) * 100}%` }} />
        </span>
      )}

      {card.qty > 1 && card.found > 0 && (
        <button
          className="undo"
          title={done ? "Move back to remaining" : "Undo last check"}
          onClick={(event) => {
            event.stopPropagation();
            onUndo();
          }}
        >
          ↺
        </button>
      )}

      {preview && (
        <img className="card-preview" src={cardImageUrl(card.name)} alt="" loading="lazy" aria-hidden />
      )}
    </div>
  );
}
