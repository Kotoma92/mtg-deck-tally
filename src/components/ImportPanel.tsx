import { useState } from "react";

type Props = {
  initialText?: string;
  busy: boolean;
  error?: string;
  canCancel: boolean;
  onPaste: (text: string) => void;
  onLink: (url: string) => void;
  onCancel: () => void;
};

export function ImportPanel({ initialText, busy, error, canCancel, onPaste, onLink, onCancel }: Props) {
  const [mode, setMode] = useState<"link" | "paste">(initialText ? "paste" : "link");
  const [text, setText] = useState(initialText ?? "");
  const [url, setUrl] = useState("");

  return (
    <section className="import-panel">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === "link"} onClick={() => setMode("link")}>
          From a link
        </button>
        <button role="tab" aria-selected={mode === "paste"} onClick={() => setMode("paste")}>
          Paste a list
        </button>
      </div>

      {mode === "link" ? (
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
