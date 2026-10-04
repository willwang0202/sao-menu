import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import './field-map.css';
import { api } from '../shared/bridge';
import { MAP_STYLE_URL, type MapPosition } from '../shared/map';
import { saoMapStyle } from '../shared/map-style';

/** Portrait card like the anime's Dungeon Map window. */
export const FIELD_MAP_SIZE = { width: 380, height: 500 } as const;
// Vite bundles MapLibre's worker so it loads from the app itself in dev and production builds.
maplibregl.setWorkerUrl(mapWorkerUrl);
const STREET_ZOOM = 15;
const WORLD_ZOOM = 1.4;
const FLY_MS = 900;

const HINTS: Record<string, string> = {
  denied: 'Location access is off. Allow SAO Menu in System Settings → Privacy & Security → Location Services, or set a home location in Options.',
  disabled: 'Location Services are turned off in System Settings. You can set a home location in Options.',
  unsupported: 'Device location is available on macOS. Set a home location in Options to centre the map.',
  timeout: 'Your position could not be found in time. Set a home location in Options, or try again.',
  unavailable: 'Your position is unavailable right now. Set a home location in Options, or try again.',
};
/** Why the map fell back to the saved home; the home itself needs no further advice. */
const HOME_REASONS: Record<string, string> = { denied: 'Location access is off.', disabled: 'Location Services are off.', timeout: 'Your position could not be found in time.', unavailable: 'Your position is unavailable right now.', unsupported: '' };
const formatCoordinate = (value: number, positive: string, negative: string) => `${value >= 0 ? positive : negative} ${Math.abs(value).toFixed(4)}°`;

function playerMarker(): HTMLElement {
  const element = document.createElement('div');
  element.className = 'field-map-player';
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = '<span class="player-pulse"></span><span class="player-arrow"></span>';
  return element;
}

/** Navigation → Field Map: the anime's map window, showing the real world around the player. */
export function FieldMap({ x, y, motion }: { x: number; y: number; motion: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [position, setPosition] = useState<MapPosition | null>(null);
  const [error, setError] = useState('');

  const locate = () => { setPosition(null); void api.getMapPosition().then(setPosition).catch(() => setPosition({ source: 'none', reason: 'unavailable' })); };
  useEffect(() => {
    let active = true;
    void fetch(MAP_STYLE_URL).then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json(); }).then(style => {
      if (!active || !container.current) return;
      map.current = new maplibregl.Map({ container: container.current, style: saoMapStyle(style), center: [0, 20], zoom: WORLD_ZOOM, attributionControl: false, fadeDuration: motion ? 300 : 0 });
      map.current.on('error', () => setError('Some map tiles could not be loaded.'));
    }).catch(() => { if (active) setError('The map could not be loaded. Check your internet connection.'); });
    locate();
    return () => { active = false; marker.current?.remove(); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const view = map.current;
    if (!view || !position || position.source === 'none') return;
    const center: [number, number] = [position.longitude, position.latitude];
    marker.current ??= new maplibregl.Marker({ element: playerMarker() });
    marker.current.setLngLat(center).addTo(view);
    if (motion) view.flyTo({ center, zoom: STREET_ZOOM, duration: FLY_MS }); else view.jumpTo({ center, zoom: STREET_ZOOM });
  }, [position, map.current]);

  const located = position && position.source !== 'none' ? position : null;
  const caption = !position ? 'Locating…' : position.source === 'home' ? position.label : position.source === 'device' ? 'Current Location' : 'World';
  return <section className="field-map" style={{ left: x, top: y, width: FIELD_MAP_SIZE.width, height: FIELD_MAP_SIZE.height }} aria-label="Field Map" onWheel={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <header className="field-map-title"><h2>Field Map</h2></header>
    <div className="field-map-frame"><div className="field-map-canvas" ref={container} /></div>
    {position?.source === 'none' && <p className="field-map-hint" role="status">{HINTS[position.reason] ?? HINTS.unavailable}</p>}
    {position?.source === 'home' && HOME_REASONS[position.reason] && <p className="field-map-hint subtle" role="status">{`${HOME_REASONS[position.reason]} Showing your home location.`}</p>}
    {error && <p className="field-map-hint" role="alert">{error}</p>}
    <footer className="field-map-caption">
      <span className="field-map-chevron" aria-hidden="true" />
      <strong title={caption}>{caption}</strong>
      <div className="field-map-meta">
        <span>{located ? `${formatCoordinate(located.latitude, 'N', 'S')}  ${formatCoordinate(located.longitude, 'E', 'W')}` : '—'}{located?.source === 'device' && located.accuracy ? `  ±${Math.round(located.accuracy)} m` : ''}</span>
        <div className="field-map-controls">
          <button type="button" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>−</button>
          <button type="button" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>+</button>
          <button type="button" className="field-map-locate" onClick={locate}>Locate</button>
        </div>
      </div>
    </footer>
  </section>;
}
