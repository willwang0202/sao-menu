import { build } from 'esbuild';
await build({ entryPoints: ['src/service/main.ts'], outfile: 'dist-service/server.cjs', bundle: true, platform: 'node', target: 'node24', format: 'cjs', sourcemap: false });
