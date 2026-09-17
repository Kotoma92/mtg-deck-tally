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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function CardList({ deck, sortMode, viewMode, query, onMark }: Props) {
  const needle = query.trim().toLowerCase();
  const groups = groupCards(deck.cards, sortMode);

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
      const piles = chunkArray(cards, 5);
      return (
        <div className="visual-stacked-grid">
          {piles.map((pile, pileIdx) => (
            <div className="visual-stack" key={pileIdx}>
              {pile.map((card) => (
                <VisualCard
                  key={card.name}
                  card={card}
                  stacked
                  done={isDone}
                  illegal={!isDone && !!card.info && outsideIdentity(card.info.colorIdentity, deck.colors)}
                  onMark={() => onMark(card.name, isDone ? -card.qty : 1)}
                  onUndo={() => onMark(card.name, isDone ? -card.qty : -1)}
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
