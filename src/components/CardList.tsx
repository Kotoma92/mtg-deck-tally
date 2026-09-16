import { outsideIdentity } from "../lib/colors";
import { countCards, groupCards } from "../lib/grouping";
import type { Deck, SortMode } from "../lib/types";
import { CardRow } from "./CardRow";

type Props = {
  deck: Deck;
  sortMode: SortMode;
  query: string;
  onMark: (name: string, delta: number) => void;
};

export function CardList({ deck, sortMode, query, onMark }: Props) {
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

            <div className="card-grid">
              {group.remaining.map((card) => (
                <CardRow
                  key={card.name}
                  card={card}
                  illegal={!!card.info && outsideIdentity(card.info.colorIdentity, deck.colors)}
                  onMark={() => onMark(card.name, 1)}
                  onUndo={() => onMark(card.name, -1)}
                />
              ))}
            </div>

            {!group.remaining.length && !needle && <p className="empty-msg">All checked off.</p>}

            {group.complete.length > 0 && (
              <details className="found-block">
                <summary>Found ({group.complete.length})</summary>
                <div className="card-grid">
                  {group.complete.map((card) => (
                    <CardRow
                      key={card.name}
                      card={card}
                      illegal={false}
                      onMark={() => onMark(card.name, -card.qty)}
                      onUndo={() => onMark(card.name, -card.qty)}
                    />
                  ))}
                </div>
              </details>
            )}
          </section>
        );
      })}
    </>
  );
}
