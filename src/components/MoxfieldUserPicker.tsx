import { useEffect, useMemo, useState } from "react";
import { colorLabel } from "../lib/colors";
import { manaSymbolUrl } from "./ManaCost";

const USER_KEY = "mtg-deck-tally/moxfield-user";

export type MoxfieldDeckSummary = {
  publicId: string;
  name: string;
  format: string;
  colors: string[];
  mainboardCount: number;
  lastUpdatedAtUtc?: string;
  publicUrl: string;
};

type Props = {
  busy: boolean;
  onSelectDeck: (url: string) => void;
};

function formatDate(isoString?: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

export function MoxfieldUserPicker({ busy, onSelectDeck }: Props) {
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY) || "");
  const [inputVal, setInputVal] = useState(username);
  const [isEditingUser, setIsEditingUser] = useState(!username);
  const [decks, setDecks] = useState<MoxfieldDeckSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState("");

  async function fetchUserDecks(userToFetch: string) {
    const trimmed = userToFetch.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(undefined);

    try {
      const res = await fetch(`/api/moxfield/decks?username=${encodeURIComponent(trimmed)}`);
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || `Could not fetch decks (status ${res.status})`);
      }

      const list: MoxfieldDeckSummary[] = (payload.data || []).map((d: any) => ({
        publicId: d.publicId,
        name: d.name,
        format: d.format,
        colors: d.colors || [],
        mainboardCount: d.mainboardCount || 0,
        lastUpdatedAtUtc: d.lastUpdatedAtUtc,
        publicUrl: d.publicUrl || `https://moxfield.com/decks/${d.publicId}`,
      }));

      setDecks(list);
      setUsername(trimmed);
      localStorage.setItem(USER_KEY, trimmed);
      setIsEditingUser(false);
    } catch (err: any) {
      setError(err?.message || "Failed to load decks from Moxfield.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (username) {
      fetchUserDecks(username);
    }
  }, []);

  const filteredDecks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.format.toLowerCase().includes(q) ||
        colorLabel(d.colors).toLowerCase().includes(q),
    );
  }, [decks, search]);

  return (
    <div className="mox-picker">
      {isEditingUser || !username ? (
        <form
          className="mox-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            fetchUserDecks(inputVal);
          }}
        >
          <p className="help">
            Enter your <strong>Moxfield username</strong> to load all your public decks. Your username will be
            remembered for next time.
          </p>
          <div className="mox-user-inputs">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="e.g. username"
              aria-label="Moxfield username"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              disabled={loading}
            />
            <button type="submit" className="primary" disabled={loading || !inputVal.trim()}>
              {loading ? "Loading…" : "Load decks"}
            </button>
            {username && (
              <button type="button" onClick={() => setIsEditingUser(false)} disabled={loading}>
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="mox-user-bar">
          <div className="mox-user-info">
            <span>
              Decks for <strong>{username}</strong> ({decks.length})
            </span>
          </div>
          <div className="mox-user-actions">
            <button
              type="button"
              className="mox-btn-text"
              onClick={() => fetchUserDecks(username)}
              disabled={loading || busy}
              title="Refresh deck list"
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              className="mox-btn-text"
              onClick={() => {
                setInputVal(username);
                setIsEditingUser(true);
              }}
              disabled={loading || busy}
            >
              Change user
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {!isEditingUser && username && !error && (
        <>
          {decks.length > 5 && (
            <div className="mox-filter-row">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter your decks…"
                aria-label="Filter decks"
              />
            </div>
          )}

          {loading ? (
            <p className="empty-msg">Fetching decks from Moxfield…</p>
          ) : filteredDecks.length === 0 ? (
            <p className="empty-msg">
              {decks.length === 0
                ? "No public decks found for this user."
                : `No decks match "${search}".`}
            </p>
          ) : (
            <div className="mox-deck-grid" role="list" aria-label="Moxfield decks">
              {filteredDecks.map((deck) => {
                const label = colorLabel(deck.colors);
                return (
                  <button
                    key={deck.publicId}
                    type="button"
                    className="mox-deck-card"
                    onClick={() => onSelectDeck(deck.publicUrl)}
                    disabled={busy}
                    aria-label={`Tally ${deck.name}`}
                  >
                    <div className="mox-deck-header">
                      <span className="mox-deck-title">{deck.name}</span>
                      <span className="mox-deck-format">{deck.format}</span>
                    </div>
                    <div className="mox-deck-footer">
                      <div className="mox-deck-identity">
                        <span className="mox-deck-pips" aria-label={`Colors: ${label}`}>
                          {deck.colors.length > 0 ? (
                            deck.colors.map((c) => (
                              <img
                                key={c}
                                className="mana-pip"
                                src={manaSymbolUrl(c)}
                                alt={c}
                                loading="lazy"
                                aria-hidden="true"
                              />
                            ))
                          ) : (
                            <img
                              className="mana-pip"
                              src={manaSymbolUrl("C")}
                              alt="Colorless"
                              loading="lazy"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="mox-deck-meta">
                          {label} • {deck.mainboardCount} cards
                        </span>
                      </div>
                      {deck.lastUpdatedAtUtc && (
                        <span className="mox-deck-date">{formatDate(deck.lastUpdatedAtUtc)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
