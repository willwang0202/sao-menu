import { opendir, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LauncherItem, Platform } from '../shared/contracts';

export const platform = (['darwin', 'win32', 'linux'].includes(process.platform) ? process.platform : 'linux') as Platform;

function uniquePaths(paths: Array<string | undefined>): string[] {
  return [...new Set(paths.filter((entry): entry is string => Boolean(entry)).map(entry => path.resolve(entry)))];
}

export function applicationRoots(): string[] {
  if (platform === 'darwin') return ['/Applications', '/System/Applications', path.join(os.homedir(), 'Applications')];
  if (platform === 'win32') return uniquePaths([
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs'),
    process.env.APPDATA && path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    process.env.ProgramData && path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ]);
  return uniquePaths([
    '/usr/share/applications', '/usr/local/share/applications',
    path.join(os.homedir(), '.local', 'share', 'applications'),
    '/var/lib/flatpak/exports/share/applications',
    path.join(os.homedir(), '.local', 'share', 'flatpak', 'exports', 'share', 'applications'),
    '/var/lib/snapd/desktop/applications',
  ]);
}

// Finder is a native equivalent of the original Explorer command. Grant this
// exact system application without permitting all of /System/Library.
const builtinApplications = platform === 'darwin' ? ['/System/Library/CoreServices/Finder.app'] : [];

export function launcherForTarget(target: string, kind: 'application' | 'folder' | 'file', label?: string): LauncherItem {
  const name = label || path.basename(target).replace(/\.(app|exe|lnk|desktop)$/i, '');
  return { id: `native-${createHash('sha256').update(target).digest('hex').slice(0, 20)}`, name, kind, target };
}

function allowedExtension(target: string): boolean {
  const extension = path.extname(target).toLowerCase();
  return platform === 'darwin' ? extension === '.app' : platform === 'win32' ? ['.exe', '.lnk'].includes(extension) : extension === '.desktop';
}

