// src/hooks/useGovmap.ts
import { useEffect, useMemo, useState } from "react";
import type { GovmapCreateMapOptions } from "../lib/govmap.types";
import {
  createGovmapMap,
  drawPoint as apiDrawPoint,
  drawPolygon as apiDrawPolygon,
  editDrawing as apiEditDrawing,
  zoomIn as apiZoomIn,
  zoomOut as apiZoomOut,
  geocode,
  zoomToXY,
  showExport as apiShowExport,
  closeExport as apiCloseExport,
  setVisibleLayers as apiSetVisibleLayers,
  showMeasure as apiShowMeasure,
  closeMeasure as apiCloseMeasure,
  setLayerOpacity as apiSetLayerOpacity,
  applyLayerFilter as apiApplyLayerFilter,
  runSpatialAnalysis as apiRunSpatialAnalysis,
  zoomLayerExtent as apiZoomLayerExtent,
  searchAndLocate as apiSearchAndLocate,
  intersectFeatures as apiIntersectFeatures,
  searchInLayer as apiSearchInLayer
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
    searchAndLocate: (
      keyword: string,
      opts?: { locateType?: number; maxResults?: number }
    ) => Promise<unknown>;
    intersectFeatures: (params: {
      layers: string[];
      whereClause?: Record<string, string>;
      wkt?: string;
    }) => Promise<unknown>;
    searchInLayer: (params: Record<string, unknown>) => Promise<unknown>;
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
        await apiDrawPoint(containerId);
      },
      async drawPolygon() {
        await apiDrawPolygon(containerId);
      },
      async editDrawing() {
        await apiEditDrawing(containerId);
      },
      async zoomIn() {
        await apiZoomIn(containerId);
      },
      async zoomOut() {
        await apiZoomOut(containerId);
      },
      async geocodeAndZoom(keyword: string) {
        if (!keyword.trim()) return;
        const result = await geocode(keyword, true, containerId);
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
        await apiShowExport(containerId);
      },
      async closeExport() {
        await apiCloseExport(containerId);
      },
      async setVisibleLayers(layersOn: string[], layersOff?: string[]) {
        await apiSetVisibleLayers(layersOn, layersOff, containerId);
      },
      async openMeasure() {
        await apiShowMeasure(containerId);
      },
      async closeMeasure() {
        await apiCloseMeasure(containerId);
      },
      async setLayerOpacity(layerId: string, opacity: number) {
        await apiSetLayerOpacity(layerId, opacity, containerId);
      },
      async applyLayerFilter(layerId: string, filter: string) {
        await apiApplyLayerFilter(layerId, filter, containerId);
      },
      async runSpatialAnalysis(layerId: string, wkt?: string) {
        return apiRunSpatialAnalysis(layerId, wkt, containerId);
      },
      async zoomLayerExtent(layerId: string) {
        await apiZoomLayerExtent(layerId);
      },
      async searchAndLocate(keyword: string, opts?: { locateType?: number; maxResults?: number }) {
        return apiSearchAndLocate(
          {
            keyword,
            locateType: opts?.locateType,
            maxResults: opts?.maxResults ?? 8
          },
          containerId
        );
      },
      async intersectFeatures(params: {
        layers: string[];
        whereClause?: Record<string, string>;
        wkt?: string;
      }) {
        return apiIntersectFeatures(params, containerId);
      },
      async searchInLayer(params: Record<string, unknown>) {
        return apiSearchInLayer(params, containerId);
      }
    }),
    [containerId]
  );

  return { isReady, error, actions };
}
