// src/pages/Home.tsx
import React, { useCallback, useEffect, useState } from "react";
import type { UseGovmapReturn } from "../hooks/useGovmap";
import { GovmapContainer } from "../components/GovmapContainer";
import { TopBar } from "../components/TopBar";
import { LayerPanel } from "../components/LayerPanel";
import { FeaturePanel } from "../components/FeaturePanel";
import ChatSidebar from "../components/ChatSidebar";
import { LayerOptionsPanel } from "../components/LayerOptionsPanel";
import type { LayerOptionMode } from "../components/LayerPanel";
import type { LayerOption } from "../config/layers";
import {
  extractXY,
  normalizeSearchResponse,
  parseWkt,
  fetchGovmapAutocomplete,
  fetchServerGeocodeSuggestions,
  type SearchSuggestion
} from "../lib/search";
import { setLayerMetadata } from "../lib/sessionManager";
import { toLayerMetadataPayload } from "../lib/layerMetadata";

type PanelMode = "layers" | "features" | null;

interface LayerGroupDef {
  id: string;
  label: string;
}

interface HomeProps {
  govmap: UseGovmapReturn;
  mapContainerId: string;
  baseLayers: LayerOption[];
  chatOpen?: boolean;
  onChatClose?: () => void;
  mapCenter?: { x: number; y: number; level?: number };
}

