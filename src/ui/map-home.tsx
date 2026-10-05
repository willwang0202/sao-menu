import React, { useState } from 'react';
import { api } from '../shared/bridge';
import type { MapHome } from '../shared/map';

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Options → Field Map home: where the map centres when device location is unavailable. */
export function MapHomeField({ home, isDesktop, onChange }: { home?: MapHome; isDesktop: boolean; onChange: (home: MapHome | undefined) => void }) {
  const [query, setQuery] = useState(''), [isBusy, setBusy] = useState(false), [error, setError] = useState('');
  const search = async () => {
    if (!query.trim() || isBusy) return;
    setBusy(true); setError('');
    try {
      const place = await api.searchMapPlace(query);
      if (place) { onChange(place); setQuery(''); } else setError('No place matched that search.');
    } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  };
  return <div className="map-home">
    <p className="preference-description">{home ? `Home: ${home.label}` : 'No home location set.'} The Field Map uses this when your position is unavailable.</p>
    <form className="dialog-actions-inline" onSubmit={event => { event.preventDefault(); void search(); }}>
      <input className="map-home-input" aria-label="Search for a home location" placeholder="City or address" value={query} maxLength={120} disabled={!isDesktop || isBusy} onChange={event => setQuery(event.target.value)} />
      <button type="submit" className="dialog-button" disabled={!isDesktop || isBusy || !query.trim()}>{isBusy ? 'Searching…' : 'Set home'}</button>
      {home && <button type="button" className="dialog-button" onClick={() => onChange(undefined)}>Clear</button>}
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="preference-description small">Place search uses OpenStreetMap Nominatim; only the text you search is sent.</p>
  </div>;
}
