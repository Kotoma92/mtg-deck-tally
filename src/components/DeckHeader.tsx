import { useEffect, useRef, useState } from "react";
import { cardArtUrl } from "../lib/cards";
import { colorLabel } from "../lib/colors";
import type { ColumnLayout, Deck, SortMode } from "../lib/types";

type Props = {
  deck: Deck;
  found: number;
  total: number;
  query: string;
  sortMode: SortMode;
  layout: ColumnLayout;
  onQuery: (value: string) => void;
  onSortMode: (mode: SortMode) => void;
  onLayout: (layout: ColumnLayout) => void;
  onSubmitQuery?: () => void;
  onReset: () => void;
  onEdit: () => void;
  onNew: () => void;
};

export function DeckHeader({
  deck, found, total, query, sortMode, layout,
  onQuery, onSortMode, onLayout, onSubmitQuery, onReset, onEdit, onNew,
}: Props) {
  const remaining = total - found;
  const [broken, setBroken] = useState<string[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsScrolled(!entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".header-menu-container")) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  // A card with no art on Scryfall shouldn't leave a broken image in the banner.
  const art = deck.commanders.filter((name) => !broken.includes(name));
  const markBroken = (name: string) => setBroken((current) => [...current, name]);

  return (
    <header className="deck-header">
      <div className="deck-hero" ref={heroRef}>
        {art.length > 0 && (
          <div className="header-art" aria-hidden>
            {art.map((name) => (
              <img key={name} src={cardArtUrl(name)} alt="" onError={() => markBroken(name)} />
            ))}
          </div>
        )}

        <div className="header-inner">
          <div className="title-row">
            <div>
              <h1>Deck Tally</h1>
              <p className="tagline">
                {remaining === 0
                  ? "Every card accounted for."
                  : `${remaining} card${remaining === 1 ? "" : "s"} left to find.`}
              </p>
            </div>
            <div className="progress-stat mono hero-stat">
              {found} / {total} <span>found</span>
            </div>
          </div>

          <div className="deck-meta">
            {art.map((name) => (
              <img
                key={name}
                className="commander-thumb"
                src={cardArtUrl(name)}
                alt={name}
                title={name}
                onError={() => markBroken(name)}
              />
            ))}
            <div className="deck-meta-text">
              {deck.name && (
                <span className="deck-name">
                  {deck.url ? (
                    <a href={deck.url} target="_blank" rel="noreferrer noopener">
                      {deck.name}
                    </a>
                  ) : (
                    deck.name
                  )}
                </span>
              )}
              {deck.commanders.length > 0 && (
                <span className="commander">
                  {deck.commanders.join(" + ")}
                  <span className="identity">{colorLabel(deck.colors)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="hero-search-row">
            <input
              type="search"
              className="search-input"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && onSubmitQuery) {
                  event.preventDefault();
                  onSubmitQuery();
                }
              }}
              placeholder="Jump to a card… (Enter to check)"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <div className="sticky-bar">
        <div className="header-inner">
          {/* Compact header shown on mobile when scrolled */}
          <div className="compact-header">
            <div className={`compact-deck-info ${isScrolled ? "visible" : ""}`}>
              {deck.name && (
                <span className="compact-deck-name" title={deck.name}>
                  {deck.name}
                </span>
              )}
              {deck.commanders.length > 0 && (
                <span className="compact-commander" title={deck.commanders.join(" + ")}>
                  <span className="commander-symbol">⌘</span> {deck.commanders.join(" + ")}
                </span>
              )}
            </div>
            <div className="compact-right">
              <div className="progress-stat mono">
                {found} / {total} <span>found</span>
              </div>
              <div className="header-menu-container">
                <button
                  type="button"
                  className="header-menu-btn"
                  aria-label="More actions"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((prev) => !prev);
                  }}
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div className="header-menu-dropdown">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        if (found === 0 || window.confirm("Reset all checkmarks?")) {
                          onReset();
                        }
                      }}
                    >
                      Reset checkmarks
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit();
                      }}
                    >
                      Edit list
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onNew();
                      }}
                    >
                      New deck
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="progress-rail">
            <div className="progress-fill" style={{ width: total ? `${(found / total) * 100}%` : 0 }} />
          </div>

          <div className="controls-row">
            <input
              type="search"
              className="search-input desktop-search-input"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && onSubmitQuery) {
                event.preventDefault();
                onSubmitQuery();
              }
            }}
            placeholder="Jump to a card… (Enter to check)"
            autoComplete="off"
          />
          <div className="segmented sort-toggle" role="group" aria-label="Sort and group cards by">
            <button
              aria-pressed={sortMode === "alpha"}
              onClick={() => onSortMode("alpha")}
              title="Sort alphabetically A–Z"
            >
              <span className="label-full">Alphabetical</span>
              <span className="label-short">A–Z</span>
            </button>
            <button
              aria-pressed={sortMode === "mana"}
              onClick={() => onSortMode("mana")}
              title="Group by mana value curve"
            >
              <span className="label-full">Mana Value</span>
              <span className="label-short">CMC</span>
            </button>
            <button
              aria-pressed={sortMode === "type"}
              onClick={() => onSortMode("type")}
              title="Group by card type"
            >
              <span className="label-full">Type</span>
              <span className="label-short">Type</span>
            </button>
          </div>
          <div className="segmented layout-toggle" role="group" aria-label="Columns">
            <button
              aria-pressed={layout === "auto"}
              onClick={() => onLayout("auto")}
              title="Auto columns based on screen width"
            >
              Auto
            </button>
            <button
              aria-pressed={layout === "1"}
              onClick={() => onLayout("1")}
              title="1 column"
            >
              1
            </button>
            <button
              aria-pressed={layout === "2"}
              onClick={() => onLayout("2")}
              title="2 columns"
            >
              2
            </button>
            <button
              aria-pressed={layout === "3"}
              onClick={() => onLayout("3")}
              title="3 columns"
            >
              3
            </button>
            <button
              aria-pressed={layout === "4"}
              onClick={() => onLayout("4")}
              title="4 columns"
            >
              4
            </button>
          </div>
          <div className="header-action-btns">
            <button
              onClick={() => {
                if (found === 0 || window.confirm("Reset all checkmarks?")) {
                  onReset();
                }
              }}
              title="Clear all checkmarks"
            >
              Reset
            </button>
            <button onClick={onEdit}>Edit list</button>
            <button onClick={onNew}>New deck</button>
          </div>
        </div>
      </div>
    </div>
  </header>
  );
}
