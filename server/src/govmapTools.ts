import { get } from "http";
import { ChatMessage } from "./redis";

/**
 * Offline cheat-sheet for the GovMap JavaScript API.
 * The model has no internet, so keep this list rich enough to cover
 * the major actions it can take.
 */
export const GOVMAP_API_GUIDE = `
Core navigation
- zoomToXY({ x, y, level?, marker: Boolean }): move the map to coordinates, optionally drop a marker. the level is optional zoom level (0-10).
- getXY(): after calling this function the mouse pointer change to + and after click teh coordinate it will return the function so before use the tool first add asssistance message "is it ok to click on the map to get coordinates? and only then add the tool request".
- getCenter(): returns current map center { x, y }.
- setCenter({ x, y }): Set the center point.
- setBackground({ backgroundId: number }): switch basemap, 0-Streets & buildings, 1-Aerial 2023, 2-Combined, 3-CIR, 5-TA 1930, 6-Map 1935, 7-Jerusalem 1926, 8-Haifa 1919, 9-Topographic, 11-No background, 16-Aerial 2003, 17-Aerial 2004, 18-Aerial 2006, 19-Aerial 2013, 20-Aerial 2005, 21-Aerial 2008, 24-Aerial 2019, 27-Aerial 2022, 32-Aerial 2021.
- getBackground(): returns current background ID.
- zoomIn(): increase zoom level by 1.
- zoomOut(): decrease zoom level by 1.
- getZoomLevel():  returns current zoom level.
- getMapTolerance(): returns map tolerance in meters.
- refreshResource({ layerName: string }): refresh a specific layer.
- gpsOn().
- gpsOff().
- getGPSLocation().
- setMapMarker({ x, y }): place a custom marker on the map.
- clearMapMarker(): removes all custom markers.

Drawing, editing, measuring
- draw({ drawType: govmap.drawType.[Point|Polyline|Polygon|Rectangle|Circle] }): When you want that the user will draw somethig and you will get the geometry in WKT format.
- editDrawing(): When the user edits last drawn geometry; callback returns WKT.
- zoomToDrawing(): zooms to last drawn/edited geometry.
- clearDrawing(): clears last drawn/edited geometry.
- clearDrawings(): clears all drawings.
- showMeasure().
- closeMeasure().
- showPrint(): screenshot of the map.
- closePrint().
- showExportMap().
- closeExportMap().
- closeOpenApps(): closes any open print/measure/export apps.

Layers & styling
- setVisibleLayers({ layersOn: string[], layersOff?: string[] }): toggle layer visibility.
- setLayerOpacity({ layerName: string, opacity: number }): Set opacity for a single layer. the opacity is from 0 to 100.
- refreshLayer({ layerName?: string }).
- setHeatLayer({ points: { point: { x: number, y: number }, attributes: { val1?: number, val2?: number } }[], options: { valueField: string, gradient?: number[][], radius?: number, opacity?: number, blur?: number, xField?: string, yField?: string } }): Creates a client-side heatmap layer from weighted points, with configurable value field, gradient, radius, opacity, blur, and coordinate field names.- removeHeatLayer()
- removeHeatLayer(): Removes the heatmap layer.

Layers & styling (configuration-object functions)
- getLayerRenderer({ LayerNames: string[] }): Get the renderer info for one or more layers.
- filterLayers({ layerName: string, whereClause: string, zoomToExtent?: boolean): Filter a single layer.
- selectFeaturesOnMap{ layers: string[], drawType?: govmap.drawType, whereClause?: Record<string, string>, selectOnMap?: boolean, isZoomToExtent?: boolean, returnFields?: Record<string, string[]> }): Select/zoom to features.
- closeBubble() : Close any open info bubble of objects on the map.

Search, locate, geocode (configuration-object functions)
- identifyByXY({ x: number, y: number}): Identify general features at a point (not specific layer).
- identifyByXYAndLayer({ x: number, y: number, layers: string[]}): Identify features at a point in a specific layers.
- searchAndLocate({
    type: govmap.locateType.[addressToLotParcel|lotParcelToAddress],
    address?: string,   // כתובת לחיפוש גוש/חלקה
    lot?: number, parcel?: number, // גוש/חלקה להפקת כתובת
  }): Locates or reverse-locates by address/lot/parcel.
- getLayerData({ LayerName: string, Point: { x: number, y: number }, Radius: number}): Get data from a layer around a point given a radius in meters.
Spatial analysis (Configuration Object functions)
- intersectFeatures({ address?: string, geometry?: string, layerName: string, fields?: string[], getShapes?: boolean, whereClause?: string }): Finds layer features by address or WKT, optionally filtering and returning shapes.
- searchInLayer({ layerName, fieldName, fieldValues, highlight?, showBubble?, outLineColor?, fillColor? }): Searches for features in a specific layer by field values, optionally highlighting them, opening an info bubble, and styling outline/fill colors.

General rules
- whereClause is a single SQL-style filter string made of one or more (condition) blocks, where each condition compares a field to a value using =, <>, <, >, >=, <=, or IN (...).
String values must be in single quotes, numbers without quotes, and multiple conditions are combined with AND or OR.
Example: "(SETL_NAME = 'תל אביב-יפו') AND (COMPANY = 'פז')".
- Keep commands minimal: do only what the user asked, no filler actions.
- If a parameter is unknown or you are unsure of the correct function, ask a short clarifying question instead of guessing.
`;

