"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLayerCatalog = normalizeLayerCatalog;
exports.formatLayerCatalogPrompt = formatLayerCatalogPrompt;
/**
 * Normalize layer metadata coming from the client. Keeps only the fields we
 * actually use and caps the size to avoid overloading the system prompt.
 */
function normalizeLayerCatalog(input, { maxLayers = 50, maxFieldsPerLayer = 50 } = {}) {
    if (!Array.isArray(input))
        return undefined;
    const layers = [];
    for (const rawLayer of input) {
        if (layers.length >= maxLayers)
            break;
        if (typeof rawLayer === "string") {
            layers.push({ id: rawLayer, label: rawLayer });
            continue;
        }
        if (!rawLayer || typeof rawLayer !== "object")
            continue;
        const id = typeof rawLayer.id === "string"
            ? rawLayer.id
            : typeof rawLayer.name === "string"
                ? rawLayer.name
                : undefined;
        const label = typeof rawLayer.label === "string"
            ? rawLayer.label
            : typeof rawLayer.title === "string"
                ? rawLayer.title
                : undefined;
        if (!id && !label)
            continue;
        const layer = { id, label };
        if (typeof rawLayer.description === "string") {
            layer.description = rawLayer.description;
        }
        if (typeof rawLayer.iconUrl === "string") {
            layer.iconUrl = rawLayer.iconUrl;
        }
        if (typeof rawLayer.groupId === "string") {
            layer.groupId = rawLayer.groupId;
        }
        const zoom = rawLayer.zoomCenter;
        if (zoom &&
            typeof zoom === "object" &&
            typeof zoom.x === "number" &&
            typeof zoom.y === "number" &&
            typeof zoom.level === "number") {
            layer.zoomCenter = {
                x: zoom.x,
                y: zoom.y,
                level: zoom.level
            };
        }
        const rawFields = rawLayer.fields ?? rawLayer.variables;
        if (Array.isArray(rawFields)) {
            const fields = [];
            for (const rawField of rawFields) {
                if (fields.length >= maxFieldsPerLayer)
                    break;
                if (typeof rawField === "string") {
                    fields.push({ name: rawField });
                    continue;
                }
                if (!rawField || typeof rawField !== "object")
                    continue;
                const fieldName = typeof rawField.name === "string" ? rawField.name : undefined;
                if (!fieldName)
                    continue;
                const field = { name: fieldName };
                if (typeof rawField.label === "string") {
                    field.label = rawField.label;
                }
                if (typeof rawField.description === "string") {
                    field.description = rawField.description;
                }
                const fieldType = rawField.type;
                if (fieldType === "text" ||
                    fieldType === "number" ||
                    fieldType === "enum" ||
                    fieldType === "date") {
                    field.type = fieldType;
                }
                if (Array.isArray(rawField.options)) {
                    const opts = rawField.options.filter((opt) => typeof opt === "string");
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
function formatLayerCatalogPrompt(layers) {
    if (!layers || layers.length === 0)
        return undefined;
    const lines = layers.map((layer) => {
        const layerLabel = layer.label && layer.id && layer.label !== layer.id
            ? `${layer.label} (${layer.id})`
            : layer.label ?? layer.id ?? "Layer";
        const parts = [];
        if (layer.description)
            parts.push(layer.description);
        if (layer.fields?.length) {
            const fields = layer.fields.map((f) => {
                const nameLabel = f.label && f.label !== f.name ? `${f.name} (${f.label})` : f.name;
                const details = [nameLabel];
                if (f.type)
                    details.push(`type: ${f.type}`);
                if (f.description)
                    details.push(f.description);
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
