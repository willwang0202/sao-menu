import test from 'node:test';
import assert from 'node:assert/strict';
import { saoMapStyle, SAO_MAP_COLORS } from '../src/shared/map-style';

const style = { version: 8, sources: {}, layers: [
  { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
  { id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#00f' } },
  { id: 'park', type: 'fill', 'source-layer': 'park', paint: { 'fill-color': '#0f0' } },
  { id: 'building', type: 'fill', 'source-layer': 'building', paint: { 'fill-color': '#888' } },
  { id: 'highway_major', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#f00', 'line-width': 2 } },
  { id: 'boundary_country', type: 'line', 'source-layer': 'boundary', paint: { 'line-color': '#000' } },
  { id: 'poi_r1', type: 'symbol', 'source-layer': 'poi', layout: { 'text-field': '{name}' }, paint: {} },
  { id: 'place_city', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': '{name}' }, paint: { 'text-color': '#000' } },
] };

test('restyles OpenStreetMap layers into the anime Dungeon Map palette', () => {
  const next = saoMapStyle(style);
  const paint = (id: string) => next.layers.find(layer => layer.id === id)!.paint as Record<string, unknown>;
  assert.equal(paint('background')['background-color'], SAO_MAP_COLORS.ground);
  assert.equal(paint('water')['fill-color'], SAO_MAP_COLORS.water);
  assert.equal(paint('park')['fill-color'], SAO_MAP_COLORS.green);
  assert.equal(paint('building')['fill-color'], SAO_MAP_COLORS.building);
  assert.equal(paint('highway_major')['line-color'], SAO_MAP_COLORS.road);
  assert.equal(paint('highway_major')['line-width'], 2, 'keeps geometry-related paint');
  assert.equal(paint('boundary_country')['line-color'], SAO_MAP_COLORS.boundary);
  assert.equal(paint('place_city')['text-color'], SAO_MAP_COLORS.label);
  assert.equal(paint('place_city')['text-halo-color'], SAO_MAP_COLORS.halo);
  assert.equal((next.layers.find(layer => layer.id === 'poi_r1')!.layout as Record<string, unknown>).visibility, 'none', 'points of interest are hidden');
});

test('does not mutate the downloaded style', () => {
  const copy = structuredClone(style);
  saoMapStyle(style);
  assert.deepEqual(style, copy);
});
