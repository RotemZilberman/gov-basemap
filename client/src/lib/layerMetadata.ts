import type { LayerOption } from "../config/layers";
import type { LayerMetadataPayload } from "./chatClient";

export function toLayerMetadataPayload(layers: LayerOption[]): LayerMetadataPayload[] {
  return layers.map((layer) => ({
    id: layer.id,
    label: layer.label,
    description: layer.description,
    groupId: layer.groupId,
    fields: layer.fields?.map((f) => ({
      name: f.name,
      type: f.type,
      options: f.options,
      min: f.min,
      max: f.max
    })),
    zoomCenter: layer.zoomCenter
  }));
}