/**
 * A single GovMap command for the client to execute.
 * On the React side you will do something like:
 *   (govmap as any)[cmd.fn](cmd.args);
 */
export interface GovmapCommand {
  fn: string;  // GovMap function name, e.g. "intersectFeatures"
  args: any;  // JSON arguments according to the GovMap JS API
  tool_call_id?: string; // OpenAI tool_call_id (snake_case for OpenAI payloads)
}

export interface GovmapToolResult {
  commands: GovmapCommand[];
  note?: string;  // extra explanation from the model (optional)
}

/**
 * Tool definition used with `chat.completions.create`.
 *
 * IMPORTANT:
 *  - This is a SUMMARY of the GovMap JS API, because the model has NO internet.
 *  - You must keep descriptions here rich enough so the model knows what tools exist.
 */
export const govmapTools = [
  {
    type: "function" as const,
    function: {
      name: "govmap_call",
      description: `
Plan one or more GovMap JavaScript API calls to manipulate the map
in the user's browser. You do NOT execute GovMap yourself. You only
return commands which the frontend will call like:

  govmap[fn](args);

Usage rules:
- Use this tool whenever the user wants to change the map view, layers, filters, selections, geocode, or perform spatial operations.
- Use ONLY real GovMap function names listed in the GovMap API reference.
- If you are unsure which function or arguments to use, ask the user a short clarifying question instead of guessing.
- Use as few commands as possible to achieve the user’s goal. Avoid unnecessary actions.
- When you need data from the map (e.g. geocode, searchAndLocate, intersectFeatures, selectFeaturesOnMap, spatial queries):
  - Specify precisely which fields or attributes you want returned (via returnFields or similar options).
  - The client will run the commands and return toolResults in a later message.
  - If relevant toolResults for the same operation already exist, use them to answer the user instead of calling the tool again.

Language for explanation:
- The "explanation" field must be a SHORT sentence in the user's language (Hebrew or English), describing what changed on the map or what operation is being performed.
- Do NOT describe internal reasoning, only the visible effect for the user.

GovMap quick reference:
${GOVMAP_API_GUIDE}
      `.trim(),
      parameters: {
        type: "object",
        properties: {
          commands: {
            type: "array",
            description:
              "A list of GovMap commands (fn + args) that the frontend will execute in order using govmap[fn](args).",
            items: {
              type: "object",
              properties: {
                fn: {
                  type: "string",
                  description:
                    "GovMap JS function name, e.g. 'zoomToXY', 'setVisibleLayers', 'intersectFeatures', 'filterLayers', 'gpsOn', 'GeocodeString'. Use only functions from the GovMap API reference."
                },
                args: {
                  type: "object",
                  description:
                    "Arguments object for that function, following the GovMap JS API patterns. Use the named keys shown in the reference above (e.g. 'x', 'y', 'level', 'layers', 'whereClause', 'returnFields').",
                  additionalProperties: true
                }
              },
              required: ["fn", "args"]
            },
            minItems: 1
          },
          explanation: {
            type: "string",
            description:
              "Short natural-language explanation (Hebrew or English, depending on the user's language) of what changed on the map or what the commands do. Example: 'מרכזתי את המפה על הכתובת ומיקדתי לשכבת המבנים.' or 'I centered the map on the address and zoomed to the buildings layer.'"
          }
        },
        required: ["commands"]
      }
    }
  }
];


