// src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import type { UseGovmapReturn } from "../hooks/useGovmap";
import { GovmapContainer } from "../components/GovmapContainer";
import { TopBar } from "../components/TopBar";
import { LayerPanel } from "../components/LayerPanel";
import { FeaturePanel } from "../components/FeaturePanel";
import ChatSidebar from "../components/ChatSidebar";
import { LayerOptionsPanel } from "../components/LayerOptionsPanel";
import type { LayerOptionMode } from "../components/LayerPanel";

type PanelMode = "layers" | "features" | null;

export type LayerFieldType = "text" | "number" | "enum" | "date";

export interface LayerFieldMeta {
  name: string;
  type: LayerFieldType;
  options?: string[];
  min?: number;
  max?: number;
}

interface LayerOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  groupId: string;
  fields?: LayerFieldMeta[];
  zoomCenter?: { x: number; y: number; level?: number };
}

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

  useEffect(() => {
    // סנכרון ראשוני לשכבות במפה
    actions.setVisibleLayers(activeLayerIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleLayer = (id: string) => {
    const nextActive = activeLayerIds.includes(id)
      ? activeLayerIds.filter((lid) => lid !== id)
      : [...activeLayerIds, id];

    setActiveLayerIds(nextActive);

    const allIds = baseLayers.map((l) => l.id);
    const off = allIds.filter((lid) => !nextActive.includes(lid));

    actions.setVisibleLayers(nextActive, off);
  };

  const features = [
    {
      id: "measure",
      label: "מדידת מרחק / שטח",
      icon: "📏",
      description: "פתח את כלי המדידות של GovMap למדידת קווים ופוליגונים.",
      onClick: () => actions.openMeasure()
    },
    {
      id: "bus",
      label: "תחנות אוטובוס",
      icon: "🚌",
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
      icon: "📍",
      description: "זום לנקודת ייחוס במרכז הארץ.",
      onClick: () => actions.zoomTo(187331, 575949, 8)
    },
    {
      id: "export",
      label: "ייצוא מפה",
      icon: "⬇️",
      description: "פתח חלון ייצוא המפה המובנה של GovMap.",
      onClick: () => actions.showExport()
    }
  ];

  const isLayersOpen = !chatOpen && panelMode === "layers";
  const isFeaturesOpen = !chatOpen && panelMode === "features";
  const isChatOpen = Boolean(chatOpen);
  const isLayerOptionsOpen = Boolean(layerOptionsCtx);
  const isPanelOpen = isLayersOpen || isFeaturesOpen || isChatOpen || isLayerOptionsOpen;

  useEffect(() => {
    if (chatOpen && panelMode !== null) {
      setPanelMode(null);
    }
  }, [chatOpen, panelMode]);

  return (
    <div className="app-shell">
      <TopBar
        searchOpen={searchOpen}
        onSearchToggle={(open) => {
          setSearchOpen(open);
          if (open) setPanelMode(null);
        }}
        onSearch={async (term) => {
          await actions.geocodeAndZoom(term);
        }}
        panelMode={panelMode}
        onPanelChange={(mode) => {
          if (mode !== null && onChatClose) onChatClose();
          setPanelMode(mode);
          if (mode !== null) setSearchOpen(false);
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
                try {
                  await actions.zoomToLayerExtent(id);
                  return;
                } catch (err) {
                  console.warn("Zoom to layer via API failed, falling back", err);
                }
                if (layer?.zoomCenter) {
                  await actions.zoomTo(layer.zoomCenter.x, layer.zoomCenter.y, layer.zoomCenter.level);
                } else if (mapCenter) {
                  await actions.zoomTo(mapCenter.x, mapCenter.y, mapCenter.level ?? 8);
                }
              }}
              onOpenLayerOptions={(id, mode) => {
                setLayerOptionsCtx({ layerId: id, mode });
                setPanelMode(null);
                if (onChatClose) onChatClose();
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

        {isChatOpen && (
          <div className="side-panel-card side-panel-card--open">
            <ChatSidebar isOpen onClose={onChatClose ?? (() => undefined)} />
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
                  const drawn = (await actions.drawPolygon()) as unknown as { wkt?: string } | null;
                  return drawn?.wkt ?? null;
                } catch (err) {
                  console.error("ציור פוליגון נכשל", err);
                  return null;
                }
              }}
            />
          </div>
        )}
      </main>

    </div>
  );
};
