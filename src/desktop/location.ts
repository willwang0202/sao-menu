import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { promisify } from 'node:util';
import { GEOCODE_URL, parseGeocode, parseHelperLocation, resolveMapPosition, type HelperLocation, type MapHome, type MapPosition } from '../shared/map';

const execute = promisify(execFile);
/** The helper waits up to 20 s for macOS; leave room for its own timeout reply. */
const HELPER_TIMEOUT_MS = 25_000;
/** Reuse a fix briefly so reopening the map doesn't re-run Core Location. */
const FIX_CACHE_MS = 5 * 60_000;
const GEOCODE_TIMEOUT_MS = 10_000;
const MAX_QUERY = 120;

/** Field Map position: Core Location on macOS through a one-shot native helper, else the saved home. */
export class MapLocation {
  private cached: { at: number; location: HelperLocation } | null = null;
  private pending: Promise<HelperLocation> | null = null;
  constructor(private readonly helper: string, private readonly home: () => MapHome | undefined, private readonly version: string) {}

  async position(): Promise<MapPosition> { return resolveMapPosition(await this.device(), this.home()); }

  /** OpenStreetMap place search for the fallback home; the query leaves the device only on explicit search. */
  async search(query: unknown): Promise<MapHome | null> {
    if (typeof query !== 'string' || !query.trim() || query.length > MAX_QUERY || /[\u0000-\u001f]/.test(query)) throw new Error('Enter a city or address of up to 120 characters.');
    const url = new URL(GEOCODE_URL);
    url.search = new URLSearchParams({ format: 'json', limit: '1', q: query.trim() }).toString();
    const response = await fetch(url, { headers: { 'User-Agent': `sao-menu/${this.version} (https://sao-menu.favioon.com)` }, signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) });
    if (!response.ok) throw new Error('Place search is unavailable right now. Try again shortly.');
    return parseGeocode(await response.json()) ?? null;
  }

  private async device(): Promise<HelperLocation> {
    if (process.platform !== 'darwin') return { ok: false, error: 'unsupported' };
    // Automated checks must not raise the macOS location prompt.
    if (process.env.SAO_TEST_NO_DEVICE_LOCATION === '1') return { ok: false, error: 'unavailable' };
    if (this.cached?.location.ok && Date.now() - this.cached.at < FIX_CACHE_MS) return this.cached.location;
    this.pending ??= this.readHelper().finally(() => { this.pending = null; });
    return this.pending;
  }
  private async readHelper(): Promise<HelperLocation> {
    try {
      await access(this.helper, constants.X_OK);
      const { stdout } = await execute(this.helper, [], { timeout: HELPER_TIMEOUT_MS, maxBuffer: 4096 });
      const location = parseHelperLocation(stdout);
      this.cached = { at: Date.now(), location };
      return location;
    } catch (error) {
      console.warn('Field Map location helper failed', error);
      return { ok: false, error: 'unavailable' };
    }
  }
}
