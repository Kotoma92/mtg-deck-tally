import { useEffect, useRef, useState } from "react";
import { cardArtUrl } from "../lib/cards";
import { colorLabel } from "../lib/colors";
import type { Deck, SortMode, ViewMode } from "../lib/types";

type Props = {
  deck: Deck;
  found: number;
  total: number;
  query: string;
  sortMode: SortMode;
  viewMode: ViewMode;
  onQuery: (value: string) => void;
  onSortMode: (mode: SortMode) => void;
  onViewMode: (mode: ViewMode) => void;
  onSubmitQuery?: () => void;
  onReset: () => void;
  onChangeDeck: () => void;
  onUpdate?: () => void;
  updating?: boolean;
};

function RefreshIcon({ spinning, className = "", size = 15 }: { spinning?: boolean; className?: string; size?: number }) {
  return (
    <svg
      className={`icon-refresh${spinning ? " is-spinning" : ""} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function DeckHeader({
  deck, found, total, query, sortMode, viewMode, updating,
  onQuery, onSortMode, onViewMode, onSubmitQuery, onReset, onChangeDeck, onUpdate,
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
  const getCommanderId = (name: string) =>
    deck.commanderCards?.find((c) => c.name.toLowerCase() === name.toLowerCase())?.info?.scryfallId ??
    deck.cards.find((c) => c.name.toLowerCase() === name.toLowerCase())?.info?.scryfallId;

  return (
    <header className="deck-header">
      <div className="deck-hero" ref={heroRef}>
        {art.length > 0 && (
          <div className="header-art" aria-hidden>
            {art.map((name) => (
              <img
                key={name}
                src={cardArtUrl(name, getCommanderId(name))}
                alt=""
                onError={() => markBroken(name)}
              />
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
                src={cardArtUrl(name, getCommanderId(name))}
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
                        onChangeDeck();
                      }}
                    >
                      Change deck
                    </button>
                  </div>
                )}
              </div>
              {onUpdate && deck.url && (
                <button
                  type="button"
                  className="header-menu-btn header-refresh-btn"
                  aria-label={updating ? "Updating deck…" : "Update deck"}
                  title={updating ? "Updating deck…" : "Update deck"}
                  disabled={updating}
                  onClick={onUpdate}
                >
                  <RefreshIcon spinning={updating} size={15} />
                </button>
              )}
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
          <div className="segmented view-toggle" role="group" aria-label="View mode">
            <button
              aria-pressed={viewMode === "text"}
              onClick={() => onViewMode("text")}
              title="Text list view"
            >
              <span className="label-full">Text</span>
              <span className="label-short">Text</span>
            </button>
            <button
              aria-pressed={viewMode === "stacked"}
              onClick={() => onViewMode("stacked")}
              title="Visual stacked grid"
            >
              <span className="label-full">Stacked</span>
              <span className="label-short">Stack</span>
            </button>
            <button
              aria-pressed={viewMode === "full"}
              onClick={() => onViewMode("full")}
              title="Full card image grid"
            >
              <span className="label-full">Full View</span>
              <span className="label-short">Full</span>
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
            <button onClick={onChangeDeck}>Change deck</button>
            {onUpdate && deck.url && (
              <button
                type="button"
                className="btn-update-deck"
                disabled={updating}
                onClick={onUpdate}
                aria-label={updating ? "Updating deck…" : "Update deck"}
                title={updating ? "Updating deck…" : "Update deck"}
              >
                <RefreshIcon spinning={updating} size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </header>
  );
}
