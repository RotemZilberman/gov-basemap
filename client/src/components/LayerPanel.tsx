// src/components/LayerPanel.tsx
import React from "react";
import { CloseIcon } from "./Icons";

interface Layer {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface LayerGroup {
  id: string;
  label: string;
  layers: Layer[];
}

interface LayerPanelProps {
  open: boolean;
  groups: LayerGroup[];
  activeLayerIds: string[];
  onToggleLayer: (id: string) => void;
  onZoomLayer: (id: string) => void;
  onOpenLayerOptions: (id: string, mode: LayerOptionMode) => void;
  onClose: () => void;
}

export type LayerOptionMode = "about" | "opacity" | "analysis" | "filter";

export const LayerPanel: React.FC<LayerPanelProps> = ({
  open,
  groups,
  activeLayerIds,
  onToggleLayer,
  onZoomLayer,
  onOpenLayerOptions,
  onClose
}) => {
  if (!open) return null;

  return (
    <div className="side-panel">
      <header className="side-panel-header">
        <div>
          <h2>שכבות</h2>
          <p>בחר שכבות להצגה על המפה. התיאור משמש כאגדת מפה.</p>
        </div>
        <button
          className="icon-btn side-panel-close"
          onClick={onClose}
          aria-label="סגירת חלון השכבות"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="side-panel-body">
        {groups.map((group) => (
          <section key={group.id} className="side-panel-section">
            <h3 className="side-panel-section-title">{group.label}</h3>
            <ul className="side-panel-list">
              {group.layers.map((layer) => {
                const active = activeLayerIds.includes(layer.id);
                return (
                  <li key={layer.id} className="layer-row-shell">
                    <button
                      type="button"
                      className={`side-panel-row ${active ? "side-panel-row--active" : ""}`}
                      onClick={() => onToggleLayer(layer.id)}
                    >
                      <span className="side-panel-row-icon">
                        {layer.icon ?? "●"}
                      </span>

                      <span className="side-panel-row-main">
                        <span className="side-panel-row-label">{layer.label}</span>
                        {layer.description && (
                          <span className="side-panel-row-desc">
                            {layer.description}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="layer-row-menu-btn"
                        aria-label="זום לשכבה"
                        onClick={(e) => {
                          e.stopPropagation();
                          onZoomLayer(layer.id);
                        }}
                        title="זום לשכבה"
                      >
                        <img src="/logos/zoom_to_layer.svg" alt="" className="layer-row-menu-icon" />
                      </button>
                      <button
                        type="button"
                        className="layer-row-menu-btn"
                        aria-label="אודות שכבה"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLayerOptions(layer.id, "about");
                        }}
                        title="אודות שכבה"
                      >
                        <img src="/logos/dots-vertical.svg" alt="" className="layer-row-menu-icon" />
                      </button>
                    </button>
                  </li>

                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};
