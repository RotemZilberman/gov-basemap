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

export async function geocode(keyword: string, fullResult = false): Promise<GeocodeResult> {
  const govmap = await loadGovmap();
  const type = fullResult ? govmap.geocodeType.FullResult : govmap.geocodeType.AccuracyOnly;

  return govmap.geocode({
    keyword,
    type
  });
}

export async function zoomToXY(
  x: number,
  y: number,
  level?: number,
  mapDivId?: string
): Promise<void> {
  const govmap = await loadGovmap();
  govmap.zoomToXY(x, y, level, mapDivId);
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
  layersOff: string[] = []
): Promise<void> {
  const govmap = await loadGovmap();
  govmap.setVisibleLayers(layersOn, layersOff);
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
