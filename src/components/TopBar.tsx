// src/components/TopBar.tsx
import React, { useEffect, useRef, useState } from "react";

type PanelMode = "layers" | "features" | null;

interface TopBarProps {
  searchOpen: boolean;
  onSearchToggle: (open: boolean) => void;
  onSearch: (term: string) => Promise<void> | void;
  panelMode: PanelMode;
  onPanelChange: (mode: PanelMode) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchOpen,
  onSearchToggle,
  onSearch,
  panelMode,
  onPanelChange
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!searchOpen) {
      setQuery("");
    }
  }, [searchOpen]);

  const submitSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await onSearch(query.trim());
  };

  return (
    <header className="toolbar-root topbar-root">
      <div className="toolbar-group toolbar-brand">
        <div className="toolbar-logo">GOVMAP STUDIO</div>
      </div>

      <div className={`topbar-search ${searchOpen ? "topbar-search--open" : "topbar-search--closed"}`}>
        <form className="topbar-search-form" onSubmit={submitSearch}>
          <span className="topbar-search-icon">⌕</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="חפש כתובת, מקום או נקודת עניין…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="topbar-search-clear"
              onClick={() => setQuery("")}
              aria-label="ניקוי חיפוש"
            >
              ✕
            </button>
          )}
          <button type="submit" className="btn primary" disabled={!query.trim()}>
            חפש
          </button>
        </form>
      </div>

      <div className="toolbar-group topbar-actions">
        <button
          type="button"
          className={`topbar-icon ${searchOpen ? "topbar-icon--active" : ""}`}
          onClick={() => onSearchToggle(!searchOpen)}
          aria-label="חיפוש"
        >
          <img src="/logos/search-interface-symbol.png" alt="חיפוש" />
        </button>

        <button
          type="button"
          className={`topbar-icon ${panelMode === "layers" ? "topbar-icon--active" : ""}`}
          onClick={() => onPanelChange(panelMode === "layers" ? null : "layers")}
          aria-label="שכבות"
        >
          <img src="/logos/layers.png" alt="שכבות" />
        </button>

        <button
          type="button"
          className={`topbar-icon ${panelMode === "features" ? "topbar-icon--active" : ""}`}
          onClick={() => onPanelChange(panelMode === "features" ? null : "features")}
          aria-label="פיצ'רים"
        >
          <img src="/logos/menu.png" alt="פיצ'רים" />
        </button>
      </div>
    </header>
  );
};
