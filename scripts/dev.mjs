import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { build } from 'esbuild';
import electron from 'electron';
import { buildGestureHelper } from '../src/desktop/gesture-build.mjs';
await buildGestureHelper();
await build({ entryPoints: ['src/desktop/main.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-desktop/main.cjs', external: ['electron'] });
await build({ entryPoints: ['src/desktop/preload.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-desktop/preload.cjs', external: ['electron'] });
await build({ entryPoints: ['src/desktop/tracker-preload.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-desktop/tracker-preload.cjs', external: ['electron'] });
for (const name of ['surface-preload', 'hud-preload', 'widget-preload']) await build({ entryPoints: [`src/desktop/${name}.ts`], bundle: true, platform: 'node', format: 'cjs', outfile: `dist-desktop/${name}.cjs`, external: ['electron'] });
const server = await createServer();
await server.listen();
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, SAO_DEV_URL: 'http://127.0.0.1:5173' } });
let shuttingDown = false;
async function shutdown() { if (shuttingDown) return; shuttingDown = true; child.kill(); await server.close(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
child.on('exit', async code => { await shutdown(); process.exitCode = code ?? 0; });
