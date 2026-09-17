import { useEffect, useMemo, useState } from "react";
import { CardList } from "./components/CardList";
import { CommanderPicker } from "./components/CommanderPicker";
import { DeckHeader } from "./components/DeckHeader";
import { ImportPanel } from "./components/ImportPanel";
import { ShoppingListModal } from "./components/ShoppingListModal";
import { buildDeckFromUrl, finalizeDeck, prepareDeckFromText, type PreparedDeck } from "./lib/buildDeck";
import { boardOfSection, countCards, filterCardsByBoard } from "./lib/grouping";
import { lookupCards } from "./lib/cards";
import { loadDeck, saveDeck } from "./lib/storage";
import type { BoardType, Deck, SortMode, ViewMode } from "./lib/types";

const VIEW_STORAGE_KEY = "mtg-deck-tally/view-mode";
const SORT_STORAGE_KEY = "mtg-deck-tally/sort-mode";

export default function App() {
  const [deck, setDeck] = useState<Deck | null>(() => loadDeck());
  const [importing, setImporting] = useState(() => loadDeck() === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [preparedDeck, setPreparedDeck] = useState<PreparedDeck | null>(null);
  const [lastPastedText, setLastPastedText] = useState<string>();
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === "undefined") return "type";
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    return saved === "alpha" || saved === "mana" || saved === "type"
      ? (saved as SortMode)
      : "type";
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "text";
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === "text" || saved === "stacked" || saved === "full"
      ? (saved as ViewMode)
      : "text";
  });
  const [activeBoard, setActiveBoard] = useState<BoardType>("main");
  const [shoppingListOpen, setShoppingListOpen] = useState(false);

  function handleSortModeChange(next: SortMode) {
    setSortMode(next);
    localStorage.setItem(SORT_STORAGE_KEY, next);
  }

  function handleViewModeChange(next: ViewMode) {
    setViewMode(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  useEffect(() => {
    if (deck) saveDeck(deck);
  }, [deck]);

  const hasSideboard = useMemo(
    () => (deck?.cards ?? []).some((c) => boardOfSection(c.section) === "sideboard"),
    [deck],
  );
  const hasConsidering = useMemo(
    () => (deck?.cards ?? []).some((c) => boardOfSection(c.section) === "considering"),
    [deck],
  );

  useEffect(() => {
    if (activeBoard === "sideboard" && !hasSideboard) setActiveBoard("main");
    if (activeBoard === "considering" && !hasConsidering) setActiveBoard("main");
  }, [activeBoard, hasSideboard, hasConsidering]);

  const displayedCards = useMemo(() => {
    if (!deck) return [];
    return filterCardsByBoard(deck.cards, activeBoard);
  }, [deck, activeBoard]);

  const { found, total } = useMemo(() => countCards(displayedCards), [displayedCards]);

  const activeMissing = useMemo(
    () => displayedCards.reduce((acc, c) => acc + Math.max(0, c.qty - c.found), 0),
    [displayedCards],
  );
  // Ensure all cards have scryfallId before rendering to avoid rate‑limited name lookups.
  // Keyed on deck.name so this only re-runs when a *different* deck is loaded, not on every card mark.
  const [ready, setReady] = useState<boolean>(() => {
    const initial = loadDeck();
    if (!initial) return false;
    return !initial.cards.some((c) => c.info && !c.info.scryfallId);
  });

  useEffect(() => {
    if (!deck) {
      setReady(false);
      return;
    }
    const needsEnrichment = deck.cards.some((c) => c.info && !c.info.scryfallId);
    if (!needsEnrichment) {
      setReady(true);
      return;
    }
    // Deck came from localStorage without scryfallIds — enrich before showing images.
    setReady(false);
    lookupCards(deck.cards.map((c) => c.name)).then((cardMap) => {
      setDeck((current) => {
        if (!current) return current;
        return {
          ...current,
          cards: current.cards.map((c) => {
            const fresh = cardMap.get(c.name.toLowerCase());
            return fresh
              ? {
                  ...c,
                  info: {
                    ...fresh,
                    scryfallId: c.info?.scryfallId || fresh.scryfallId,
                  },
                }
              : c;
          }),
        };
      });
      setReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck?.name]);

  const [updating, setUpdating] = useState(false);

  async function handleUpdateDeck() {
    if (!deck?.url || updating) return;
    setUpdating(true);
    try {
      const refreshed = await buildDeckFromUrl(deck.url, deck, true);
      setDeck(refreshed);
    } catch (err: any) {
      alert(err?.message || "Could not update deck. Check your connection and try again.");
    } finally {
      setUpdating(false);
    }
  }

  async function load(build: () => Promise<Deck>) {
    setBusy(true);
    setError(undefined);
    try {
      const built = await build();
      setDeck(built);
      setReady(true);
      setImporting(false);
      setPreparedDeck(null);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste(text: string) {
    setBusy(true);
    setError(undefined);
    setLastPastedText(text);
    try {
      const prep = await prepareDeckFromText(text, deck);
      if (prep.eligibleCommanders.length === 0) {
        setDeck(finalizeDeck(prep, []));
        setReady(true);
        setImporting(false);
        setPreparedDeck(null);
        setQuery("");
      } else {
        setPreparedDeck(prep);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function markCard(name: string, delta: number, scryfallId?: string) {
    setDeck((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((card) =>
              card.name === name && (!scryfallId || card.info?.scryfallId === scryfallId)
                ? { ...card, found: Math.max(0, Math.min(card.qty, card.found + delta)) }
                : card,
            ),
          }
        : current,
    );
  }

  function submitQuery() {
    const needle = query.trim().toLowerCase();
    if (!needle || !deck) return;
    const activeMatch = displayedCards.find(
      (c) => c.found < c.qty && c.name.toLowerCase().includes(needle),
    );
    if (activeMatch) {
      markCard(activeMatch.name, 1, activeMatch.info?.scryfallId);
      setQuery("");
      return;
    }
    const anyMatch = deck.cards.find(
      (c) => c.found < c.qty && c.name.toLowerCase().includes(needle),
    );
    if (anyMatch) {
      const matchBoard = boardOfSection(anyMatch.section);
      if (activeBoard !== "all" && activeBoard !== matchBoard) {
        setActiveBoard(matchBoard);
      }
      markCard(anyMatch.name, 1, anyMatch.info?.scryfallId);
      setQuery("");
    }
  }

  if (importing || !deck) {
    return (
      <div className="wrap">
        <header className="landing-header">
          <div className="landing-header-content">
            <div>
              <h1 className="landing-title">Deck Tally</h1>
              <p className="landing-tagline">
                Check a physical Magic deck against its decklist, card by card.
              </p>
            </div>
            {deck !== null && (
              <button
                type="button"
                className="btn-resume-deck"
                onClick={() => {
                  setError(undefined);
                  setPreparedDeck(null);
                  setImporting(false);
                }}
              >
                <span>← Return to <strong>{deck.name || "current deck"}</strong></span>
                <span className="resume-stat mono">{found} / {total} found</span>
              </button>
            )}
          </div>
        </header>
        {preparedDeck ? (
          <CommanderPicker
            eligibleCards={preparedDeck.eligibleCommanders}
            initialSelected={preparedDeck.suggestedCommanders}
            onConfirm={(commanders) => {
              const finalDeck = finalizeDeck(preparedDeck, commanders);
              setDeck(finalDeck);
              setReady(true);
              setPreparedDeck(null);
              setImporting(false);
              setQuery("");
            }}
            onCancel={() => {
              setPreparedDeck(null);
            }}
          />
        ) : (
          <ImportPanel
            initialText={lastPastedText ?? (deck?.source === "paste" ? deck.rawText : undefined)}
            busy={busy}
            error={error}
            canCancel={deck !== null}
            onPaste={handlePaste}
            onLink={(url) => load(() => buildDeckFromUrl(url, deck))}
            onCancel={() => {
              setError(undefined);
              setPreparedDeck(null);
              setImporting(false);
            }}
          />
        )}
      </div>
    );
  }

  // Wait for ID enrichment before showing card images to avoid rate‑limited name lookups.
  if (!ready) {
    return (
      <div className="wrap">
        <p style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}>Loading deck…</p>
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
        sortMode={sortMode}
        viewMode={viewMode}
        activeBoard={activeBoard}
        onQuery={setQuery}
        onSortMode={handleSortModeChange}
        onViewMode={handleViewModeChange}
        onBoardChange={setActiveBoard}
        onOpenShoppingList={() => setShoppingListOpen(true)}
        missingCount={activeMissing}
        onSubmitQuery={submitQuery}
        onReset={() => setDeck({ ...deck, cards: deck.cards.map((card) => ({ ...card, found: 0 })) })}
        onChangeDeck={() => {
          setImporting(true);
        }}
        onUpdate={handleUpdateDeck}
        updating={updating}
      />
      <main>
        <CardList
          deck={deck}
          cards={displayedCards}
          sortMode={sortMode}
          viewMode={viewMode}
          query={query}
          onMark={markCard}
        />
      </main>
      <ShoppingListModal
        cards={deck.cards}
        deckName={deck.name}
        isOpen={shoppingListOpen}
        onClose={() => setShoppingListOpen(false)}
        activeBoard={activeBoard}
      />
    </div>
  );
}
