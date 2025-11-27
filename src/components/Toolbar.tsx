// src/components/Toolbar.tsx
import React, { useEffect, useState } from "react";
import type { UseGovmapReturn } from "../hooks/useGovmap";

interface LayerOption {
  id: string;
  label: string;
}

interface ToolbarProps {
  govmap: UseGovmapReturn;
  layers: LayerOption[];
}

export const Toolbar: React.FC<ToolbarProps> = ({ govmap, layers }) => {
  const { isReady, actions } = govmap;
  const [search, setSearch] = useState("");
  const [measureOpen, setMeasureOpen] = useState(false);

  const disabled = !isReady;

  useEffect(() => {
    // כשהמפה מוכנה – לעדכן שכבות התחלתיות
    if (isReady && layers.length) {
      actions.setVisibleLayers(
        layers.map((l) => l.id),
        []
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  const handleMeasureClick = async () => {
    if (measureOpen) {
      await actions.closeMeasure();
      setMeasureOpen(false);
    } else {
      await actions.openMeasure();
      setMeasureOpen(true);
    }
  };

  return (
    <header className="toolbar-root">
      <div className="toolbar-group toolbar-brand">
        <div className="toolbar-logo">סטודיו GovMap</div>
        <div className={`status-pill ${isReady ? "status-ok" : "status-wait"}`}>
          {isReady ? "המפה מוכנה" : "טוען מפה…"}
        </div>
      </div>

      <div className="toolbar-group">
        <div className="toolbar-search">
          <input
            type="text"
            placeholder="חיפוש כתובת / מקום"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
          />
          <button
            className="btn primary"
            disabled={disabled || !search.trim()}
            onClick={() => actions.geocodeAndZoom(search)}
          >
            חפש
          </button>
        </div>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">שרטוט</span>
        <div className="toolbar-buttons-inline">
          <button className="btn" disabled={disabled} onClick={actions.drawPoint}>
            נקודה
          </button>
          <button className="btn" disabled={disabled} onClick={actions.drawPolygon}>
            פוליגון
          </button>
          <button className="btn" disabled={disabled} onClick={actions.editDrawing}>
            עריכת צורה
          </button>
        </div>
      </div>

      <div className="toolbar-group toolbar-measure">
        <button className="btn" disabled={disabled} onClick={handleMeasureClick}>
          {measureOpen ? "סגור מדידות" : "פתח כלי מדידה"}
        </button>
      </div>
    </header>
  );
};
