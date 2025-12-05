// src/pages/App.tsx
import React, { useState } from "react";
import { useGovmap } from "../hooks/useGovmap";
import { Home } from "./Home";
import { AiCommandBar } from "../components/AiCommandBar";

const MAP_CONTAINER_ID = "govmap-root";

const BASE_LAYER_OPTIONS = [
  {
    id: "GASSTATIONS",
    label: "תחנות דלק",
    description: "מיקומי תחנות דלק פעילות ברחבי הארץ.",
    icon: "⛽",
    groupId: "infra",
    fields: ["STATION_NAME", "OPERATOR", "CITY", "STATUS", "ADDRESS"],
    zoomCenter: { x: 187331, y: 575949, level: 9 }
  },
  {
    id: "PARCEL_ALL",
    label: "חלקות",
    description: "גבולות חלקות קדסטריאליות.",
    icon: "📐",
    groupId: "parcels",
    fields: ["GUSH_NUM", "PARCEL", "STATUS", "AREA_DUNAM", "OWNER_TYPE"],
    zoomCenter: { x: 187331, y: 575949, level: 10 }
  },
  {
    id: "bus_stops",
    label: "תחנות אוטובוס",
    description: "תחנות אוטובוס ציבוריות.",
    icon: "🚌",
    groupId: "transport",
    fields: ["STOP_NAME", "CITY_NAME", "ROUTE_TYPE", "ACCESSIBLE", "STATUS"],
    zoomCenter: { x: 187331, y: 575949, level: 11 }
  }
];

const BASE_LAYER_IDS = BASE_LAYER_OPTIONS.map((l) => l.id);

const token = import.meta.env.VITE_GOVMAP_TOKEN as string;

if (!token) {
  console.warn("VITE_GOVMAP_TOKEN לא מוגדר. המפה לא תיטען.");
}

const App: React.FC = () => {
  const [aiOpen, setAiOpen] = useState(false);

  const govmap = useGovmap(MAP_CONTAINER_ID, {
    token,
    center: { x: 187331, y: 575949 },
    level: 7,
    background: 3,
    layers: BASE_LAYER_IDS,
    visibleLayers: BASE_LAYER_IDS,
    identifyOnClick: true,
    showXY: true,
    zoomButtons: true,
    bgButton: true,
    layersMode: 3,
    onLoad: () => console.log("GovMap נטען לתוך", MAP_CONTAINER_ID)
  });

  return (
    <>
      <Home
        govmap={govmap}
        mapContainerId={MAP_CONTAINER_ID}
        baseLayers={BASE_LAYER_OPTIONS}
        chatOpen={aiOpen}
        mapCenter={{ x: 187331, y: 575949, level: 8 }}
        onChatClose={() => setAiOpen(false)}
      />
      <AiCommandBar open={aiOpen} onToggle={setAiOpen} />
    </>
  );
};

export default App;
