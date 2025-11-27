import React, { useState, useEffect } from "react";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSearch: (term: string) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  open,
  onClose,
  onSearch
}) => {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) {
      setValue("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSearch(value.trim());
  };

  return (
    <div className="search-overlay">
      <form className="search-bar" onSubmit={handleSubmit}>
        <span className="search-bar-icon">🔍</span>
        <input
          type="text"
          placeholder="חיפוש כתובת / מקום…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {value && (
          <button
            type="button"
            className="search-clear"
            onClick={() => setValue("")}
            aria-label="ניקוי חיפוש"
          >
            ✕
          </button>
        )}
        <button type="submit" className="btn primary search-submit">
          חפש
        </button>
        <button
          type="button"
          className="search-dismiss"
          onClick={onClose}
          aria-label="סגירת החיפוש"
        >
          סגור
        </button>
      </form>
    </div>
  );
};
