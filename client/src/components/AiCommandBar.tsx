// src/components/AiCommandBar.tsx
import React, { useMemo } from "react";
import { createPortal } from "react-dom";

interface AiCommandBarProps {
  open: boolean;
  onToggle: (next: boolean) => void;
}

export const AiCommandBar: React.FC<AiCommandBarProps> = ({ open, onToggle }) => {
  const portalTarget = useMemo(
    () => (typeof document !== "undefined" ? document.body : null),
    []
  );

  const handleFabClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(!open);
  };

  const content = !open ? (
    <div className="ai-command-shell" role="presentation">
      <button
        type="button"
        className="ai-orb ai-orb-fab"
        onClick={handleFabClick}
        aria-label="עוזר חכם"
      >
        <span className="ai-orb-glow" />
        <img src="/logos/bot_logo.png" alt="AI" className="ai-orb-icon" />
      </button>
    </div>
  ) : null;

  if (!portalTarget) return content;
  return createPortal(content, portalTarget);
};