function isWithin(target: string, root: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

const blockedFileExtensions = new Set([
  '.exe', '.lnk', '.app', '.desktop', '.com', '.scr', '.cpl', '.dll', '.pif',
  '.sh', '.command', '.bat', '.cmd', '.ps1', '.psm1', '.psd1', '.vbs', '.vbe',
  '.js', '.jse', '.wsf', '.wsh', '.hta', '.py', '.pyw', '.rb', '.pl', '.php',
  '.lua', '.zsh', '.bash', '.fish', '.ksh', '.csh', '.scpt', '.applescript',
  '.workflow', '.bundle', '.plugin', '.jar', '.msi', '.msp', '.pkg', '.mpkg',
  '.url', '.webloc', '.website', '.inetloc', '.terminal',
]);

export async function assertLaunchTarget(item: LauncherItem, pickedTargets: ReadonlySet<string>): Promise<string> {
  if (item.kind === 'url') {
    const url = new URL(item.target);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP and HTTPS links without embedded credentials can be opened.');
    return url.href;
  }
  if (!path.isAbsolute(item.target) || item.target.includes('\0')) throw new Error('Launch targets must use an absolute file path.');
  // Resolve and inspect the actual target before launching. Installed application
  // symlinks (macOS Safari and Linux Flatpak exports) remain valid through their
  // original location in a standard application directory.
  const target = await realpath(item.target);
  const info = await stat(target);
  if (item.kind === 'folder') {
    if (!info.isDirectory() || path.extname(target).toLowerCase() === '.app') throw new Error('The selected folder is unavailable or is an application bundle.');
    return target;
  }
  if (item.kind === 'file') {
    if (!info.isFile()) throw new Error('This entry is not a regular data file.');
    if (blockedFileExtensions.has(path.extname(target).toLowerCase()) || blockedFileExtensions.has(path.extname(item.target).toLowerCase()) || (platform !== 'win32' && (info.mode & 0o111) !== 0)) {
      throw new Error('Executable files, scripts, installers, and shortcut files cannot be opened as data files. Add supported applications through Add application.');
    }
    return target;
  }
  if (!allowedExtension(target) || (platform === 'darwin' ? !info.isDirectory() : !info.isFile())) throw new Error('This application type is unsupported on this operating system.');
  const originalRoots = applicationRoots();
  const roots = await Promise.all(applicationRoots().map(root => realpath(root).catch(() => root)));
  if (!builtinApplications.includes(target) && !originalRoots.some(root => isWithin(path.resolve(item.target), root)) && !roots.some(root => isWithin(target, root)) && !pickedTargets.has(target)) {
    throw new Error('Choose this application with Add application to authorize its location.');
  }
  return target;
}

/** Enumerate one directory level, stopping before unbounded traversal or output. */
export async function listDirectory(target: string): Promise<LauncherItem[]> {
  const directory = await assertLaunchTarget(launcherForTarget(target, 'folder'), new Set());
  const entries: LauncherItem[] = [];
  const handle = await opendir(directory);
  let inspected = 0;
  for await (const entry of handle) {
    if (++inspected > 1000) break;
    if (entry.name.startsWith('.')) continue;
    const entryPath = path.join(directory, entry.name);
    const info = await stat(entryPath).catch(() => null);
    if (!info || (!info.isFile() && !info.isDirectory())) continue;
    const application = allowedExtension(entryPath) && (platform === 'darwin' ? info.isDirectory() : info.isFile());
    const kind = application ? 'application' : info.isDirectory() ? 'folder' : 'file';
    entries.push(launcherForTarget(entryPath, kind, entry.name));
    if (entries.length >= 300) break;
  }
  return entries.sort((left, right) => {
    const leftFolder = left.kind === 'folder' ? 0 : 1;
    const rightFolder = right.kind === 'folder' ? 0 : 1;
    return leftFolder - rightFolder || left.name.localeCompare(right.name);
  });
}

export async function listApplications(): Promise<LauncherItem[]> {
  const applications: LauncherItem[] = [];
  const seen = new Set<string>();
  async function visit(directory: string, depth: number): Promise<void> {
    if (applications.length >= 600) return;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.') || applications.length >= 600) continue;
      const target = path.join(directory, entry.name);
      if (allowedExtension(target)) {
        if (platform === 'darwin' && !entry.isDirectory() && !entry.isSymbolicLink()) continue;
        if (platform !== 'darwin' && !entry.isFile() && !entry.isSymbolicLink()) continue;
        const canonical = await realpath(target).catch(() => target);
        if (seen.has(canonical)) continue;
        let name: string | undefined;
        if (platform === 'linux') {
          const desktop = await readFile(target, 'utf8').catch(() => '');
          const group = desktop.match(/^\[Desktop Entry\]\s*\r?\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1] ?? desktop;
          if (/^(?:Hidden|NoDisplay)=true\s*$/im.test(group) || !/^Type=Application\s*$/m.test(group) || !/^Exec=.+$/m.test(group)) continue;
          name = group.match(/^Name=(.+)$/m)?.[1]?.trim();
        }
        applications.push(launcherForTarget(target, 'application', name));
        seen.add(canonical);
      } else if (entry.isDirectory() && depth > 0) {
        await visit(target, depth - 1);
      }
    }
  }
  for (const root of applicationRoots()) await visit(root, platform === 'win32' ? 3 : 2);
  for (const target of builtinApplications) {
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory() && !seen.has(target)) applications.push(launcherForTarget(target, 'application'));
  }
  return applications.sort((left, right) => left.name.localeCompare(right.name));
}

/** gio understands desktop-entry quoting and field codes; never evaluate Exec in a shell. */
export async function launchLinuxApplication(target: string): Promise<void> {
  try {
    await promisify(execFile)('gio', ['launch', target], { timeout: 10_000, maxBuffer: 8192, windowsHide: true });
  } catch (error) {
    const failure = error as Error & { stderr?: string };
    throw new Error(`Unable to launch desktop application: ${failure.stderr?.trim() || failure.message}`);
  }
}
