import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, chmod, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);

/** Build a standalone universal macOS helper, kept outside Electron's asar. */
export async function buildGestureHelper(outputDirectory = 'dist-desktop') {
  if (process.platform !== 'darwin') return;
  const output = path.resolve(outputDirectory);
  const source = fileURLToPath(new URL('./gesture-helper.swift', import.meta.url));
  await mkdir(output, { recursive: true });
  const temporary = await mkdtemp(path.join(output, '.gesture-build-'));
  const cache = path.join(temporary, 'module-cache');
  await mkdir(cache, { recursive: true });
  const binaries = ['arm64', 'x86_64'].map(architecture => path.join(temporary, `gesture-helper-${architecture}`));
  try {
    for (let index = 0; index < binaries.length; index++) {
      const architecture = index === 0 ? 'arm64' : 'x86_64';
      await execute('/usr/bin/xcrun', [
        'swiftc', source, '-O', '-target', `${architecture}-apple-macos11.0`,
        '-module-cache-path', cache, '-o', binaries[index],
      ], { timeout: 120_000, maxBuffer: 1_048_576 });
    }
    const helper = path.join(temporary, 'gesture-helper');
    await execute('/usr/bin/lipo', ['-create', ...binaries, '-output', helper], { timeout: 10_000 });
    await chmod(helper, 0o755);
    await rename(helper, path.join(output, 'gesture-helper'));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
