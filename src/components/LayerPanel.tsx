// src/components/LayerPanel.tsx
import React from "react";

interface Layer {
  id: string;
  label: string;
  description?: string;
  icon?: string;
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
  onClose: () => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  open,
  groups,
  activeLayerIds,
  onToggleLayer,
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
          className="side-panel-close"
          onClick={onClose}
          aria-label="סגירת חלון השכבות"
        >
          ✕
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
                  <li key={layer.id}>
                    <button
                      type="button"
                      className={`side-panel-row ${
                        active ? "side-panel-row--active" : ""
                      }`}
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
                      <span className="side-panel-row-toggle">
                        <span
                          className={`toggle-dot ${
                            active ? "toggle-dot--on" : ""
                          }`}
                        />
                      </span>
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
