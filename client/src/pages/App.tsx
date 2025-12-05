// src/pages/App.tsx
import React, { useState } from "react";
import { useGovmap } from "../hooks/useGovmap";
import { Home } from "./Home";
import { AiCommandBar } from "../components/AiCommandBar";
import { BASE_LAYER_IDS, BASE_LAYER_OPTIONS } from "../config/layers";

const MAP_CONTAINER_ID = "govmap-root";

const token = import.meta.env.VITE_GOVMAP_TOKEN as string;

if (!token) {
  console.warn("VITE_GOVMAP_TOKEN לא מוגדר. המפה לא תיטען.");
}

const App: React.FC = () => {
  const [aiOpen, setAiOpen] = useState(true);

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
        onChatClose={() => setAiOpen(false)}
      />
      <AiCommandBar open={aiOpen} onToggle={setAiOpen} />
    </>
  );
};

export default App;
