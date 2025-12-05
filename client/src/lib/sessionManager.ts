import { bootstrapSession, type LayerMetadataPayload } from "./chatClient";

let cachedMagic: string | null = null;
let cachedLayerMetadata: LayerMetadataPayload[] | undefined;

export function setLayerMetadata(layers?: LayerMetadataPayload[]): void {
  cachedLayerMetadata = layers;
}

export function getMagicToken(): string | null {
  return cachedMagic;
}

export function applyNewMagic(token?: string): void {
  if (token) {
    cachedMagic = token;
  }
}

export async function ensureMagicToken(layers?: LayerMetadataPayload[]): Promise<string> {
  if (cachedMagic) return cachedMagic;

  const metadata = layers ?? cachedLayerMetadata;
  const magic = await bootstrapSession(metadata);
  cachedMagic = magic;
  if (metadata && !cachedLayerMetadata) {
    cachedLayerMetadata = metadata;
  }
  return magic;
}
