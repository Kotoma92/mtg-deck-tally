type Props = {
  total: number;
  boardName?: string;
  onDismiss: () => void;
};

export function CelebrationBanner({ total, boardName, onDismiss }: Props) {
  return (
    <div className="celebration-banner" role="alert">
      <div className="celebration-content">
        <span className="celebration-badge">🎉</span>
        <div className="celebration-text">
          <strong className="celebration-title">
            {boardName ? `${boardName} Complete!` : "Deck Complete!"}
          </strong>
          <span className="celebration-desc">
            All {total} cards have been accounted for. Physical pile is ready!
          </span>
        </div>
        <button
          type="button"
          className="celebration-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss completion announcement"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
