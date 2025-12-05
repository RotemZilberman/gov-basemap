// src/components/TopBar.tsx
import React, { useEffect, useRef, useState } from "react";
import type { SearchSuggestion } from "../lib/search";

type PanelMode = "layers" | "features" | null;

interface TopBarProps {
  searchOpen: boolean;
  onSearchToggle: (open: boolean) => void;
  onSearch: (term: string) => Promise<void> | void;
  onSuggest?: (term: string) => Promise<SearchSuggestion[]>;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => Promise<void> | void;
  panelMode: PanelMode;
  onPanelChange: (mode: PanelMode) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchOpen,
  onSearchToggle,
  onSearch,
  onSuggest,
  onSuggestionSelect,
  panelMode,
  onPanelChange
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const searchShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!searchOpen) {
      setQuery("");
      setSuggestions([]);
    }
  }, [searchOpen]);

  const submitSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await onSearch(query.trim());
    setSuggestions([]);
  };

  const handleSelectSuggestion = async (suggestion: SearchSuggestion) => {
    if (onSuggestionSelect) {
      await onSuggestionSelect(suggestion);
    } else {
      await onSearch(suggestion.title);
    }
    setSuggestions([]);
    setQuery(suggestion.title);
  };

  const handleSuggest = (term: string) => {
    if (!onSuggest) return;
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    if (!term.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        setSuggestBusy(true);
        const next = await onSuggest(term.trim());
        if (mountedRef.current) {
          setSuggestions(next);
        }
      } catch (err) {
        console.error("שגיאה בשליפת הצעות חיפוש", err);
      } finally {
        if (mountedRef.current) setSuggestBusy(false);
      }
    }, 320);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!searchOpen || suggestions.length === 0) return undefined;

    const handleClickOutside = (ev: MouseEvent) => {
      if (!searchShellRef.current) return;
      if (searchShellRef.current.contains(ev.target as Node)) return;
      setSuggestions([]);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen, suggestions.length]);

  return (
    <header className="toolbar-root topbar-root">
      <div className="toolbar-group toolbar-brand">
        <img src="/logos/main_logo.png" alt="GovMap Studio" className="toolbar-logo-img" />
      </div>

      <div className="toolbar-group topbar-actions">
        {searchOpen ? (
          <div className="topbar-search-shell" ref={searchShellRef}>
            <form className="topbar-search-form topbar-search-form--inline" onSubmit={submitSearch}>
              <div
                className={`topbar-search-field ${
                  query ? "topbar-search-field--active" : ""
                } ${suggestBusy ? "topbar-search-field--loading" : ""}`}
              >
                <img src="/logos/search.svg" alt="חיפוש" className="topbar-search-icon" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="חפש כתובת, מקום או נקודת עניין…"
                  value={query}
                  onChange={(e) => {
                    const next = e.target.value;
                    setQuery(next);
                    handleSuggest(next);
                  }}
                />
                {suggestBusy && <span className="topbar-search-spinner" aria-hidden />}
                {query && (
                  <button
                    type="button"
                    className="topbar-search-clear"
                    onClick={() => {
                      setQuery("");
                      setSuggestions([]);
                    }}
                    aria-label="ניקוי חיפוש"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                className="topbar-search-close"
                onClick={() => {
                  setSuggestions([]);
                  onSearchToggle(false);
                }}
                aria-label="סגירת חיפוש"
              >
                ✕
              </button>
            </form>

            {suggestions.length > 0 && (
              <div className="topbar-search-suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="topbar-suggestion-row"
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    <div className="topbar-suggestion-main">
                      <div className="topbar-suggestion-title">{s.title}</div>
                      {s.subtitle && <div className="topbar-suggestion-sub">{s.subtitle}</div>}
                    </div>
                    <div className="topbar-suggestion-meta">{s.badge ?? s.kind}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={`topbar-icon ${searchOpen ? "topbar-icon--active" : ""}`}
            onClick={() => onSearchToggle(true)}
            aria-label="חיפוש"
          >
            <img src="/logos/search.svg" alt="חיפוש" />
          </button>
        )}

        <button
          type="button"
          className={`topbar-icon ${panelMode === "layers" ? "topbar-icon--active" : ""}`}
          onClick={() => onPanelChange(panelMode === "layers" ? null : "layers")}
          aria-label="שכבות"
        >
          <img src="/logos/layer.svg" alt="שכבות" />
        </button>

        <button
          type="button"
          className={`topbar-icon ${panelMode === "features" ? "topbar-icon--active" : ""}`}
          onClick={() => onPanelChange(panelMode === "features" ? null : "features")}
          aria-label="פיצ'רים"
        >
          <img src="/logos/menu.svg" alt="פיצ'רים" />
        </button>
      </div>
    </header>
  );
};
