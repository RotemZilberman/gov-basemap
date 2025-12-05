// src/lib/govmap.wrapper.ts
import type {
  GovmapApi,
  GovmapCreateMapOptions,
  DrawResult,
  GeocodeResult
} from "./govmap.types";

const GOVMAP_SCRIPT_SRC = "https://www.govmap.gov.il/govmap/api/govmap.api.js";

let govmapPromise: Promise<GovmapApi> | null = null;

function injectScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${GOVMAP_SCRIPT_SRC}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = GOVMAP_SCRIPT_SRC;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
}

export async function loadGovmap(): Promise<GovmapApi> {
  if (govmapPromise) return govmapPromise;

  govmapPromise = (async () => {
    await injectScript();

    if (!window.govmap) {
      throw new Error("GovMap API (window.govmap) did not initialize.");
    }

    return window.govmap;
  })();

  return govmapPromise;
}

export async function createGovmapMap(
  containerId: string,
  options: GovmapCreateMapOptions
): Promise<void> {
  const govmap = await loadGovmap();
  govmap.createMap(containerId, options);
}

function wrapDraw(
  drawFn: (govmap: GovmapApi, mapDivId?: string) => {
    progress: (cb: (result: DrawResult) => void) => void;
  },
  mapDivId?: string
): Promise<DrawResult> {
  return (async () => {
    const govmap = await loadGovmap();
    return new Promise<DrawResult>((resolve) => {
      drawFn(govmap, mapDivId).progress((result) => {
        resolve(result);
      });
    });
  })();
}

export function drawPoint(mapDivId?: string): Promise<DrawResult> {
  return wrapDraw((govmap, id) => govmap.draw(govmap.drawType.Point, id), mapDivId);
}

export function drawPolygon(mapDivId?: string): Promise<DrawResult> {
  return wrapDraw((govmap, id) => govmap.draw(govmap.drawType.Polygon, id), mapDivId);
}

export function editDrawing(mapDivId?: string): Promise<DrawResult> {
  return wrapDraw((govmap, id) => govmap.editDrawing(id), mapDivId);
}

export async function zoomIn(mapDivId?: string): Promise<void> {
  const govmap = await loadGovmap();
  govmap.zoomIn(mapDivId);
}

export async function zoomOut(mapDivId?: string): Promise<void> {
  const govmap = await loadGovmap();
  govmap.zoomOut(mapDivId);
}

export async function geocode(
  keyword: string,
  fullResult = false,
  mapDivId?: string
): Promise<GeocodeResult> {
  const govmap = await loadGovmap();
  const type = fullResult ? govmap.geocodeType.FullResult : govmap.geocodeType.AccuracyOnly;

  return govmap.geocode(
    {
      keyword,
      type
    },
    mapDivId
  );
}

export async function zoomToXY(
  x: number,
  y: number,
  level?: number,
  mapDivId?: string
): Promise<void> {
  const govmap = await loadGovmap();

  const params: {
    x: number;
    y: number;
    level?: number;
    mapDivId?: string;
  } = { x, y };

  if (typeof level === "number") params.level = level;
  if (mapDivId) params.mapDivId = mapDivId;

  govmap.zoomToXY(params);
}

export async function showExport(mapDivId?: string): Promise<void> {
  const govmap = await loadGovmap();
  govmap.showExportMap(mapDivId);
}

export async function closeExport(mapDivId?: string): Promise<void> {
  const govmap = await loadGovmap();
  govmap.closeExportMap(mapDivId);
}

// שכבות
export async function setVisibleLayers(
  layersOn: string[],
  layersOff: string[] = [],
  mapDivId?: string
): Promise<void> {
  const govmap = await loadGovmap();
  govmap.setVisibleLayers(layersOn, layersOff, mapDivId);
}

// מדידות
export async function showMeasure(mapDivId?: string): Promise<void> {
  const govmap = await loadGovmap();
  govmap.showMeasure(mapDivId);
}

