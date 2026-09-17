import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardList } from "./components/CardList";
import { CelebrationBanner } from "./components/CelebrationBanner";
import { CommanderPicker } from "./components/CommanderPicker";
import { ConfettiCanvas } from "./components/ConfettiCanvas";
import { DeckHeader } from "./components/DeckHeader";
import { ImportPanel } from "./components/ImportPanel";
import { ShoppingListModal } from "./components/ShoppingListModal";
import { UndoToast, type ToastInfo } from "./components/UndoToast";
import { buildDeckFromUrl, finalizeDeck, prepareDeckFromText, type PreparedDeck } from "./lib/buildDeck";
import { boardOfSection, countCards, filterCardsByBoard } from "./lib/grouping";
import { lookupCards } from "./lib/cards";
import { loadDeck, saveDeck } from "./lib/storage";
import type { BoardType, Deck, SortMode, ViewMode } from "./lib/types";

type UndoEntry = {
  name: string;
  delta: number;
  scryfallId?: string;
};

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
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevFoundRef = useRef<number | null>(null);
  const prevBoardRef = useRef<BoardType>(activeBoard);

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

  useEffect(() => {
    if (prevBoardRef.current !== activeBoard) {
      prevBoardRef.current = activeBoard;
      prevFoundRef.current = found;
      setShowCelebration(false);
      setShowConfetti(false);
      return;
    }
    if (
      prevFoundRef.current !== null &&
      prevFoundRef.current < total &&
      found === total &&
      total > 0
    ) {
      setShowCelebration(true);
      setShowConfetti(true);
    } else if (found < total && showCelebration) {
      setShowCelebration(false);
      setShowConfetti(false);
    }
    prevFoundRef.current = found;
  }, [found, total, activeBoard, showCelebration]);
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

  function markCard(name: string, delta: number, scryfallId?: string, isUndo = false) {
    setDeck((current) => {
      if (!current) return current;
      const target = current.cards.find(
        (card) => card.name === name && (!scryfallId || card.info?.scryfallId === scryfallId),
      );
      if (!target) return current;

      const newFound = Math.max(0, Math.min(target.qty, target.found + delta));
      const actualDelta = newFound - target.found;
      if (actualDelta === 0) return current;

      if (!isUndo) {
        setUndoStack((prev) => [
          ...prev.slice(-29),
          { name: target.name, delta: actualDelta, scryfallId: target.info?.scryfallId },
        ]);
        setToast({
          id: Date.now(),
          message: actualDelta > 0 ? `Found: ${target.name}` : `Unchecked: ${target.name}`,
          cardName: target.name,
          actionType: actualDelta > 0 ? "found" : "unfound",
        });
      } else {
        setToast({
          id: Date.now(),
          message: `Undid: ${target.name}`,
          cardName: target.name,
          actionType: "undone",
        });
      }

      return {
        ...current,
        cards: current.cards.map((card) =>
          card.name === name && (!scryfallId || card.info?.scryfallId === scryfallId)
            ? { ...card, found: newFound }
            : card,
        ),
      };
    });
  }

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      markCard(last.name, -last.delta, last.scryfallId, true);
      return prev.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // Ctrl+F or Cmd+F: Global search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const searchInput = document.getElementById("card-search-input") as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // '/' quick-search hotkey when not in input
      if (e.key === "/" && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const searchInput = document.getElementById("card-search-input") as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Ctrl+Z or Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        handleUndo();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

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
      {showConfetti && <ConfettiCanvas onComplete={() => setShowConfetti(false)} />}
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
        onReset={() => {
          setDeck({ ...deck, cards: deck.cards.map((card) => ({ ...card, found: 0 })) });
          setUndoStack([]);
          setToast(null);
          setShowCelebration(false);
          setShowConfetti(false);
        }}
        onChangeDeck={() => {
          setImporting(true);
        }}
        onUpdate={handleUpdateDeck}
        updating={updating}
        onUndo={handleUndo}
        canUndo={undoStack.length > 0}
      />
      {showCelebration && (
        <CelebrationBanner
          total={total}
          boardName={
            activeBoard === "main"
              ? "Main Deck"
              : activeBoard === "sideboard"
              ? "Sideboard"
              : activeBoard === "considering"
              ? "Considering"
              : undefined
          }
          onDismiss={() => {
            setShowCelebration(false);
            setShowConfetti(false);
          }}
        />
      )}
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
      <UndoToast
        toast={toast}
        canUndo={undoStack.length > 0}
        onUndo={handleUndo}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
