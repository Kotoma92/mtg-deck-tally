import { useLayoutEffect, useRef, useState } from "react";
import { outsideIdentity } from "../lib/colors";
import { countCards, groupCards } from "../lib/grouping";
import type { Deck, DeckCard, SortMode, ViewMode } from "../lib/types";
import { CardRow } from "./CardRow";
import { VisualCard } from "./VisualCard";

type Props = {
  deck: Deck;
  sortMode: SortMode;
  viewMode: ViewMode;
  query: string;
  onMark: (name: string, delta: number) => void;
};

function useGridColumnCount() {
  const measureRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 4;
    const w = Math.min(1560, window.innerWidth) - 32;
    if (w <= 360) return 2;
    if (w <= 600) return Math.max(1, Math.floor((w + 8) / (130 + 8)));
    return Math.max(1, Math.floor((w + 14) / (175 + 14)));
  });

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const measure = () => {
      const comp = window.getComputedStyle(el).gridTemplateColumns;
      if (comp) {
        const count = comp.split(" ").filter(Boolean).length;
        if (count > 0) setCols(count);
      }
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { measureRef, cols };
}

export function CardList({ deck, sortMode, viewMode, query, onMark }: Props) {
  const needle = query.trim().toLowerCase();
  const groups = groupCards(deck.cards, sortMode);
  const { measureRef, cols } = useGridColumnCount();

  const visibleGroups = groups
    .map((group) => {
      const remaining = group.cards.filter((card) => card.found < card.qty);
      const complete = group.cards.filter((card) => card.found >= card.qty);
      return {
        ...group,
        remaining: needle ? remaining.filter((c) => c.name.toLowerCase().includes(needle)) : remaining,
        complete: needle ? [] : complete,
      };
    })
    .filter((group) => group.remaining.length || group.complete.length);

  if (!visibleGroups.length) {
    return (
      <p className="empty-msg">
        {needle ? `Nothing left to find matching "${query}".` : "Every card accounted for."}
      </p>
    );
  }

  function renderCards(cards: DeckCard[], isDone: boolean) {
    if (viewMode === "text") {
      return (
        <div className="card-grid">
          {cards.map((card) => (
            <CardRow
              key={card.name}
              card={card}
              illegal={!isDone && !!card.info && outsideIdentity(card.info.colorIdentity, deck.colors)}
              onMark={() => onMark(card.name, isDone ? -card.qty : 1)}
              onUndo={() => onMark(card.name, isDone ? -card.qty : -1)}
            />
          ))}
        </div>
      );
    }

    if (viewMode === "stacked") {
      return (
        <div className="visual-stacked-grid">
          {cards.map((card, idx) => (
            <VisualCard
              key={card.name}
              card={card}
              stacked={idx >= cols}
              done={isDone}
              illegal={!isDone && !!card.info && outsideIdentity(card.info.colorIdentity, deck.colors)}
              onMark={() => onMark(card.name, isDone ? -card.qty : 1)}
              onUndo={() => onMark(card.name, isDone ? -card.qty : -1)}
            />
          ))}
        </div>
      );
    }

    // viewMode === "full"
    return (
      <div className="visual-full-grid">
        {cards.map((card) => (
          <VisualCard
            key={card.name}
            card={card}
            done={isDone}
            illegal={!isDone && !!card.info && outsideIdentity(card.info.colorIdentity, deck.colors)}
            onMark={() => onMark(card.name, isDone ? -card.qty : 1)}
            onUndo={() => onMark(card.name, isDone ? -card.qty : -1)}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div
        ref={measureRef}
        className="visual-stacked-grid"
        style={{
          visibility: "hidden",
          position: "absolute",
          pointerEvents: "none",
          width: "100%",
          height: 0,
          overflow: "hidden",
          margin: 0,
          padding: 0,
          border: "none",
        }}
        aria-hidden
      />
      {visibleGroups.map((group) => {
        const { found, total } = countCards(group.cards);
        return (
          <section className="group" key={group.name}>
            <div className="group-head">
              <h2>{group.name}</h2>
              <span className="count mono">
                {found} / {total}
              </span>
            </div>

            {renderCards(group.remaining, false)}

            {!group.remaining.length && !needle && <p className="empty-msg">All checked off.</p>}

            {group.complete.length > 0 && (
              <details className="found-block">
                <summary>Found ({group.complete.length})</summary>
                {renderCards(group.complete, true)}
              </details>
            )}
          </section>
        );
      })}
    </>
  );
}
