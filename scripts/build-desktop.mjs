import { build } from 'esbuild';
import { buildGestureHelper } from '../src/desktop/gesture-build.mjs';
import { rm } from 'node:fs/promises';
await buildGestureHelper();
await build({ entryPoints: ['src/desktop/main.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-desktop/main.cjs', external: ['electron', 'electron-updater'], sourcemap: true });
await build({ entryPoints: ['src/desktop/preload.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-desktop/preload.cjs', external: ['electron'], sourcemap: true });
await build({ entryPoints: ['src/desktop/tracker-preload.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-desktop/tracker-preload.cjs', external: ['electron'], sourcemap: true });
await build({ entryPoints: ['src/desktop/surface-preload.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-desktop/surface-preload.cjs', external: ['electron'], sourcemap: true });
await build({ entryPoints: ['src/desktop/hud-preload.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-desktop/hud-preload.cjs', external: ['electron'], sourcemap: true });
// Vite bundles the original fonts under dist/assets. Keep one copy.
await rm('dist/sao-original/Fonts', { recursive: true, force: true });
