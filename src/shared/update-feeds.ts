export interface ReleaseArtifact { name: string; bytes: number; sha256: string; sha512: string }
export interface ReleaseReport { version: string; platform: string; arch: string; artifacts: ReleaseArtifact[] }
export interface UpdateManifest {
  version: string; files: Array<{ url: string; size: number; sha512: string }>;
  path: string; sha512: string;
}

/** The only published packages: universal Mac (DMG plus the updater's ZIP), universal Windows installer and Linux AppImage. */
export const RELEASE_PACKAGES: Record<string, string[]> = {
  'darwin-universal': ['mac-universal.zip', 'mac-universal.dmg'],
  'win32-universal': ['windows-universal.exe'],
  'linux-x64': ['linux-x86_64.AppImage'],
};

/** Feed checksums must come from the final installers, including local signing. */
export function createUpdateFeeds(reports: ReleaseReport[], version: string): Record<string, UpdateManifest> {
  const keys = Object.keys(RELEASE_PACKAGES);
  if (!/^\d+\.\d+\.\d+$/.test(version) || reports.length !== keys.length) throw new Error('A stable version and every native report are required.');
  const artifacts = new Map<string, ReleaseArtifact[]>();
  for (const report of reports) {
    const key = `${report.platform}-${report.arch}`, names = RELEASE_PACKAGES[key];
    if (report.version !== version || !names || artifacts.has(key) || report.artifacts.length !== names.length) throw new Error(`Invalid native report: ${key}`);
    for (const suffix of names) {
      const name = `sao-menu-${version}-${suffix}`, artifact = report.artifacts.find(file => file.name === name);
      if (!artifact || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1000000 || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !/^[A-Za-z0-9+/]{86}==$/.test(artifact.sha512)) throw new Error(`Invalid installer metadata: ${name}`);
    }
    artifacts.set(key, report.artifacts);
  }
  const manifest = (key: string, suffix: string): UpdateManifest => {
    const files = artifacts.get(key)!.map(file => ({ url: file.name, size: file.bytes, sha512: file.sha512 }));
    const primary = files.find(file => file.url.endsWith(suffix))!;
    return { version, files, path: primary.url, sha512: primary.sha512 };
  };
  return { 'latest-mac.yml': manifest('darwin-universal', 'mac-universal.zip'),
    'latest.yml': manifest('win32-universal', '.exe'), 'latest-linux.yml': manifest('linux-x64', '.AppImage') };
}
