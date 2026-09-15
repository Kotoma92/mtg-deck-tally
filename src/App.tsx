import { useEffect, useMemo, useState } from "react";
import { CardList } from "./components/CardList";
import { DeckHeader } from "./components/DeckHeader";
import { ImportPanel } from "./components/ImportPanel";
import { buildDeckFromText, buildDeckFromUrl } from "./lib/buildDeck";
import { canonicalColors, themeVars } from "./lib/colors";
import { countCards } from "./lib/grouping";
import { clearDeck, loadDeck, saveDeck } from "./lib/storage";
import type { Deck, GroupMode } from "./lib/types";

/** Follows the viewer's OS theme, and re-themes when they switch it. */
function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return dark;
}

export default function App() {
  const [deck, setDeck] = useState<Deck | null>(() => loadDeck());
  const [importing, setImporting] = useState(() => loadDeck() === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("section");
  const dark = usePrefersDark();

  useEffect(() => {
    if (deck) saveDeck(deck);
  }, [deck]);

  // Paint the commander's colours onto the whole page.
  useEffect(() => {
    const style = document.documentElement.style;
    const vars = themeVars(deck?.colors ?? [], dark);
    const managed = ["--accent", "--accent-soft", "--found", "--found-soft", "--paper", "--paper-raised", "--header-wash"];
    for (const name of managed) {
      if (vars[name]) style.setProperty(name, vars[name]);
      else style.removeProperty(name);
    }
  }, [deck?.colors, dark]);

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
    setDeck((current) => {
      if (!current) return current;
      return {
        ...current,
        cards: current.cards.map((card) =>
          card.name === name
            ? { ...card, found: Math.max(0, Math.min(card.qty, card.found + delta)) }
            : card,
        ),
      };
    });
  }

  function toggleColor(color: string) {
    setDeck((current) => {
      if (!current) return current;
      const next = current.colors.includes(color)
        ? current.colors.filter((c) => c !== color)
        : [...current.colors, color];
      return { ...current, colors: canonicalColors(next) };
    });
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
        onToggleColor={toggleColor}
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
