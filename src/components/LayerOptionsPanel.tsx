// src/components/LayerOptionsPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { LayerOptionMode } from "./LayerPanel";

interface LayerSummary {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  fields?: string[];
}

interface LayerOptionsPanelProps {
  open: boolean;
  layer: LayerSummary;
  mode: LayerOptionMode;
  opacity: number;
  onClose: () => void;
  onModeChange: (mode: LayerOptionMode) => void;
  onOpacityChange: (value: number) => void;
  onFilterApply: (filter: string) => Promise<void> | void;
  onRunAnalysis: (wkt?: string | null) => Promise<void> | void;
  onRequestDrawArea: () => Promise<string | null>;
}

type FilterOp = "eq" | "contains" | "gt" | "lt" | "between";

interface FilterClause {
  id: number;
  field: string;
  op: FilterOp;
  value: string;
  value2?: string;
}

const modeLabels: Record<LayerOptionMode, string> = {
  about: "אודות השכבה",
  opacity: "שקיפות שכבה",
  analysis: "ניתוח מרחבי",
  filter: "סינון שכבה"
};

export const LayerOptionsPanel: React.FC<LayerOptionsPanelProps> = ({
  open,
  layer,
  mode,
  opacity,
  onClose,
  onModeChange,
  onOpacityChange,
  onFilterApply,
  onRunAnalysis,
  onRequestDrawArea
}) => {
  const [analysisWkt, setAnalysisWkt] = useState<string | null>(null);
  const [busyDraw, setBusyDraw] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [filters, setFilters] = useState<FilterClause[]>([]);

  const modeChips = useMemo(
    () =>
      (["about", "opacity", "analysis", "filter"] as LayerOptionMode[]).map((key) => ({
        key,
        label: modeLabels[key]
      })),
    []
  );

  // initialize filters when layer changes
  useEffect(() => {
    if (layer.fields && layer.fields.length > 0) {
      const baseTime = Date.now();
      const nextFilters: FilterClause[] = layer.fields.map((f, idx) => ({
        id: baseTime + idx,
        field: f,
        op: "eq",
        value: ""
      }));
      setFilters(nextFilters);
    } else {
      setFilters([
        {
          id: Date.now(),
          field: "",
          op: "eq",
          value: ""
        }
      ]);
    }
    setAnalysisWkt(null);
  }, [layer.id, layer.fields]);

  if (!open) return null;

  const handleDrawArea = async () => {
    setBusyDraw(true);
    try {
      const wkt = await onRequestDrawArea();
      setAnalysisWkt(wkt);
    } catch (err) {
      console.error("שגיאה בציור שטח לניתוח מרחבי:", err);
    } finally {
      setBusyDraw(false);
    }
  };

  const handleRunAnalysis = async () => {
    setBusyAction(true);
    try {
      await onRunAnalysis(analysisWkt);
    } catch (err) {
      console.error("שגיאה בהרצת ניתוח מרחבי:", err);
    } finally {
      setBusyAction(false);
    }
  };

  const handleApplyFilter = async () => {
    const clauses = filters
      .filter((f) => f.field && f.value)
      .map((f) => {
        const quote = (v: string) =>
          /^[0-9]+(\.[0-9]+)?$/.test(v.trim()) ? v.trim() : `'${v.replace(/'/g, "''")}'`;

        switch (f.op) {
          case "contains":
            return `${f.field} LIKE '%${f.value.replace(/'/g, "''")}%'`;
          case "gt":
            return `${f.field} > ${quote(f.value)}`;
          case "lt":
            return `${f.field} < ${quote(f.value)}`;
          case "between":
            if (!f.value2) return null;
            return `${f.field} BETWEEN ${quote(f.value)} AND ${quote(f.value2)}`;
          case "eq":
          default:
            return `${f.field} = ${quote(f.value)}`;
        }
      })
      .filter((c): c is string => Boolean(c))
      .join(" AND ");

    setBusyAction(true);
    try {
      await onFilterApply(clauses);
    } catch (err) {
      console.error("שגיאה בהחלת סינון:", err);
    } finally {
      setBusyAction(false);
    }
  };

  const handleFilterChange = (id: number, patch: Partial<Omit<FilterClause, "id">>) => {
    setFilters((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const next: FilterClause = { ...f, ...patch };
        if (patch.op && patch.op !== "between") {
          next.value2 = "";
        }
        return next;
      })
    );
  };

  const handleAddFilterRow = () => {
    setFilters((prev) => [
      ...prev,
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        field: layer.fields?.[0] ?? "",
        op: "eq",
        value: ""
      }
    ]);
  };

  const handleRemoveFilter = (id: number) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="side-panel layer-options-panel">
      <header className="side-panel-header layer-options-header">
        <div>
          <div className="layer-options-eyebrow">שכבה נבחרת</div>
          <div className="layer-options-title">
            {layer.icon && <span className="layer-options-icon">{layer.icon}</span>}
            <h2>{layer.label}</h2>
          </div>
          <p>{modeLabels[mode]}</p>
        </div>
        <button className="side-panel-close" onClick={onClose} aria-label="סגירת הגדרות שכבה">
          ✕
        </button>
      </header>

      <div className="layer-options-tabs">
        {modeChips.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`layer-options-tab ${mode === tab.key ? "layer-options-tab--active" : ""}`}
            onClick={() => onModeChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="side-panel-body layer-options-body">
        {mode === "about" && (
          <div className="layer-about">
            <h3>מידע</h3>
            <p className="layer-about__desc">{layer.description ?? "אין תיאור זמין לשכבה זו."}</p>
            <div className="layer-about__meta">
              <div>
                <div className="layer-meta__label">מזהה שכבה</div>
                <div className="layer-meta__value">{layer.id}</div>
              </div>
              <div>
                <div className="layer-meta__label">סטטוס</div>
                <div className="layer-meta__value">נטען</div>
              </div>
            </div>
          </div>
        )}

        {mode === "opacity" && (
          <div className="layer-opacity">
            <div className="layer-opacity__header">
              <div>
                <h3>שקיפות שכבה</h3>
                <p>כוון את רמת השקיפות בין 0% (אטום) ל־100% (שקוף).</p>
              </div>
              <div className="layer-opacity__value">{opacity}%</div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="layer-opacity__slider"
            />
          </div>
        )}

        {mode === "analysis" && (
          <div className="layer-analysis">
            <div className="layer-analysis__header">
              <h3>ניתוח מרחבי</h3>
              <p>בחר אזור על המפה או הדבק WKT כדי להריץ חיתוך מול השכבה.</p>
            </div>
            <div className="layer-analysis__controls">
              <button
                type="button"
                className="btn ghost"
                onClick={handleDrawArea}
                disabled={busyDraw}
              >
                {busyDraw ? "מצייר..." : "בחר אזור מהמפה"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setAnalysisWkt(null)}
                disabled={busyDraw || !analysisWkt}
              >
                בטל בחירה
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleRunAnalysis}
                disabled={busyAction}
              >
                {busyAction ? "מריץ..." : "הרץ ניתוח"}
              </button>
            </div>
            <textarea
              className="layer-analysis__wkt"
              placeholder="WKT של אזור לניתוח..."
              value={analysisWkt ?? ""}
              onChange={(e) => setAnalysisWkt(e.target.value || null)}
              rows={4}
            />
            <p className="layer-analysis__hint">
              * החיתוך יבוצע מול השכבה וניתן לשלב עם כלי GovMap לפי הצורך.
            </p>
          </div>
        )}

        {mode === "filter" && (
          <div className="layer-filter">
            <div className="layer-filter__header">
              <h3>סינון שכבה</h3>
              <p>בחרו שדות והגדירו תנאים – נבנה עבורך את הסינון.</p>
            </div>

            <div className="layer-filter__fields">
              {layer.fields && layer.fields.length > 0 ? (
                <div className="layer-filter__fields-list">
                  {layer.fields.map((f) => (
                    <span key={f} className="layer-filter__field-chip">
                      {f}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="layer-filter__no-fields">שמות שדות לא זמינים - הזינו ידנית</span>
              )}
            </div>

            <div className="layer-filter__rows">
              {filters.map((f) => (
                <div key={f.id} className="layer-filter__row">
                  <select
                    value={f.field}
                    onChange={(e) => handleFilterChange(f.id, { field: e.target.value })}
                  >
                    {(layer.fields && layer.fields.length > 0 ? layer.fields : [""]).map((fld) => (
                      <option key={fld || "empty"} value={fld}>
                        {fld || "שדה"}
                      </option>
                    ))}
                  </select>

                  <select
                    value={f.op}
                    onChange={(e) =>
                      handleFilterChange(f.id, { op: e.target.value as FilterOp })
                    }
                  >
                    <option value="eq">=</option>
                    <option value="contains">מכיל</option>
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="between">בין</option>
                  </select>

                  <input
                    value={f.value}
                    onChange={(e) => handleFilterChange(f.id, { value: e.target.value })}
                    placeholder="ערך"
                  />

                  {f.op === "between" && (
                    <input
                      value={f.value2 ?? ""}
                      onChange={(e) => handleFilterChange(f.id, { value2: e.target.value })}
                      placeholder="עד"
                    />
                  )}

                  <button
                    type="button"
                    className="layer-filter__remove"
                    onClick={() => handleRemoveFilter(f.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button type="button" className="btn ghost" onClick={handleAddFilterRow}>
                + תנאי נוסף
              </button>
            </div>

            <div className="layer-filter__actions">
              <button
                type="button"
                className="btn primary"
                onClick={handleApplyFilter}
                disabled={busyAction}
              >
                {busyAction ? "מפעיל..." : "החל סינון"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setFilters([])}
                disabled={busyAction}
              >
                איפוס
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
