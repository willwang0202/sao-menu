import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeLayouts, type SurfaceLayout } from '../shared/surface-layout';

export class SurfaceLayoutStore {
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}
  async load(): Promise<SurfaceLayout[]> {
    await this.writes;
    try {
      if ((await stat(this.file)).size > 2 * 1024 * 1024) return [];
      return normalizeLayouts(JSON.parse(await readFile(this.file, 'utf8')));
    } catch { return []; }
  }
  save(layouts: SurfaceLayout[]): Promise<void> {
    const snapshot = normalizeLayouts(layouts);
    const operation = this.writes.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, this.file);
    });
    this.writes = operation.catch(() => {});
    return operation;
  }
}
