import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as store from '../src/desktop/surface-store';

test('surface layouts serialize concurrent saves and recover from corrupt storage', async () => {
  assert.equal(typeof store.SurfaceLayoutStore, 'function');
  const temporary = await mkdtemp(path.join(tmpdir(), 'sao-layout-'));
  try {
    const file = path.join(temporary, 'surface-layout.json');
    const layouts = new store.SurfaceLayoutStore(file);
    assert.deepEqual(await layouts.load(), []);
    const entry = { kind: 'image' as const, source: '/tmp/picture.png', bounds: { x: 42, y: 57, width: 640, height: 360 }, presentation: { fill: 'cover' as const, muted: true, autoResize: false } };
    await Promise.all([layouts.save([entry]), layouts.save([{ ...entry, bounds: { ...entry.bounds, x: 200 } }])]);
    assert.equal((await layouts.load())[0].bounds.x, 200);
    assert.equal(JSON.parse(await readFile(file, 'utf8'))[0].presentation.autoResize, false);
    await writeFile(file, '{corrupt');
    assert.deepEqual(await layouts.load(), []);
    await layouts.save([]);
    assert.deepEqual(await layouts.load(), []);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
