import { useEffect, useMemo, useState } from "react";
import { CardList } from "./components/CardList";
import { DeckHeader } from "./components/DeckHeader";
import { ImportPanel } from "./components/ImportPanel";
import { buildDeckFromText, buildDeckFromUrl } from "./lib/buildDeck";
import { countCards } from "./lib/grouping";
import { clearDeck, loadDeck, saveDeck } from "./lib/storage";
import type { Deck, GroupMode } from "./lib/types";

export default function App() {
  const [deck, setDeck] = useState<Deck | null>(() => loadDeck());
  const [importing, setImporting] = useState(() => loadDeck() === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("section");

  useEffect(() => {
    if (deck) saveDeck(deck);
  }, [deck]);

  const { found, total } = useMemo(() => countCards(deck?.cards ?? []), [deck]);

  async function load(build: () => Promise<Deck>) {
    setBusy(true);
    setError(undefined);
    try {
      setDeck(await build());
      setImporting(false);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function markCard(name: string, delta: number) {
    setDeck((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((card) =>
              card.name === name
                ? { ...card, found: Math.max(0, Math.min(card.qty, card.found + delta)) }
                : card,
            ),
          }
        : current,
    );
  }

  if (importing || !deck) {
    return (
      <div className="wrap">
        <header className="bare-header">
          <h1>Deck Tally</h1>
          <p className="tagline">Check a physical deck against its list, card by card.</p>
        </header>
        <ImportPanel
          initialText={deck?.source === "paste" ? deck.rawText : undefined}
          busy={busy}
          error={error}
          canCancel={deck !== null}
          onPaste={(text) => load(() => buildDeckFromText(text, deck))}
          onLink={(url) => load(() => buildDeckFromUrl(url, deck))}
          onCancel={() => {
            setError(undefined);
            setImporting(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="wrap">
      <DeckHeader
        deck={deck}
        found={found}
        total={total}
        query={query}
        groupMode={groupMode}
        onQuery={setQuery}
        onGroupMode={setGroupMode}
        onReset={() => setDeck({ ...deck, cards: deck.cards.map((card) => ({ ...card, found: 0 })) })}
        onEdit={() => setImporting(true)}
        onNew={() => {
          clearDeck();
          setDeck(null);
          setImporting(true);
        }}
      />
      <main>
        <CardList deck={deck} groupMode={groupMode} query={query} onMark={markCard} />
      </main>
    </div>
  );
}
