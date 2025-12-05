/**
 * Layer metadata shared by the client so the model knows the exact layer and
 * field names it can use.
 */
export type LayerFieldType = "text" | "number" | "enum" | "date";

export interface LayerVariable {
  name: string;
  label?: string;
  description?: string;
  type?: LayerFieldType;
  options?: string[]; // for enum type
}

export interface LayerDefinition {
  id?: string; // GovMap layer name/ID (used in API calls)
  label?: string; // Human-friendly name
  description?: string;
  iconUrl?: string;
  groupId?: string;
  fields?: LayerVariable[];
  zoomCenter?: { x: number; y: number; level: number };
}

export type LayerCatalog = LayerDefinition[];

/**
 * Normalize layer metadata coming from the client. Keeps only the fields we
 * actually use and caps the size to avoid overloading the system prompt.
 */
export function normalizeLayerCatalog(
  input: unknown,
  {
    maxLayers = 50,
    maxFieldsPerLayer = 50
  }: { maxLayers?: number; maxFieldsPerLayer?: number } = {}
): LayerCatalog | undefined {
  if (!Array.isArray(input)) return undefined;

  const layers: LayerDefinition[] = [];

  for (const rawLayer of input) {
    if (layers.length >= maxLayers) break;

    if (typeof rawLayer === "string") {
      layers.push({ id: rawLayer, label: rawLayer });
      continue;
    }

    if (!rawLayer || typeof rawLayer !== "object") continue;

    const id =
      typeof (rawLayer as any).id === "string"
        ? (rawLayer as any).id
        : typeof (rawLayer as any).name === "string"
        ? (rawLayer as any).name
        : undefined;

    const label =
      typeof (rawLayer as any).label === "string"
        ? (rawLayer as any).label
        : typeof (rawLayer as any).title === "string"
        ? (rawLayer as any).title
        : undefined;

    if (!id && !label) continue;

    const layer: LayerDefinition = { id, label };

    if (typeof (rawLayer as any).description === "string") {
      layer.description = (rawLayer as any).description;
    }
    if (typeof (rawLayer as any).iconUrl === "string") {
      layer.iconUrl = (rawLayer as any).iconUrl;
    }
    if (typeof (rawLayer as any).groupId === "string") {
      layer.groupId = (rawLayer as any).groupId;
    }

    const zoom = (rawLayer as any).zoomCenter;
    if (
      zoom &&
      typeof zoom === "object" &&
      typeof (zoom as any).x === "number" &&
      typeof (zoom as any).y === "number" &&
      typeof (zoom as any).level === "number"
    ) {
      layer.zoomCenter = {
        x: (zoom as any).x,
        y: (zoom as any).y,
        level: (zoom as any).level
      };
    }

    const rawFields = (rawLayer as any).fields ?? (rawLayer as any).variables;
    if (Array.isArray(rawFields)) {
      const fields: LayerVariable[] = [];

      for (const rawField of rawFields) {
        if (fields.length >= maxFieldsPerLayer) break;

        if (typeof rawField === "string") {
          fields.push({ name: rawField });
          continue;
        }

        if (!rawField || typeof rawField !== "object") continue;

        const fieldName = typeof (rawField as any).name === "string" ? (rawField as any).name : undefined;
        if (!fieldName) continue;

        const field: LayerVariable = { name: fieldName };

        if (typeof (rawField as any).label === "string") {
          field.label = (rawField as any).label;
        }
        if (typeof (rawField as any).description === "string") {
          field.description = (rawField as any).description;
        }
        const fieldType = (rawField as any).type;
        if (
          fieldType === "text" ||
          fieldType === "number" ||
          fieldType === "enum" ||
          fieldType === "date"
        ) {
          field.type = fieldType;
        }
        if (Array.isArray((rawField as any).options)) {
          const opts = (rawField as any).options.filter((opt: any) => typeof opt === "string");
          if (opts.length > 0) {
            field.options = opts;
          }
        }
        fields.push(field);
      }

      if (fields.length > 0) {
        layer.fields = fields;
      }
    }

    layers.push(layer);
  }

  return layers.length > 0 ? layers : undefined;
}

/**
 * Build a compact system prompt snippet that lists available layers and the
 * fields on each. Keep it short to avoid wasting tokens.
 */
export function formatLayerCatalogPrompt(layers?: LayerCatalog): string | undefined {
  if (!layers || layers.length === 0) return undefined;

  const lines = layers.map((layer) => {
    const layerLabel =
      layer.label && layer.id && layer.label !== layer.id
        ? `${layer.label} (${layer.id})`
        : layer.label ?? layer.id ?? "Layer";

    const parts: string[] = [];
    if (layer.description) parts.push(layer.description);

    if (layer.fields?.length) {
      const fields = layer.fields.map((f) => {
        const nameLabel = f.label && f.label !== f.name ? `${f.name} (${f.label})` : f.name;
        const details: string[] = [nameLabel];
        if (f.type) details.push(`type: ${f.type}`);
        if (f.description) details.push(f.description);
        return details.length > 1 ? `${details[0]} – ${details.slice(1).join(", ")}` : details[0];
      });

      parts.push(`fields: ${fields.join(", ")}`);
    }

    return `- ${layerLabel}${parts.length ? " | " + parts.join(" | ") : ""}`;
  });

  return [
    "Available map layers and their fields(use explicit layer and field names in queries):",
    ...lines
  ].join("\n");
}
