export interface ReleaseArtifact { name: string; bytes: number; sha256: string; sha512: string }
export interface ReleaseReport { version: string; platform: string; arch: string; artifacts: ReleaseArtifact[] }
export interface UpdateManifest {
  version: string; files: Array<{ url: string; size: number; sha512: string }>;
  path: string; sha512: string;
}

/** Feed checksums must come from the final installers, including local signing. */
export function createUpdateFeeds(reports: ReleaseReport[], version: string): Record<string, UpdateManifest> {
  if (!/^\d+\.\d+\.\d+$/.test(version) || reports.length !== 4) throw new Error('A stable version and all four native reports are required.');
  const expected: Record<string, string[]> = {
    'darwin-arm64': ['mac-arm64.zip', 'mac-arm64.dmg'],
    'darwin-x64': ['mac-x64.zip', 'mac-x64.dmg'],
    'win32-x64': ['windows-x64.exe', 'windows-x64.zip'],
    'linux-x64': ['linux-x86_64.AppImage', 'linux-amd64.deb'],
  };
  const artifacts = new Map<string, ReleaseArtifact[]>();
  for (const report of reports) {
    const key = `${report.platform}-${report.arch}`, names = expected[key];
    if (report.version !== version || !names || artifacts.has(key) || report.artifacts.length !== 2) throw new Error(`Invalid native report: ${key}`);
    for (const suffix of names) {
      const name = `sao-menu-${version}-${suffix}`, artifact = report.artifacts.find(file => file.name === name);
      if (!artifact || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1000000 || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !/^[A-Za-z0-9+/]{86}==$/.test(artifact.sha512)) throw new Error(`Invalid installer metadata: ${name}`);
    }
    artifacts.set(key, report.artifacts);
  }
  const manifest = (keys: string[], suffix: string): UpdateManifest => {
    const files = keys.flatMap(key => artifacts.get(key)!).map(file => ({ url: file.name, size: file.bytes, sha512: file.sha512 }));
    const primary = files.find(file => file.url.endsWith(suffix))!;
    return { version, files, path: primary.url, sha512: primary.sha512 };
  };
  return { 'latest-mac.yml': manifest(['darwin-x64', 'darwin-arm64'], 'mac-x64.zip'),
    'latest.yml': manifest(['win32-x64'], '.exe'), 'latest-linux.yml': manifest(['linux-x64'], '.AppImage') };
}
