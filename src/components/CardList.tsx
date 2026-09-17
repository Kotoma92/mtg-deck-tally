import { useLayoutEffect, useRef, useState } from "react";
import { outsideIdentity } from "../lib/colors";
import { countCards, groupCards } from "../lib/grouping";
import type { Deck, DeckCard, SortMode, ViewMode } from "../lib/types";
import { CardRow } from "./CardRow";
import { VisualCard } from "./VisualCard";

type Props = {
  deck: Deck;
  cards: DeckCard[];
  sortMode: SortMode;
  viewMode: ViewMode;
  query: string;
  onMark: (name: string, delta: number, scryfallId?: string) => void;
};

function getGridColumnCount(width: number): number {
  if (width <= 340) return 1;
  if (width <= 600) return 2;
  return Math.max(1, Math.floor((width + 14) / 189));
}

function distributeCards<T>(cards: T[], columnCount: number): T[][] {
  const count = Math.min(columnCount, cards.length);
  if (count <= 0) return [];
  const columns: T[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < cards.length; i++) {
    columns[i % count].push(cards[i]);
  }
  return columns;
}

export function CardList({ deck, cards, sortMode, viewMode, query, onMark }: Props) {
  const needle = query.trim().toLowerCase();
  const groups = groupCards(cards, sortMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === "undefined") return 2;
    const w = Math.min(1560, window.innerWidth) - 40;
    return getGridColumnCount(w);
  });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setColumnCount(getGridColumnCount(el.clientWidth));
    };

    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  if (!cards.length) {
    return <p className="empty-msg">No cards in this section.</p>;
  }

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
          {cards.map((card, idx) => (
            <CardRow
              key={`${card.name}-${card.info?.scryfallId ?? ""}-${card.section}-${idx}`}
              card={card}
              illegal={!isDone && !!card.info && outsideIdentity(card.info.colorIdentity, deck.colors)}
              onMark={() => onMark(card.name, isDone ? -card.qty : 1, card.info?.scryfallId)}
              onUndo={() => onMark(card.name, isDone ? -card.qty : -1, card.info?.scryfallId)}
            />
          ))}
        </div>
      );
    }

    if (viewMode === "stacked") {
      const piles = distributeCards(cards, columnCount);
      return (
        <div className="visual-stacked-grid">
          {piles.map((pile, pileIdx) => (
            <div className="visual-stack" key={pileIdx}>
              {pile.map((card, cardIdx) => (
                <VisualCard
                  key={`${card.name}-${card.info?.scryfallId ?? ""}-${card.section}-${cardIdx}`}
                  card={card}
                  stacked={cardIdx > 0}
                  done={isDone}
                  illegal={!isDone && !!card.info && outsideIdentity(card.info.colorIdentity, deck.colors)}
                  onMark={() => onMark(card.name, isDone ? -card.qty : 1, card.info?.scryfallId)}
                  onUndo={() => onMark(card.name, isDone ? -card.qty : -1, card.info?.scryfallId)}
                />
              ))}
            </div>
          ))}
        </div>
      );
    }

    // viewMode === "full"
    return (
      <div className="visual-full-grid">
        {cards.map((card, idx) => (
          <VisualCard
            key={`${card.name}-${card.info?.scryfallId ?? ""}-${card.section}-${idx}`}
            card={card}
            done={isDone}
            illegal={!isDone && !!card.info && outsideIdentity(card.info.colorIdentity, deck.colors)}
            onMark={() => onMark(card.name, isDone ? -card.qty : 1, card.info?.scryfallId)}
            onUndo={() => onMark(card.name, isDone ? -card.qty : -1, card.info?.scryfallId)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="card-list-root" ref={containerRef}>
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
    </div>
  );
}