/**
 * Convert govmap_call arguments to a GovmapToolResult.
 */
export function handleGovmapToolCall(
  args: any
): GovmapToolResult {
  const commands: GovmapCommand[] = Array.isArray(args.commands)
    ? args.commands
        .filter((cmd: any) => cmd && typeof cmd.fn === "string")
        .map((cmd: any) => normalizeGovmapCommand(cmd))
    : [];

  return {
    commands,
    note: args.explanation ?? undefined
  };
}

function normalizeGovmapCommand(
  rawCmd: any
): GovmapCommand {
  const fn = rawCmd.fn;
  const args =
    typeof rawCmd.args === "object" && rawCmd.args !== null ? rawCmd.args : {};
  const toolCallId =
    typeof rawCmd.tool_call_id === "string" ? rawCmd.tool_call_id : undefined;

  return {
    fn,
    args: normalizeGovmapArgs(fn, args),
    ...(toolCallId ? { tool_call_id: toolCallId } : {})
  };
}

// Positional GovMap functions and their ordered argument names.
const POSITIONAL_SIGNATURES: Record<string, string[]> = {
  identifyByXY: ["x", "y"],
  identifyByXYAndLayer: ["x", "y", "layers"],
  setCenter: ["x", "y"],
  getZoomLevel: [],
  getCenter: [],
  setBackground: ["backgroundId"],
  getBackground: [],
  zoomIn: [],
  zoomOut: [],
  getMapTolerance: [],
  gpsOn: [],
  showPrint: [],
  closePrint: [],
  gpsOff: [],
  getXY: [],
  closeOpenApps: [],
  getGPSLocation: [],
  zoomToDrawing: [],
  draw: ["drawType"],
  editDrawing: [],
  clearDrawing: [],
  clearDrawings: [],
  showMeasure: [],
  closeMeasure: [],
  showExportMap: [],
  closeExportMap: [],
  closeBubble: [],
  setVisibleLayers: ["layersOn", "layersOff"],
  removeHeatLayer: [],
  refreshLayer: ["layerName"],
  clearSelection: ["layerName"],
  identifyOnClick: ["enabled"]
};

function normalizeGovmapArgs(
  fn: string,
  rawArgs: any
): any {
  const args = typeof rawArgs === "object" && rawArgs !== null ? { ...rawArgs } : {};

  // Already using _UNPACK_ARGS_: normalize only.
  if (Array.isArray((args as any)._UNPACK_ARGS_)) {
    return {
      _UNPACK_ARGS_: trimTrailingUndefined((args as any)._UNPACK_ARGS_)
    };
  }

  // Convert positional functions into _UNPACK_ARGS_ array based on known order.
  const signature = POSITIONAL_SIGNATURES[fn];
  if (signature) {
    const ordered = signature.map((key) => args[key]);
    return { _UNPACK_ARGS_: trimTrailingUndefined(ordered) };
  }

  return args;
}

function trimTrailingUndefined(arr: any[]): any[] {
  const copy = [...arr];
  while (
    copy.length > 0 &&
    (copy[copy.length - 1] === undefined || copy[copy.length - 1] === null)
  ) {
    copy.pop();
  }
  return copy;
}
