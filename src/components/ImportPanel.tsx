import { useState } from "react";
import { MoxfieldUserPicker } from "./MoxfieldUserPicker";

type Props = {
  initialText?: string;
  busy: boolean;
  error?: string;
  canCancel: boolean;
  onPaste: (text: string) => void;
  onLink: (url: string) => void;
  onCancel: () => void;
};

const SAMPLE_PASTE_DECK = `Commander
1 The Archimandrite

Deck
1 Brainstorm
1 Counterspell
1 Sol Ring
1 Swords to Plowshares
1 Rhystic Study
1 Smothering Tithe
1 Cyclonic Rift
1 Teferi's Protection
1 Lightning Greaves
1 Arcane Signet
1 Command Tower
1 Hallowed Fountain
1 Sacred Foundry
1 Steam Vents
1 Flooded Strand

Sideboard
1 Rest in Peace
1 Silence
1 Flusterstorm

Considering
1 Esper Sentinel
1 Fierce Guardianship`;

export function ImportPanel({ initialText, busy, error, canCancel, onPaste, onLink, onCancel }: Props) {
  const hasSavedUser = typeof window !== "undefined" && !!localStorage.getItem("mtg-deck-tally/moxfield-user");
  const [mode, setMode] = useState<"moxfield" | "link" | "paste">(() => {
    if (initialText) return "paste";
    if (hasSavedUser) return "moxfield";
    return "moxfield";
  });
  const [text, setText] = useState(initialText ?? "");
  const [url, setUrl] = useState("");

  return (
    <section className="import-panel">
      <div className="tabs landing-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "moxfield"} onClick={() => setMode("moxfield")}>
          <span className="tab-icon">🎴</span> Moxfield decks
        </button>
        <button role="tab" aria-selected={mode === "link"} onClick={() => setMode("link")}>
          <span className="tab-icon">🔗</span> From a link
        </button>
        <button role="tab" aria-selected={mode === "paste"} onClick={() => setMode("paste")}>
          <span className="tab-icon">📋</span> Paste a list
        </button>
      </div>

      {mode === "moxfield" ? (
        <MoxfieldUserPicker busy={busy} onSelectDeck={onLink} />
      ) : mode === "link" ? (
        <form
          className="link-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (url.trim()) onLink(url.trim());
          }}
        >
          <p className="help">
            Paste a <strong>Moxfield</strong> or <strong>Archidekt</strong> deck link. The deck needs to be
            public, and its commander comes straight from the site, so the colors are always right.
          </p>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://moxfield.com/decks/..."
            aria-label="Deck link"
            autoComplete="off"
          />
          <div className="sample-chips">
            <span className="sample-label">Try a demo:</span>
            <button
              type="button"
              className="sample-chip"
              onClick={() => {
                setUrl("https://moxfield.com/decks/fazbKkJmokaC4uDKjWTxFQ");
                onLink("https://moxfield.com/decks/fazbKkJmokaC4uDKjWTxFQ");
              }}
              disabled={busy}
            >
              Zhulodok Eldrazi (Moxfield)
            </button>
            <button
              type="button"
              className="sample-chip"
              onClick={() => {
                setUrl("https://archidekt.com/decks/4172826");
                onLink("https://archidekt.com/decks/4172826");
              }}
              disabled={busy}
            >
              The Archimandrite (Archidekt)
            </button>
          </div>
          <div className="actions">
            {canCancel && (
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="primary" disabled={busy || !url.trim()}>
              {busy ? "Importing…" : "Import deck"}
            </button>
          </div>
        </form>
      ) : (
        <form
          className="paste-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) onPaste(text);
          }}
        >
          <p className="help">
            In Moxfield: open the deck → the <strong>⋯</strong> menu → <strong>Export</strong> →{" "}
            <strong>Text</strong>. Quantities, section headings, set codes and foil markers are all handled.
          </p>
          <div className="sample-chips">
            <span className="sample-label">Need a list to test?</span>
            <button
              type="button"
              className="sample-chip"
              onClick={() => setText(SAMPLE_PASTE_DECK)}
              disabled={busy}
            >
              Paste Archimandrite + Sideboard
            </button>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Sol Ring\n8 Mountain"}
            aria-label="Decklist"
            spellCheck={false}
          />
          <div className="actions">
            {canCancel && (
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="primary" disabled={busy || !text.trim()}>
              {busy ? "Reading…" : "Build checklist"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
