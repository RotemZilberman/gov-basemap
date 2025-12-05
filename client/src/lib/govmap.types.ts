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

export interface GovmapSearchAndLocateParams {
  keyword: string;
  locateType?: number;
  maxResults?: number;
}

export interface GovmapSearchAndLocateItem {
  layerName?: string;
  OBJECTID?: number | string;
  text?: string;
  address?: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

export interface GovmapSearchAndLocateResponse {
  data?: GovmapSearchAndLocateItem[];
  results?: GovmapSearchAndLocateItem[];
  Result?: GovmapSearchAndLocateItem[];
  [key: string]: unknown;
}

export interface GovmapIntersectParams {
  layers: string[];
  whereClause?: Record<string, string>;
  wkt?: string;
  x?: number;
  y?: number;
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

  geocode: (
    params: {
      keyword: string;
      type?: unknown;
    },
    mapDivId?: string
  ) => Promise<GeocodeResult>;

  zoomToXY: (params: {
    x: number;
    y: number;
    level?: number;
    marker?: boolean;
    mapDivId?: string;
  }) => void;

  showExportMap: (mapDivId?: string) => void;
  closeExportMap: (mapDivId?: string) => void;

  // שכבות
  setVisibleLayers: (layersOn: string[], layersOff?: string[], mapDivId?: string) => void;

  // מדידות
  showMeasure: (mapDivId?: string) => void;
  closeMeasure: (mapDivId?: string) => void;

  drawType: Record<string, unknown>;
  geocodeType: Record<string, unknown>;
  locateType?: Record<string, unknown>;

  // Optional advanced APIs (guarded in wrapper)
  setLayerOpacity?: (params: { layerName: string; opacity: number }, mapDivId?: string) => void;
  filterLayers?: (params: { layerName: string; whereClause?: string; isZoomToExtent?: boolean }, mapDivId?: string) => void;
  searchAndLocate?: (
    params: GovmapSearchAndLocateParams,
    mapDivId?: string
  ) => Promise<GovmapSearchAndLocateResponse>;
  intersectFeatures?: (params: GovmapIntersectParams, mapDivId?: string) => Promise<unknown>;
  searchInLayer?: (params: Record<string, unknown>, mapDivId?: string) => Promise<unknown> | unknown;
  spatialQuery?: (params: unknown) => unknown;
  getSpatialQuery?: (layerId: string, wkt?: string) => unknown;
  selectFeaturesOnMap?: (params: {
    continous?: boolean;
    drawType?: unknown;
    filterLayer?: boolean;
    isZoomToExtent?: boolean;
    layers: string[];
    returnFields?: Record<string, string[]>;
    selectOnMap?: boolean;
    whereClause?: Record<string, string>;
  }) => Promise<unknown> | unknown;
}

declare global {
  interface Window {
    govmap?: GovmapApi;
  }
}