export const Home: React.FC<HomeProps> = ({
  govmap,
  mapContainerId,
  baseLayers,
  chatOpen,
  onChatClose,
  mapCenter
}) => {
  const { actions } = govmap;

  const [searchOpen, setSearchOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [activeLayerIds, setActiveLayerIds] = useState<string[]>(
    baseLayers.map((l) => l.id)
  );
  const [layerOptionsCtx, setLayerOptionsCtx] = useState<{
    layerId: string;
    mode: LayerOptionMode;
  } | null>(null);
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});

  // הגדרת קבוצות שכבות
  const layerGroups: LayerGroupDef[] = [
    { id: "transport", label: "תחבורה" },
    { id: "parcels", label: "קרקע וקדסטר" },
    { id: "infra", label: "תשתיות" }
  ];

  const groupedLayers = layerGroups.map((g) => ({
    id: g.id,
    label: g.label,
    layers: baseLayers.filter((l) => l.groupId === g.id)
  }));

  const baseLayerHints = useCallback(
    (term: string): SearchSuggestion[] => {
      const t = term.toLowerCase();
      return baseLayers
        .filter(
          (l) =>
            l.label.toLowerCase().includes(t) ||
            l.id.toLowerCase().includes(t) ||
            (l.description ?? "").toLowerCase().includes(t)
        )
        .map((l) => ({
          id: `layer-${l.id}`,
          title: l.label,
          subtitle: l.description ?? "שכבת בסיס",
          kind: "layer" as const,
          badge: "שכבה",
          action: { type: "layer" as const, layerId: l.id }
        }));
    },
    [baseLayers]
  );

  const handleToggleLayer = (id: string) => {
    const nextActive = activeLayerIds.includes(id)
      ? activeLayerIds.filter((lid) => lid !== id)
      : [...activeLayerIds, id];

    setActiveLayerIds(nextActive);

    const allIds = baseLayers.map((l) => l.id);
    const off = allIds.filter((lid) => !nextActive.includes(lid));

    actions.setVisibleLayers(nextActive, off);
  };

  const firstCoordinateFromAny = useCallback((raw: unknown) => {
    const buckets: unknown[] = [];
    if (Array.isArray(raw)) buckets.push(raw);
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.data)) buckets.push(obj.data);
      if (Array.isArray(obj.results)) buckets.push(obj.results);
      if (Array.isArray(obj.Result)) buckets.push(obj.Result);
    }

    for (const bucket of buckets) {
      if (!Array.isArray(bucket)) continue;
      for (const item of bucket) {
        const xy = extractXY(item);
        if (xy) return xy;
      }
    }

    return extractXY(raw);
  }, []);

  const handleParcelLocate = useCallback(
    async (gush: number, parcel: number) => {
      const keyword = `${gush} ${parcel}`;
      try {
        const locateRes = await actions.searchAndLocate(keyword, { maxResults: 6 });
        const hits = normalizeSearchResponse(locateRes);
        for (const hit of hits) {
          const xy = extractXY(hit);
          if (xy) {
            await actions.zoomTo(xy.x, xy.y, 12);
            return;
          }
        }
      } catch (err) {
        console.warn("איתור חלקה באמצעות searchAndLocate נכשל", err);
      }

      try {
        const where = { PARCEL_ALL: `GUSH_NUM = ${gush} AND PARCEL = ${parcel}` };
        const res = await actions.intersectFeatures({
          layers: ["PARCEL_ALL"],
          whereClause: where
        });
        const xy = firstCoordinateFromAny(res);
        if (xy) {
          await actions.zoomTo(xy.x, xy.y, 12);
          return;
        }
      } catch (err) {
        console.warn("איתור חלקה באמצעות intersectFeatures נכשל", err);
      }

      await actions.geocodeAndZoom(keyword);
    },
    [actions, firstCoordinateFromAny]
  );

  const handleSuggest = useCallback(
    async (term: string): Promise<SearchSuggestion[]> => {
      const trimmed = term.trim();
      if (!trimmed) return [];

      const results: SearchSuggestion[] = [];
      let hasGovmapAutocompleteHit = false;
      const hebTypeLabel = (type?: string) => {
        const t = (type ?? "").toLowerCase();
        if (t === "address") return "כתובת";
        if (t === "junction") return "צומת";
        if (t === "poi") return "נקודת עניין";
        if (t === "institute") return "מוסד";
        if (t === "parcel") return "חלקה";
        if (t === "street") return "רחוב";
        if (t === "city") return "יישוב";
        return "תוצאה";
      };
      const parcelMatch = trimmed.match(/(\d{1,6})\s*[\/ ]\s*(\d{1,5})/);
      if (parcelMatch) {
        const gush = Number(parcelMatch[1]);
        const parcel = Number(parcelMatch[2]);
        results.push({
          id: `parcel-${gush}-${parcel}`,
          title: `חלקה ${parcel} / גוש ${gush}`,
          subtitle: "איתור קדסטר",
          kind: "parcel",
          badge: "קדסטר",
          action: { type: "parcel", gush, parcel }
        });
      }

      results.push(...baseLayerHints(trimmed));

      try {
        const apiResults = await fetchGovmapAutocomplete(trimmed, { maxResults: 8 });
        apiResults.forEach((hit, idx) => {
          const xy = parseWkt(hit.shape ?? "") ?? extractXY(hit);
          if (!xy) return;
          hasGovmapAutocompleteHit = true;
          const title = hit.originalText ?? hit.text ?? trimmed;
          const subtitle = hit.text && hit.text !== title ? hit.text : undefined;
          const kind: SearchSuggestion["kind"] = hit.type === "address" ? "address" : "feature";
          const badge = hebTypeLabel(hit.type);
          results.push({
            id: `ac-${idx}-${hit.id ?? title}`,
            title,
            subtitle,
            kind,
            badge,
            action: { type: "zoom", x: xy.x, y: xy.y, level: 12, term: hit.originalText ?? title }
          });
        });
      } catch (err) {
        console.warn("שגיאה בשליפת הצעות autocomplete", err);
      }

      if (!hasGovmapAutocompleteHit && trimmed.length >= 3) {
        try {
          const googleResults = await fetchServerGeocodeSuggestions(trimmed);
          results.push(...googleResults);
        } catch (err) {
          console.warn("Google Maps fallback search failed", err);
        }
      }

      const seen = new Set<string>();
      return results.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
    },
    [baseLayerHints]
  );

  const extractWktFromDraw = (result: unknown): string | null => {
    if (!result || typeof result !== "object") return null;
    const obj = result as Record<string, unknown>;
    const candidates = [
      obj.wkt,
      obj.WKT,
      (obj as any).wktString,
      (obj as any).wktText,
      (obj as any).geometryWKT,
      (obj as any).geom,
      (obj as any).polygon
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    console.warn("Draw result missing WKT. Keys:", Object.keys(obj));
    return null;
  };

  const handleSuggestionSelect = useCallback(
    async (suggestion: SearchSuggestion) => {
      const action = suggestion.action;
      switch (action.type) {
        case "zoom":
          try {
            await actions.zoomTo(action.x, action.y, action.level ?? 12);
          } catch (err) {
            console.warn("זום לנקודה מהצעה נכשל, מנסה גיבוי", err);
            if (action.term) {
              await actions.geocodeAndZoom(action.term);
            }
          }
          return;
        case "layer": {
          if (!activeLayerIds.includes(action.layerId)) {
            handleToggleLayer(action.layerId);
          }
          try {
            await actions.zoomLayerExtent(action.layerId);
            return;
          } catch (err) {
            console.warn("Zoom to layer from suggestion failed, using fallback", err);
          }
          {
            const layer = baseLayers.find((l) => l.id === action.layerId);
            if (layer?.zoomCenter) {
              await actions.zoomTo(layer.zoomCenter.x, layer.zoomCenter.y, layer.zoomCenter.level);
            } else if (mapCenter) {
              await actions.zoomTo(mapCenter.x, mapCenter.y, mapCenter.level ?? 8);
            }
          }
          return;
        }
        case "keyword":
          await actions.geocodeAndZoom(action.keyword);
          return;
        case "parcel":
          await handleParcelLocate(action.gush, action.parcel);
          return;
        default:
          return;
      }
    },
    [actions, activeLayerIds, baseLayers, handleParcelLocate, handleToggleLayer, mapCenter]
  );

  useEffect(() => {
    // סנכרון ראשוני לשכבות במפה
    actions.setVisibleLayers(activeLayerIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const metadata = toLayerMetadataPayload(baseLayers);
    setLayerMetadata(metadata);
  }, [baseLayers]);

  const features = [
    {
      id: "measure",
      label: "מדידת מרחק / שטח",
      icon: <img src="/logos/measure.svg" alt="" className="panel-icon-img" />,
      description: "פתח את כלי המדידות של GovMap למדידת קווים ופוליגונים.",
      onClick: () => actions.openMeasure()
    },
    {
      id: "bus",
      label: "תחנות אוטובוס",
      icon: <img src="/logos/bus_stop.svg" alt="" className="panel-icon-img" />,
      description: "הצג שכבת תחנות אוטובוס במפה.",
      onClick: () => {
        if (!activeLayerIds.includes("bus_stops")) {
          handleToggleLayer("bus_stops");
        }
      }
    },
    {
      id: "zoom-center",
      label: "קפיצה למרכז ישראל",
      icon: <img src="/logos/country_center.svg" alt="" className="panel-icon-img" />,
      description: "זום לנקודת ייחוס במרכז הארץ.",
      onClick: () => actions.zoomTo(187331, 575949, 8)
    },
    {
      id: "export",
      label: "ייצוא מפה",
      icon: <img src="/logos/share.svg" alt="" className="panel-icon-img" />,
      description: "פתח חלון ייצוא המפה המובנה של GovMap.",
      onClick: () => actions.showExport()
    }
  ];

  const isLayersOpen = panelMode === "layers";
  const isFeaturesOpen = panelMode === "features";
  const isChatOpen = Boolean(chatOpen);
  const isLayerOptionsOpen = Boolean(layerOptionsCtx);
  const isPanelOpen = isLayersOpen || isFeaturesOpen || isChatOpen || isLayerOptionsOpen;

  const handleBackToLayers = () => {
    setLayerOptionsCtx(null);
    setPanelMode("layers");
  };

  return (
    <div className="app-shell">
      <TopBar
        searchOpen={searchOpen}
        onSearchToggle={(open) => {
          setSearchOpen(open);
        }}
        onSearch={async (term) => {
          await actions.geocodeAndZoom(term);
        }}
        onSuggest={handleSuggest}
        onSuggestionSelect={handleSuggestionSelect}
        panelMode={panelMode}
        onPanelChange={(mode) => {
          setPanelMode(mode);
          if (mode !== null) setLayerOptionsCtx(null);
        }}
      />

      {/* MAIN ROW: MAP CARD + OPTIONAL SIDE CARD */}
      <main
        className={`app-main ${isPanelOpen ? "app-main--with-panel" : ""} ${
          chatOpen ? "app-main--chat" : ""
        }`}
      >
        <section className="app-map-section">
          <GovmapContainer id={mapContainerId} />
        </section>

        {isLayersOpen && (
          <div className="side-panel-card side-panel-card--open">
            <LayerPanel
              open={true}
              groups={groupedLayers}
              activeLayerIds={activeLayerIds}
              onToggleLayer={handleToggleLayer}
              onZoomLayer={async (id) => {
                const layer = baseLayers.find((l) => l.id === id);

                // 1️⃣ Make sure the layer is active in UI & map
                if (!activeLayerIds.includes(id)) {
                  handleToggleLayer(id); // this will add it to activeLayerIds + setVisibleLayers
                }

                // 2️⃣ Try API-based zoom to extent
                try {
                  await actions.zoomLayerExtent(id);
                  return;
                } catch (err) {
                  console.warn("Zoom to layer via API failed, falling back", err);
                }

                // 3️⃣ Fallbacks
                if (layer?.zoomCenter) {
                  await actions.zoomTo(layer.zoomCenter.x, layer.zoomCenter.y, layer.zoomCenter.level);
                } else if (mapCenter) {
                  await actions.zoomTo(mapCenter.x, mapCenter.y, mapCenter.level ?? 8);
                }
              }}
              onOpenLayerOptions={(id, mode) => {
                setLayerOptionsCtx({ layerId: id, mode });
                setPanelMode(null);
              }}
              onClose={() => setPanelMode(null)}
            />
          </div>
        )}

        {isFeaturesOpen && (
          <div className="side-panel-card side-panel-card--open">
            <FeaturePanel
              open={true}
              features={features}
              onClose={() => setPanelMode(null)}
            />
          </div>
        )}

        {isLayerOptionsOpen && layerOptionsCtx && (
          <div className="side-panel-card side-panel-card--open">
            <LayerOptionsPanel
              open
              layer={
                baseLayers.find((l) => l.id === layerOptionsCtx.layerId) ?? {
                  id: layerOptionsCtx.layerId,
                  label: layerOptionsCtx.layerId
                }
              }
              mode={layerOptionsCtx.mode}
              opacity={layerOpacity[layerOptionsCtx.layerId] ?? 100}
              onClose={() => setLayerOptionsCtx(null)}
              onBack={handleBackToLayers}
              onModeChange={(mode) => setLayerOptionsCtx({ layerId: layerOptionsCtx.layerId, mode })}
              onOpacityChange={async (value) => {
                const next = Math.min(100, Math.max(0, value));
                setLayerOpacity((prev) => ({ ...prev, [layerOptionsCtx.layerId]: next }));
                try {
                  await actions.setLayerOpacity(layerOptionsCtx.layerId, next);
                } catch (err) {
                  console.error("שגיאה בעדכון שקיפות שכבה", err);
                }
              }}
              onFilterApply={async (expr) => {
                try {
                  await actions.applyLayerFilter(layerOptionsCtx.layerId, expr);
                } catch (err) {
                  console.error("שגיאה בהפעלת סינון", err);
                }
              }}
              onRunAnalysis={async (wkt) => {
                try {
                  await actions.runSpatialAnalysis(layerOptionsCtx.layerId, wkt ?? undefined);
                } catch (err) {
                  console.error("שגיאה בניתוח מרחבי", err);
                }
              }}
              onRequestDrawArea={async () => {
                try {
                  const drawn = await actions.drawPolygon();
                  const wkt = extractWktFromDraw(drawn);
                  return wkt;
                } catch (err) {
                  console.error("ציור פוליגון נכשל", err);
                  return null;
                }
              }}
            />
          </div>
        )}

        {isChatOpen && (
          <div className="side-panel-card side-panel-card--open">
            <ChatSidebar
              isOpen
              onClose={onChatClose ?? (() => undefined)}
              mapDivId={mapContainerId}
              mapReady={govmap.isReady}
              layers={baseLayers}
            />
          </div>
        )}
      </main>

    </div>
  );
};
