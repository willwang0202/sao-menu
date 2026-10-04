// JSON is a YAML subset understood by electron-updater; no hand-rolled YAML escaping.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createUpdateFeeds } from '../src/shared/update-feeds.ts';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const reports = await Promise.all(['mac-arm64', 'mac-x64', 'windows-x64', 'linux-x64'].map(async name => JSON.parse(await readFile(`output/release-${name}.json`, 'utf8'))));
const feeds = createUpdateFeeds(reports, pkg.version);
await mkdir('release', { recursive: true });
for (const [name, feed] of Object.entries(feeds)) await writeFile(`release/${name}`, JSON.stringify(feed, null, 2) + '\n');
console.log(`Generated three v${pkg.version} update feeds from all eight final installers, retaining both Mac architectures.`);
