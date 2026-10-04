/** SAO Field Map look: the anime's white/grey hologram map, applied to an OpenFreeMap (OpenMapTiles) style. */
export const SAO_MAP_COLORS = {
  ground: 'rgba(246,247,249,0.94)', water: '#c6d9e7', green: '#e3e9e1', building: '#dfe1e5',
  road: '#ffffff', roadCasing: '#c9ccd2', boundary: '#9ba6b2', label: '#555a60', halo: 'rgba(255,255,255,0.9)',
} as const;

type Layer = { id: string; type: string; 'source-layer'?: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };
type Style = { layers: Layer[]; [key: string]: unknown };

const matches = (layer: Layer, ...words: string[]) => words.some(word => layer.id.includes(word) || layer['source-layer']?.includes(word));

function recolor(layer: Layer): Record<string, unknown> | undefined {
  const paint = { ...layer.paint };
  if (layer.type === 'background') return { ...paint, 'background-color': SAO_MAP_COLORS.ground };
  if (layer.type === 'fill') {
    if (matches(layer, 'water')) return { ...paint, 'fill-color': SAO_MAP_COLORS.water };
    if (matches(layer, 'park', 'landcover', 'wood', 'grass')) return { ...paint, 'fill-color': SAO_MAP_COLORS.green };
    if (matches(layer, 'building')) return { ...paint, 'fill-color': SAO_MAP_COLORS.building };
    return layer.paint;
  }
  if (layer.type === 'line') {
    if (matches(layer, 'water')) return { ...paint, 'line-color': SAO_MAP_COLORS.water };
    if (matches(layer, 'boundary')) return { ...paint, 'line-color': SAO_MAP_COLORS.boundary };
    if (matches(layer, 'casing')) return { ...paint, 'line-color': SAO_MAP_COLORS.roadCasing };
    if (matches(layer, 'highway', 'road', 'transportation', 'bridge', 'tunnel')) return { ...paint, 'line-color': SAO_MAP_COLORS.road };
    return layer.paint;
  }
  if (layer.type === 'symbol' && layer.layout?.['text-field']) return { ...paint, 'text-color': SAO_MAP_COLORS.label, 'text-halo-color': SAO_MAP_COLORS.halo, 'text-halo-width': 1.2 };
  return layer.paint;
}

/** Returns a new style; the downloaded one is left unchanged. */
export function saoMapStyle<T extends Style>(style: T): T {
  return { ...style, layers: style.layers.map(layer => { const paint = recolor(layer); return paint ? { ...layer, paint } : layer; }) };
}
