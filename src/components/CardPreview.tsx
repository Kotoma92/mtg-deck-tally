import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cardImageUrl } from "../lib/cards";

type Props = {
  name: string;
  scryfallId?: string;
  anchorRect: DOMRect;
};

const PREVIEW_WIDTH = 220;
const PREVIEW_HEIGHT = 307; // Standard 63:88 aspect ratio (220 * 88 / 63 ≈ 307px)
const GAP = 8;

export function CardPreview({ name, scryfallId, anchorRect }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  const stickyBar = document.querySelector(".sticky-bar");
  const stickyBottom = stickyBar ? stickyBar.getBoundingClientRect().bottom : 0;

  // Available clearance above the card row (taking the sticky header into account)
  const clearanceAbove = anchorRect.top - stickyBottom;

  // Position above if there is sufficient clearance, otherwise flip below
  let top: number;
  if (clearanceAbove >= PREVIEW_HEIGHT + GAP) {
    top = anchorRect.top - PREVIEW_HEIGHT - GAP;
  } else {
    top = anchorRect.bottom + GAP;
  }

  // Clamp vertical position so it never overflows above the sticky header or below the viewport
  const minTop = stickyBottom + GAP;
  const maxTop = window.innerHeight - PREVIEW_HEIGHT - GAP;
  if (maxTop >= minTop) {
    top = Math.max(minTop, Math.min(top, maxTop));
  }

  // Align with the right edge of the card row tile, clamped within horizontal viewport bounds
  let left = anchorRect.right - PREVIEW_WIDTH - GAP;
  left = Math.max(GAP, Math.min(left, window.innerWidth - PREVIEW_WIDTH - GAP));

  return createPortal(
    <img
      className="card-preview"
      src={cardImageUrl(name, "normal", scryfallId)}
      alt=""
      loading="eager"
      aria-hidden
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
      }}
    />,
    document.body
  );
}
