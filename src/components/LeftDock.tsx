// src/components/LeftDock.tsx
import React from "react";

type PanelMode = "layers" | "features" | null;

interface LeftDockProps {
  searchOpen: boolean;
  onSearchToggle: (open: boolean) => void;
  panelMode: PanelMode;
  onPanelChange: (mode: PanelMode) => void;
}

export const LeftDock: React.FC<LeftDockProps> = ({
  searchOpen,
  onSearchToggle,
  panelMode,
  onPanelChange
}) => {
  const handleSearchClick = () => {
    onSearchToggle(!searchOpen);
  };

  const handleLayersClick = () => {
    onPanelChange(panelMode === "layers" ? null : "layers");
  };

  const handleFeaturesClick = () => {
    onPanelChange(panelMode === "features" ? null : "features");
  };

  return (
    <div className="left-dock">
      {/* Search icon – נעלם כשהחיפוש פתוח */}
      {!searchOpen && (
        <button
          type="button"
          className="dock-icon"
          onClick={handleSearchClick}
          aria-label="חיפוש"
        >
          <span className="dock-icon-glyph">🔍</span>
        </button>
      )}

      {/* Layers */}
      <button
        type="button"
        className={`dock-icon ${panelMode === "layers" ? "dock-icon--active" : ""}`}
        onClick={handleLayersClick}
        aria-label="שכבות"
      >
        <span className="dock-icon-glyph">🗺️</span>
      </button>

      {/* Features */}
      <button
        type="button"
        className={`dock-icon ${panelMode === "features" ? "dock-icon--active" : ""}`}
        onClick={handleFeaturesClick}
        aria-label="פיצ'רים"
      >
        <span className="dock-icon-glyph">✨</span>
      </button>
    </div>
  );
};
