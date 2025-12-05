// src/components/LayerOptionsPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { LayerOptionMode } from "./LayerPanel";
import type { LayerFieldMeta } from "../config/layers";
import { BackIcon, CloseIcon } from "./Icons";

interface LayerSummary {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  fields?: LayerFieldMeta[];
}

interface LayerOptionsPanelProps {
  open: boolean;
  layer: LayerSummary;
  mode: LayerOptionMode;
  opacity: number;
  onClose: () => void;
  onBack?: () => void;
  onModeChange: (mode: LayerOptionMode) => void;
  onOpacityChange: (value: number) => void;
  onFilterApply: (filter: string) => Promise<void> | void;
  onRunAnalysis: (wkt?: string | null) => Promise<void> | void;
  onRequestDrawArea: () => Promise<string | null>;
}

type FilterOp = "eq" | "contains" | "gt" | "lt" | "between" | "in";

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
  onBack,
  onModeChange,
  onOpacityChange,
  onFilterApply,
  onRunAnalysis,
  onRequestDrawArea
}) => {
  const [analysisWkt, setAnalysisWkt] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [busyDraw, setBusyDraw] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [filters, setFilters] = useState<FilterClause[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<number | null>(null);
  const [filterView, setFilterView] = useState<"list" | "detail">("list");
  const isFilterDetailView = filterView === "detail" && activeFilterId !== null;
  const currentFilter = isFilterDetailView
    ? filters.find((row) => row.id === activeFilterId) ?? null
    : null;

  const fieldsList =
    (layer.fields && layer.fields.length > 0
      ? layer.fields
      : [{ name: "", type: "text", label: "" }]) ?? [];

  const getFieldMeta = (name: string | undefined) =>
    layer.fields?.find((f) => f.name === name);

  const defaultOpForType = (type: LayerFieldMeta["type"] | undefined): FilterOp => {
    if (type === "number") return "between";
    if (type === "date") return "between";
    if (type === "enum") return "in";
    return "contains";
  };

  const createFilterClause = (fieldName?: string, id?: number): FilterClause => {
    const field = fieldName ?? layer.fields?.[0]?.name ?? "";
    const meta = getFieldMeta(field);
    return {
      id: id ?? Date.now() + Math.floor(Math.random() * 1000),
      field,
      op: defaultOpForType(meta?.type),
      value: "",
      value2: ""
    };
  };

  const buildSeedFilters = (): FilterClause[] => {
    const baseTime = Date.now();
    return layer.fields && layer.fields.length > 0
      ? layer.fields.map((f, idx) => createFilterClause(f.name, baseTime + idx))
      : [createFilterClause(undefined, baseTime)];
  };

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
    setFilters(buildSeedFilters());
    setActiveFilterId(null);
    setFilterView("list");
    setAnalysisWkt(null);
    setAnalysisError(null);
  }, [layer.id, layer.fields]);

  if (!open) return null;

  const clausesForField = (fieldName: string) => filters.filter((f) => f.field === fieldName);

  const ensureClauseForField = (fieldName: string) => {
    let selectedId: number | null = null;
    setFilters((prev) => {
      const existing = prev.filter((f) => f.field === fieldName);
      if (existing.length > 0) {
        selectedId = existing[0].id;
        return prev;
      }
      const created = createFilterClause(fieldName);
      selectedId = created.id;
      return [...prev, created];
    });
    return selectedId;
  };

  const handleDrawArea = async () => {
    setBusyDraw(true);
    try {
      const wkt = await onRequestDrawArea();
      setAnalysisWkt(wkt);
      setAnalysisError(null);
    } catch (err) {
      console.error("שגיאה בציור שטח לניתוח מרחבי:", err);
    } finally {
      setBusyDraw(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!analysisWkt || !analysisWkt.trim()) {
      setAnalysisError("יש לצייר אזור או להזין WKT לפני הרצה.");
      return;
    }

    setBusyAction(true);
    try {
      await onRunAnalysis(analysisWkt);
      setAnalysisError(null);
    } catch (err) {
      console.error("שגיאה בהרצת ניתוח מרחבי:", err);
    } finally {
      setBusyAction(false);
    }
  };

  const buildWhereClause = (clauses: FilterClause[]) => {
    const grouped: Record<string, string[]> = {};

    clauses.forEach((clause) => {
      const expr = buildClauseExpression(clause);
      if (!expr) return;
      if (!grouped[clause.field]) grouped[clause.field] = [];
      grouped[clause.field].push(expr);
    });

    const parts = Object.values(grouped).map((list) =>
      list.length === 1 ? list[0] : `(${list.join(" OR ")})`
    );

    return parts.join(" AND ");
  };

  const handleApplyFilter = async (clausesOverride?: FilterClause[]) => {
    const clauseText = buildWhereClause(clausesOverride ?? filters);
    setBusyAction(true);
    try {
      await onFilterApply(clauseText);
    } catch (err) {
      console.error("שגיאה בהחלת סינון:", err);
    } finally {
      setBusyAction(false);
    }
  };

  const handleResetFilters = async () => {
    const seeds = buildSeedFilters();
    setFilters(seeds);
    setActiveFilterId(null);
    setFilterView("list");
    setBusyAction(true);
    try {
      await onFilterApply("");
    } catch (err) {
      console.error("שגיאה באיפוס סינון:", err);
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
        if (patch.field) {
          const meta = getFieldMeta(patch.field);
          next.op = defaultOpForType(meta?.type);
          next.value = "";
          next.value2 = "";
        }
        return next;
      })
    );

    // Auto-apply on any change
    setTimeout(() => handleApplyFilter(), 0);
  };

  const handleAddClause = (fieldName: string) => {
    const clause = createFilterClause(fieldName);
    setFilters((prev) => [...prev, clause]);
    setActiveFilterId(clause.id);
    setFilterView("detail");
  };

  const handleRemoveClause = (id: number) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
    if (activeFilterId === id) {
      setActiveFilterId(null);
      setFilterView("list");
    }

    setTimeout(() => handleApplyFilter(), 0);
  };

  const fieldLabel = (name: string) =>
    (layer.fields?.find((f) => f.name === name)?.label ?? name) || "שדה";

  const opLabel = (op: FilterOp) =>
    op === "eq"
      ? "="
      : op === "contains"
        ? "מכיל"
        : op === "gt"
          ? ">"
          : op === "lt"
            ? "<"
            : op === "between"
              ? "בין"
              : "ברשימה";

  const summarizeFilter = (f: FilterClause) => {
    if (f.op === "between" && f.value && f.value2) return `${f.value} → ${f.value2}`;
    if (f.op === "in" && f.value) {
      return f.value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .join(", ");
    }
    return f.value || "הוספת תנאי";
  };

  const isFilterFilled = (f: FilterClause) =>
    f.op === "between" ? Boolean(f.value && f.value2) : Boolean(f.value);

  const buildClauseExpression = (f: FilterClause): string | null => {
    if (!f.field || !isFilterFilled(f)) return null;
    const meta = getFieldMeta(f.field);
    const quote = (v: string) =>
      /^[0-9]+(\.[0-9]+)?$/.test(v.trim()) ? v.trim() : `'${v.replace(/'/g, "''")}'`;

    switch (f.op) {
      case "in": {
        const parts =
          f.value
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean) || [];
        if (meta?.options && !parts.length && f.value) {
          parts.push(f.value);
        }
        if (!parts.length) return null;
        const quoted = parts.map((p) => quote(p)).join(", ");
        return `${f.field} IN (${quoted})`;
      }
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
        <div className="side-panel-header-actions">
          {onBack && (
            <button
              className="icon-btn panel-back-btn"
              onClick={onBack}
              aria-label="חזרה למסך השכבות"
            >
              <BackIcon />
            </button>
          )}
          <button className="icon-btn side-panel-close" onClick={onClose} aria-label="סגירת הגדרות שכבה">
            <CloseIcon />
          </button>
        </div>
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
                className="btn primary-soft"
                onClick={handleRunAnalysis}
                disabled={busyAction}
              >
                {busyAction ? "מריץ..." : "הרץ ניתוח"}
              </button>
            </div>
            {analysisError && <p className="layer-analysis__error">{analysisError}</p>}
            <p className="layer-analysis__hint">
              * בחר אזור חדש בכל הפעלה, החיתוך יתבצע מול השכבה הפעילה.
            </p>
          </div>
        )}

        {mode === "filter" && (
          <div className={`layer-filter ${isFilterDetailView ? "layer-filter--detail" : ""}`}>
            {isFilterDetailView && currentFilter ? (
              <>
                <div className="layer-filter__header layer-filter__header--detail">
                  <button
                    type="button"
                    className="icon-btn panel-back-btn"
                    aria-label="חזרה לרשימת הסינונים"
                    onClick={() => {
                      setFilterView("list");
                      setActiveFilterId(null);
                    }}
                  >
                    <BackIcon />
                  </button>
                  <div className="layer-filter__header-text">
                    <h3 className="filter-detail__title">{fieldLabel(currentFilter.field)}</h3>
                    <p className="filter-detail__subtitle">הגדירו תנאי לשדה שנבחר וחזרו לרשימה.</p>
                  </div>
                </div>

                {(() => {
                  const peerClauses = clausesForField(currentFilter.field);
                  return (
                    <div className="filter-detail__chips">
                      {peerClauses.map((clause) => (
                        <button
                          key={clause.id}
                          type="button"
                          className={`filter-detail__chip ${clause.id === currentFilter.id ? "filter-detail__chip--active" : ""}`}
                          onClick={() => setActiveFilterId(clause.id)}
                        >
                          <span>{`${opLabel(clause.op)} ${summarizeFilter(clause)}`}</span>
                          <span
                            className="filter-detail__chip-x"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveClause(clause.id);
                            }}
                            aria-label="הסרת תנאי"
                          >
                            ×
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="filter-detail__chip filter-detail__chip--add"
                        onClick={() => handleAddClause(currentFilter.field)}
                      >
                        + תנאי נוסף
                      </button>
                    </div>
                  );
                })()}

                <div className="layer-filter__detail layer-filter__detail--fullpage">
                  {(() => {
                    const f = currentFilter;
                    const meta = getFieldMeta(f.field);
                    const type = meta?.type ?? "text";
                    const opOptions =
                      type === "number"
                        ? ["eq", "gt", "lt", "between"]
                        : type === "date"
                          ? ["eq", "between"]
                          : type === "enum"
                            ? ["eq", "in"]
                            : ["contains", "eq"];

                    return (
                      <div className="filter-detail-card">
                        <div className="filter-detail__row">
                          <label>שדה</label>
                          <select
                            value={f.field}
                            onChange={(e) => handleFilterChange(f.id, { field: e.target.value })}
                          >
                            {(layer.fields && layer.fields.length > 0
                              ? layer.fields
                              : [{ name: "", type: "text", label: "" }]
                            ).map(
                              (fld) => (
                                <option key={fld.name} value={fld.name}>
                                  {(fld.label ?? fld.name) || "שדה"}
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <div className="filter-detail__row">
                          <label>אופרטור</label>
                          <select
                            value={f.op}
                            onChange={(e) => handleFilterChange(f.id, { op: e.target.value as FilterOp })}
                          >
                            {opOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt === "eq"
                                  ? "="
                                  : opt === "contains"
                                    ? "מכיל"
                                    : opt === "gt"
                                      ? ">"
                                      : opt === "lt"
                                        ? "<"
                                        : opt === "between"
                                          ? "בין"
                                          : "ברשימה"}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="filter-detail__row">
                          <label>ערך</label>
                          {type === "enum" ? (
                            <select
                              multiple={f.op === "in"}
                              value={
                                f.op === "in"
                                  ? f.value.split(",").map((v) => v.trim()).filter(Boolean)
                                  : [f.value]
                              }
                              onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                                handleFilterChange(f.id, { value: f.op === "in" ? selected.join(",") : selected[0] });
                              }}
                            >
                              {(meta?.options ?? []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                              value={f.value}
                              onChange={(e) => handleFilterChange(f.id, { value: e.target.value })}
                              placeholder="ערך"
                              min={meta?.min}
                              max={meta?.max}
                            />
                          )}
                        </div>

                        {f.op === "between" && (
                          <div className="filter-detail__row">
                            <label>עד</label>
                            <input
                              type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                              value={f.value2 ?? ""}
                              onChange={(e) => handleFilterChange(f.id, { value2: e.target.value })}
                              placeholder="עד"
                              min={meta?.min}
                              max={meta?.max}
                            />
                          </div>
                        )}

                        <div className="filter-detail__actions" />
                      </div>
                    );
                  })()}
                </div>

                <div className="layer-filter__actions layer-filter__actions--detail">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={handleResetFilters}
                    disabled={busyAction}
                  >
                    איפוס
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="layer-filter__header">
                  <div>
                    <h3>סינון שכבה</h3>
                    <p>בחרו שדה לעריכה, הגדירו תנאי, ואז הפעילו את הסינון.</p>
                  </div>
                </div>

                <div className="layer-filter__body">
                  <div className="layer-filter__list-shell">
                    <div className="layer-filter__list">
                      {fieldsList.map((fld) => {
                        const clauses = clausesForField(fld.name);
                        const filledClauses = clauses.filter(isFilterFilled);
                        const hasValue = filledClauses.length > 0;
                        const meta = getFieldMeta(fld.name);
                        const summaryFallback = "הוספת תנאי";

                        return (
                          <button
                            key={fld.name}
                            type="button"
                            className={`filter-tile ${
                              activeFilterId && clauses.some((c) => c.id === activeFilterId)
                                ? "filter-tile--active"
                                : ""
                            }`}
                            onClick={() => {
                              const chosen =
                                ensureClauseForField(fld.name) ??
                                clauses[0]?.id ??
                                (clauses[0] ? clauses[0].id : null);
                              if (chosen !== null) setActiveFilterId(chosen);
                              setFilterView("detail");
                            }}
                          >
                            <div className="filter-tile__eyebrow">{meta?.type ?? "text"}</div>
                            <div className="filter-tile__title">{fieldLabel(fld.name)}</div>
                            <div className={`filter-tile__summary ${hasValue ? "filter-tile__summary--set" : ""}`}>
                              {hasValue ? (
                                <div className="filter-tile__chips">
                                  {filledClauses.map((clause) => (
                                    <div
                                      key={clause.id}
                                      className="filter-tile__chip"
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveFilterId(clause.id);
                                        setFilterView("detail");
                                      }}
                                    >
                                      <span>{`${opLabel(clause.op)} ${summarizeFilter(clause)}`}</span>
                                      <span
                                        className="filter-tile__chip-x"
                                        aria-label="הסרת תנאי"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveClause(clause.id);
                                        }}
                                      >
                                        ×
                                      </span>
                                    </div>
                                  ))}
                                  <div
                                    className="filter-tile__chip filter-tile__chip--add"
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddClause(fld.name);
                                    }}
                                  >
                                    + תנאי
                                  </div>
                                </div>
                              ) : (
                                <span>{summaryFallback}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="layer-filter__actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={handleResetFilters}
                    disabled={busyAction}
                  >
                    איפוס
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
