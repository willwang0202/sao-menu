import { readFile, writeFile } from 'node:fs/promises';
import { isSystemUpdated, parseSystemRecord, systemLabel } from '../shared/system-update';

/**
 * Compares the running OS version with the one recorded at the previous launch and records the new one.
 * Returns the banner label when the system was updated, otherwise null.
 */
export async function checkSystemUpdate(file: string, platform: string, current: string): Promise<string | null> {
  let previous: string | null = null;
  try { previous = parseSystemRecord(await readFile(file, 'utf8')); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('Unable to read the recorded system version.', error);
  }
  if (previous !== current) {
    try { await writeFile(file, JSON.stringify({ version: current }) + '\n'); } catch (error) { console.warn('Unable to record the system version.', error); }
  }
  return isSystemUpdated(previous, current) ? systemLabel(platform, current) : null;
}
