import { useEffect, useState } from "react";
import type { DeckCard } from "../lib/types";
import { CardPreview } from "./CardPreview";
import { ManaCost } from "./ManaCost";

type Props = {
  card: DeckCard;
  illegal: boolean;
  onMark: () => void;
  onUndo: () => void;
};

export function CardRow({ card, illegal, onMark, onUndo }: Props) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const done = card.found >= card.qty;

  // Dismiss floating preview when scrolling
  useEffect(() => {
    if (!anchorRect) return;
    const handleScrollOrResize = () => setAnchorRect(null);
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [anchorRect]);

  // If a DFC/split card name is long, show the primary (front) face to keep the tile sleek and slim.
  // The full card name is always retained in the title attribute if truncated, and for search.
  const displayName =
    card.name.includes(" // ") && card.name.length > 24
      ? card.name.split(" // ")[0]
      : card.name;

  return (
    <div
      className={`row${done ? " done" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${card.name}, ${card.found} of ${card.qty} found`}
      onClick={onMark}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onMark();
        }
      }}
      onMouseEnter={(event) => setAnchorRect(event.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setAnchorRect(null)}
      onFocus={(event) => setAnchorRect(event.currentTarget.getBoundingClientRect())}
      onBlur={() => setAnchorRect(null)}
    >
      <span className="qty mono">
        {card.qty > 1 && card.found > 0 && !done ? `${card.found}/${card.qty}` : `×${card.qty}`}
      </span>

      <span className="name">
        <span
          className="card-title"
          title={displayName !== card.name ? card.name : undefined}
        >
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

      {anchorRect && (
        <CardPreview
          name={card.name}
          scryfallId={card.info?.scryfallId}
          anchorRect={anchorRect}
        />
      )}
    </div>
  );
}
