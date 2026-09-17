import { useEffect } from "react";

export type ToastInfo = {
  id: number;
  message: string;
  cardName: string;
  actionType: "found" | "unfound" | "undone";
};

type Props = {
  toast: ToastInfo | null;
  canUndo: boolean;
  onUndo: () => void;
  onDismiss: () => void;
};

export function UndoToast({ toast, canUndo, onUndo, onDismiss }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <aside className="undo-toast-container" aria-live="polite" aria-atomic="true">
      <div className="undo-toast">
        <span className="undo-toast-msg">{toast.message}</span>
        {toast.actionType !== "undone" && canUndo && (
          <button
            type="button"
            className="undo-toast-btn"
            onClick={onUndo}
            title="Undo last action (Ctrl+Z / Cmd+Z)"
          >
            Undo <span className="undo-toast-kbd mono">Ctrl+Z</span>
          </button>
        )}
        <button
          type="button"
          className="undo-toast-close"
          onClick={onDismiss}
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
