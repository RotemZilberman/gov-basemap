// src/lib/govmap.types.ts

export interface GovmapCenter {
  x: number;
  y: number;
}

export interface GovmapCreateMapOptions {
  token: string;
  center: GovmapCenter;
  level: number;
  background?: number;
  layers?: string[];
  visibleLayers?: string[];
  identifyOnClick?: boolean;
  showXY?: boolean;
  zoomButtons?: boolean;
  bgButton?: boolean;
  isEmbeddedToggle?: boolean;
  layersMode?: number;
  onLoad?: () => void;
  onClick?: (event: unknown) => void;
  onPan?: (event: unknown) => void;
  onError?: (error: unknown) => void;
}

export interface DrawResult {
  wkt: string;
  tolerance?: number;
  [key: string]: unknown;
}

export interface GeocodeResult {
  ResultCode: number;
  X?: number;
  Y?: number;
  [key: string]: unknown;
}

export interface GovmapApi {
  createMap: (containerId: string, options: GovmapCreateMapOptions) => void;

  draw: (type: unknown, mapDivId?: string) => {
    progress: (cb: (result: DrawResult) => void) => void;
  };

  editDrawing: (mapDivId?: string) => {
    progress: (cb: (result: DrawResult) => void) => void;
  };

  zoomIn: (mapDivId?: string) => void;
  zoomOut: (mapDivId?: string) => void;

  geocode: (params: {
    keyword: string;
    type: unknown;
  }) => Promise<GeocodeResult>;

  zoomToXY: (x: number, y: number, level?: number, mapDivId?: string) => void;

  showExportMap: (mapDivId?: string) => void;
  closeExportMap: (mapDivId?: string) => void;

  // שכבות
  setVisibleLayers: (layersOn: string[], layersOff?: string[]) => void;

  // מדידות
  showMeasure: (mapDivId?: string) => void;
  closeMeasure: (mapDivId?: string) => void;

  drawType: Record<string, unknown>;
  geocodeType: Record<string, unknown>;

  // Optional advanced APIs (guarded in wrapper)
  setLayerOpacity?: (layerId: string, opacity: number) => void;
  setLayersOpacity?: (layers: { layerName: string; opacity: number }[]) => void;
  setLayerFilters?: (filters: { layerName: string; where?: string }[]) => void;
  filterLayers?: (filters: { layerName: string; whereClause?: string }[]) => void;
  spatialQuery?: (params: unknown) => unknown;
  getSpatialQuery?: (layerId: string, wkt?: string) => unknown;
  selectFeaturesOnMap?: (
    layerName: string,
    query?: unknown,
    options?: { isZoomToExtent?: boolean }
  ) => Promise<unknown> | unknown;
}

declare global {
  interface Window {
    govmap?: GovmapApi;
  }
}
