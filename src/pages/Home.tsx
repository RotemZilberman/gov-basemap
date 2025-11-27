// src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import type { UseGovmapReturn } from "../hooks/useGovmap";
import { GovmapContainer } from "../components/GovmapContainer";
import { TopBar } from "../components/TopBar";
import { LayerPanel } from "../components/LayerPanel";
import { FeaturePanel } from "../components/FeaturePanel";
import ChatSidebar from "../components/ChatSidebar";

type PanelMode = "layers" | "features" | null;

interface LayerOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  groupId: string;
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
}

export const Home: React.FC<HomeProps> = ({
  govmap,
  mapContainerId,
  baseLayers,
  chatOpen,
  onChatClose,
}) => {
  const { actions } = govmap;

  const [searchOpen, setSearchOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [activeLayerIds, setActiveLayerIds] = useState<string[]>(
    baseLayers.map((l) => l.id)
  );

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
  const isPanelOpen = isLayersOpen || isFeaturesOpen || isChatOpen;

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
      </main>

    </div>
  );
};