export async function closeMeasure(mapDivId?: string): Promise<void> {
  const govmap = await loadGovmap();
  govmap.closeMeasure(mapDivId);
}

// שקיפות שכבה
export async function setLayerOpacity(
  layerId: string,
  opacity: number,
  mapDivId?: string
): Promise<void> {
  const govmap = await loadGovmap();
  const safeOpacity = Math.max(0, Math.min(100, opacity));

  if (typeof govmap.setLayerOpacity === "function") {
    govmap.setLayerOpacity({ layerName: layerId, opacity: safeOpacity }, mapDivId);
  } else {
    console.warn("GovMap API לשקיפות שכבה לא זמין");
  }
}

// סינון שכבה
export async function applyLayerFilter(
  layerId: string,
  filter: string,
  mapDivId?: string
): Promise<void> {
  const govmap = await loadGovmap();
  const where = filter?.trim() ?? "";

  if (typeof govmap.filterLayers === "function") {
    govmap.filterLayers(
      {
        layerName: layerId,
        whereClause: where.length > 0 ? where : undefined,
        isZoomToExtent: false
      },
      mapDivId
    );
  } else {
    console.warn("GovMap API לסינון שכבות לא זמין");
  }
}

// ניתוח מרחבי בסיסי (חיתוך מול WKT שסופק)
export async function runSpatialAnalysis(layerId: string, wkt?: string): Promise<unknown> {
  const govmap = await loadGovmap();

  if (typeof govmap.spatialQuery === "function") {
    return govmap.spatialQuery({
      layerName: layerId,
      wkt
    });
  }

  if (typeof govmap.getSpatialQuery === "function") {
    return govmap.getSpatialQuery(layerId, wkt);
  }

  console.warn("GovMap API לניתוח מרחבי לא זמין");
  return null;
}

// זום לשכבה – שימוש ב-selectFeaturesOnMap עם isZoomToExtent
// zoomLayerExtent.ts
export async function zoomLayerExtent(layerId: string): Promise<void> {
  const govmap = await loadGovmap();
  console.log("zoomLayerExtent called for layerId:", layerId);

  // Prefer the official filterLayers API with zoomToExtent
  if (typeof govmap.filterLayers === "function") {
    const params = {
      layerName: layerId,
      whereClause: "(1=1)",   // select all features
      zoomToExtent: true      // 🔥 this is what actually does the zoom
    };

    govmap.filterLayers(params as any);
    return;
  }

  // Optional: if you still want a fallback using selectFeaturesOnMap,
  // you can keep it here, but it's probably not needed.
  console.warn("filterLayers לא זמין, אין אפשרות לבצע זום לשכבה");
  throw new Error("GovMap API filterLayers לא זמין לזום לשכבה");
}

export async function searchAndLocate(
  params: { keyword: string; locateType?: number; maxResults?: number },
  mapDivId?: string
): Promise<unknown> {
  const govmap = await loadGovmap();

  if (typeof govmap.searchAndLocate !== "function") {
    throw new Error("GovMap API searchAndLocate לא קיים");
  }

  return govmap.searchAndLocate(params, mapDivId);
}

export async function intersectFeatures(
  params: { layers: string[]; whereClause?: Record<string, string>; wkt?: string },
  mapDivId?: string
): Promise<unknown> {
  const govmap = await loadGovmap();

  if (typeof govmap.intersectFeatures !== "function") {
    throw new Error("GovMap API intersectFeatures לא קיים");
  }

  return govmap.intersectFeatures(params, mapDivId);
}

export async function searchInLayer(
  params: Record<string, unknown>,
  mapDivId?: string
): Promise<unknown> {
  const govmap = await loadGovmap();

  if (typeof govmap.searchInLayer !== "function") {
    throw new Error("GovMap API searchInLayer לא קיים");
  }

  return govmap.searchInLayer(params, mapDivId);
}
