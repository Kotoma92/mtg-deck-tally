import { useEffect, useMemo, useState } from "react";
import { boardOfSection } from "../lib/grouping";
import type { BoardType, DeckCard } from "../lib/types";

type Props = {
  cards: DeckCard[];
  deckName?: string;
  isOpen: boolean;
  onClose: () => void;
  activeBoard?: BoardType;
};

export function ShoppingListModal({ cards, deckName, isOpen, onClose, activeBoard = "main" }: Props) {
  const [includeMain, setIncludeMain] = useState(() => activeBoard !== "considering" && activeBoard !== "sideboard");
  const [includeSideboard, setIncludeSideboard] = useState(() => activeBoard === "sideboard" || activeBoard === "all");
  const [includeConsidering, setIncludeConsidering] = useState(() => activeBoard === "considering" || activeBoard === "all");
  const [copied, setCopied] = useState(false);

  // Sync checkboxes whenever modal opens or active board changes
  useEffect(() => {
    if (!isOpen) return;
    if (activeBoard === "considering") {
      setIncludeMain(false);
      setIncludeSideboard(false);
      setIncludeConsidering(true);
    } else if (activeBoard === "sideboard") {
      setIncludeMain(false);
      setIncludeSideboard(true);
      setIncludeConsidering(false);
    } else if (activeBoard === "all") {
      setIncludeMain(true);
      setIncludeSideboard(true);
      setIncludeConsidering(true);
    } else {
      setIncludeMain(true);
      setIncludeSideboard(false);
      setIncludeConsidering(false);
    }
  }, [isOpen, activeBoard]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Compute missing cards by board
  const missingByBoard = useMemo(() => {
    const main: { card: DeckCard; missingQty: number }[] = [];
    const sideboard: { card: DeckCard; missingQty: number }[] = [];
    const considering: { card: DeckCard; missingQty: number }[] = [];

    for (const card of cards) {
      const missing = card.qty - card.found;
      if (missing <= 0) continue;

      const board = boardOfSection(card.section);
      if (board === "sideboard") {
        sideboard.push({ card, missingQty: missing });
      } else if (board === "considering") {
        considering.push({ card, missingQty: missing });
      } else {
        main.push({ card, missingQty: missing });
      }
    }

    return { main, sideboard, considering };
  }, [cards]);

  const hasSideboard = cards.some((c) => boardOfSection(c.section) === "sideboard");
  const hasConsidering = cards.some((c) => boardOfSection(c.section) === "considering");

  const totalMainMissing = missingByBoard.main.reduce((acc, c) => acc + c.missingQty, 0);
  const totalSideMissing = missingByBoard.sideboard.reduce((acc, c) => acc + c.missingQty, 0);
  const totalConsiderMissing = missingByBoard.considering.reduce((acc, c) => acc + c.missingQty, 0);

  // Filtered active missing items
  const activeItems = useMemo(() => {
    const items: { card: DeckCard; missingQty: number; section: string }[] = [];
    if (includeMain) {
      items.push(...missingByBoard.main.map((m) => ({ ...m, section: "Main Deck" })));
    }
    if (includeSideboard && hasSideboard) {
      items.push(...missingByBoard.sideboard.map((m) => ({ ...m, section: "Sideboard" })));
    }
    if (includeConsidering && hasConsidering) {
      items.push(...missingByBoard.considering.map((m) => ({ ...m, section: "Considering" })));
    }
    return items;
  }, [includeMain, includeSideboard, includeConsidering, hasSideboard, hasConsidering, missingByBoard]);

  const totalMissingCount = activeItems.reduce((acc, item) => acc + item.missingQty, 0);

  // Generate plain text export string
  const exportText = useMemo(() => {
    const sections: string[] = [];

    if (includeMain && missingByBoard.main.length > 0) {
      if (hasSideboard || hasConsidering) {
        sections.push(`// Main Deck (${totalMainMissing})`);
      }
      sections.push(missingByBoard.main.map((m) => `${m.missingQty} ${m.card.name}`).join("\n"));
    }

    if (includeSideboard && hasSideboard && missingByBoard.sideboard.length > 0) {
      sections.push(`// Sideboard (${totalSideMissing})`);
      sections.push(missingByBoard.sideboard.map((m) => `${m.missingQty} ${m.card.name}`).join("\n"));
    }

    if (includeConsidering && hasConsidering && missingByBoard.considering.length > 0) {
      sections.push(`// Considering (${totalConsiderMissing})`);
      sections.push(missingByBoard.considering.map((m) => `${m.missingQty} ${m.card.name}`).join("\n"));
    }

    return sections.join("\n\n");
  }, [
    includeMain,
    includeSideboard,
    includeConsidering,
    hasSideboard,
    hasConsidering,
    missingByBoard,
    totalMainMissing,
    totalSideMissing,
    totalConsiderMissing,
  ]);

  async function handleCopy() {
    if (!exportText) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = exportText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleDownload() {
    if (!exportText) return;
    const filename = `${deckName ? deckName.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "deck"}-missing-cards.txt`;
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 id="modal-title" className="modal-title">
              Shopping List / Missing Cards
            </h2>
            <p className="modal-subtitle">
              {totalMissingCount === 0
                ? "All selected cards are accounted for!"
                : `${totalMissingCount} card${totalMissingCount === 1 ? "" : "s"} left to acquire`}
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {(hasSideboard || hasConsidering) && (
            <div className="modal-board-toggles">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={includeMain}
                  onChange={(e) => setIncludeMain(e.target.checked)}
                />
                Main Deck ({totalMainMissing})
              </label>
              {hasSideboard && (
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={includeSideboard}
                    onChange={(e) => setIncludeSideboard(e.target.checked)}
                  />
                  Sideboard ({totalSideMissing})
                </label>
              )}
              {hasConsidering && (
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={includeConsidering}
                    onChange={(e) => setIncludeConsidering(e.target.checked)}
                  />
                  Considering ({totalConsiderMissing})
                </label>
              )}
            </div>
          )}

          {activeItems.length === 0 ? (
            <div className="modal-empty">
              <p>🎉 All selected cards have been checked off!</p>
            </div>
          ) : (
            <textarea
              className="modal-export-text"
              readOnly
              value={exportText}
              rows={Math.min(16, Math.max(6, activeItems.length + 2))}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              aria-label="Missing cards export list"
            />
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
          {activeItems.length > 0 && (
            <>
              <button type="button" onClick={handleDownload} title="Download as .txt file">
                Download .txt
              </button>
              <button type="button" className="primary" onClick={handleCopy}>
                {copied ? "✓ Copied to Clipboard!" : "Copy to Clipboard"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
