// src/hooks/useGovmap.ts
import { useEffect, useMemo, useState } from "react";
import type { GovmapCreateMapOptions } from "../lib/govmap.types";
import {
  createGovmapMap,
  drawPoint,
  drawPolygon,
  editDrawing,
  zoomIn,
  zoomOut,
  geocode,
  zoomToXY,
  showExport,
  closeExport,
  setVisibleLayers,
  showMeasure,
  closeMeasure,
  setLayerOpacity,
  applyLayerFilter,
  runSpatialAnalysis,
  zoomLayerExtent
} from "../lib/govmap.wrapper";

export interface UseGovmapReturn {
  isReady: boolean;
  error: Error | null;
  actions: {
    drawPoint: () => Promise<void>;
    drawPolygon: () => Promise<void>;
    editDrawing: () => Promise<void>;
    zoomIn: () => Promise<void>;
    zoomOut: () => Promise<void>;
    geocodeAndZoom: (keyword: string) => Promise<void>;
    zoomTo: (x: number, y: number, level?: number) => Promise<void>;
    showExport: () => Promise<void>;
    closeExport: () => Promise<void>;
    setVisibleLayers: (layersOn: string[], layersOff?: string[]) => Promise<void>;
    openMeasure: () => Promise<void>;
    closeMeasure: () => Promise<void>;
    setLayerOpacity: (layerId: string, opacity: number) => Promise<void>;
    applyLayerFilter: (layerId: string, filter: string) => Promise<void>;
    runSpatialAnalysis: (layerId: string, wkt?: string) => Promise<unknown>;
    zoomLayerExtent: (layerId: string) => Promise<void>;
  };
}

export function useGovmap(containerId: string, options: GovmapCreateMapOptions): UseGovmapReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await createGovmapMap(containerId, options);
        if (!cancelled) setIsReady(true);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [containerId, options.token]);

  const actions = useMemo(
    () => ({
      async drawPoint() {
        await drawPoint(containerId);
      },
      async drawPolygon() {
        await drawPolygon(containerId);
      },
      async editDrawing() {
        await editDrawing(containerId);
      },
      async zoomIn() {
        await zoomIn(containerId);
      },
      async zoomOut() {
        await zoomOut(containerId);
      },
      async geocodeAndZoom(keyword: string) {
        if (!keyword.trim()) return;
        const result = await geocode(keyword, true);
        if (result.ResultCode === 1 && typeof result.X === "number" && typeof result.Y === "number") {
          await zoomToXY(result.X, result.Y, 8, containerId);
        } else {
          console.warn("לא נמצאה התאמה מדויקת לכתובת:", keyword, result);
        }
      },
      async zoomTo(x: number, y: number, level?: number) {
        await zoomToXY(x, y, level, containerId);
      },
      async showExport() {
        await showExport(containerId);
      },
      async closeExport() {
        await closeExport(containerId);
      },
      async setVisibleLayers(layersOn: string[], layersOff?: string[]) {
        await setVisibleLayers(layersOn, layersOff);
      },
      async openMeasure() {
        await showMeasure(containerId);
      },
      async closeMeasure() {
        await closeMeasure(containerId);
      },
      async setLayerOpacity(layerId: string, opacity: number) {
        await setLayerOpacity(layerId, opacity);
      },
      async applyLayerFilter(layerId: string, filter: string) {
        await applyLayerFilter(layerId, filter);
      },
      async runSpatialAnalysis(layerId: string, wkt?: string) {
        return runSpatialAnalysis(layerId, wkt);
      },
      async zoomLayerExtent(layerId: string) {
        await zoomLayerExtent(layerId);
      }
    }),
    [containerId]
  );

  return { isReady, error, actions };
}
