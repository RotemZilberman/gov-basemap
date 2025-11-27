// src/components/AiCommandBar.tsx
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";

interface AiCommandBarProps {
  open: boolean;
  onToggle: (next: boolean) => void;
}

export const AiCommandBar: React.FC<AiCommandBarProps> = ({ open, onToggle }) => {
  const [value, setValue] = useState("");
  const portalTarget = useMemo(() => (typeof document !== "undefined" ? document.body : null), []);

  const handleFabClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // eslint-disable-next-line no-console
    console.info("[AI] toggle open", !open);
    onToggle(!open);
  };

  const handleClose = () => {
    onToggle(false);
    setValue("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    // פה בעתיד תתחבר ל־LLM
    console.log("AI command:", value);
    setValue("");
  };

  const content = (
    <div
      className="ai-command-shell"
      style={{
        zIndex: 2147483000,
        left: 0,
        right: 0,
        bottom: 24,
        position: "fixed",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "auto",
      }}
    >
      <form
        className={`ai-command ${open ? "ai-command--open" : "ai-command--closed"}`}
        style={
          open
            ? {
                width: "min(1400px, calc(100vw - 32px))",
                padding: "10px 18px 10px 18px",
                margin: "0 auto",
              }
            : { width: 64, height: 64, padding: 0, justifyContent: "center" }
        }
        onSubmit={handleSubmit}
      >
        <button
          type="button"
          className="ai-orb"
          onClick={handleFabClick}
          aria-label="עוזר חכם"
          style={{
            pointerEvents: "auto",
            width: 64,
            height: 64,
            flex: "0 0 64px",
            borderRadius: "50%",
            padding: 0,
          }}
        >
          <span className="ai-orb-glow" />
          <span className="ai-orb-core">AI</span>
        </button>

        <div className="ai-command-middle">
          <input
            type="text"
            className="ai-command-input"
            placeholder="תן הוראה למפה…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!open}
          />
        </div>

        <div className="ai-command-actions">
          <button
            type="submit"
            className="btn primary ai-send-btn"
            disabled={!open || !value.trim()}
          >
            שלח
          </button>
          {open && (
            <button
              type="button"
              className="ai-close-btn"
              onClick={handleClose}
              aria-label="סגירת שורת העוזר"
            >
              ✕
            </button>
          )}
        </div>
      </form>
    </div>
  );

  if (!portalTarget) return content;
  return createPortal(content, portalTarget);
};
