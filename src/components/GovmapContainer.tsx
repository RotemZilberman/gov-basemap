// src/components/GovmapContainer.tsx
import React from "react";

interface GovmapContainerProps {
  id: string;
}

export const GovmapContainer: React.FC<GovmapContainerProps> = ({ id }) => {
  return (
    <div className="map-shell">
      <div id={id} className="map-canvas" />
    </div>
  );
};
