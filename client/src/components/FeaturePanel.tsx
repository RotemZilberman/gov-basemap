// src/components/FeaturePanel.tsx
import React from "react";
import { CloseIcon } from "./Icons";

interface Feature {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface FeaturePanelProps {
  open: boolean;
  features: Feature[];
  onClose: () => void;
}

export const FeaturePanel: React.FC<FeaturePanelProps> = ({
  open,
  features,
  onClose
}) => {
  if (!open) return null;

  return (
    <div className="side-panel">
      <header className="side-panel-header">
        <div>
          <h2>כלי מפה</h2>
          <p>בחר כלי מתקדם: מדידות, תחבורה, קפיצה לנקודות עניין ועוד.</p>
        </div>
        <button
          className="icon-btn side-panel-close"
          onClick={onClose}
          aria-label="סגירת חלון הכלים"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="side-panel-body">
        <ul className="side-panel-list">
          {features.map((feat) => (
            <li key={feat.id}>
              <button
                type="button"
                className="side-panel-row"
                onClick={feat.onClick}
              >
                <span className="side-panel-row-icon">
                  {feat.icon ?? "★"}
                </span>
                <span className="side-panel-row-main">
                  <span className="side-panel-row-label">{feat.label}</span>
                  {feat.description && (
                    <span className="side-panel-row-desc">
                      {feat.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
