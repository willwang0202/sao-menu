/** SAO Field Map look from the anime's Dungeon Map: glowing cyan ground, deep-blue paths, applied to an OpenFreeMap (OpenMapTiles) style. */
export const SAO_MAP_COLORS = {
  ground: '#86d6f4', water: '#62c3ec', green: '#7ccff0', building: 'rgba(60,150,225,0.10)',
  road: '#1d6fd2', roadCasing: '#4aa8e6', boundary: '#2a80d6', label: '#ffffff', halo: 'rgba(18,96,180,0.75)',
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
    if (matches(layer, 'building')) return { ...paint, 'fill-color': SAO_MAP_COLORS.building, 'fill-outline-color': SAO_MAP_COLORS.building };
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

/** Points of interest are hidden: the anime map shows only paths and place names. */
const isHidden = (layer: Layer) => layer.type === 'symbol' && matches(layer, 'poi');

/** Returns a new style; the downloaded one is left unchanged. */
export function saoMapStyle<T extends Style>(style: T): T {
  return { ...style, layers: style.layers.map(layer => {
    if (isHidden(layer)) return { ...layer, layout: { ...layer.layout, visibility: 'none' } };
    const paint = recolor(layer);
    return paint ? { ...layer, paint } : layer;
  }) };
}
