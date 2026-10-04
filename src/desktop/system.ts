import os from 'node:os';
import { readdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SystemStats } from '../shared/contracts';
import { platform } from './applications';

const run = promisify(execFile);
let previousCpu: { idle: number; total: number } | null = null;
let cachedBattery: { value: number | null; sampledAt: number } | null = null;

async function batteryPercent(): Promise<number | null> {
  if (cachedBattery && Date.now() - cachedBattery.sampledAt < 30_000) return cachedBattery.value;
  let value: number | null = null;
  try {
    if (platform === 'darwin') {
      const { stdout } = await run('/usr/bin/pmset', ['-g', 'batt'], { timeout: 2000, maxBuffer: 8192 });
      const match = stdout.match(/(\d+)%/);
      if (match) value = Number(match[1]);
    } else if (platform === 'win32') {
      const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Battery | Select-Object -ExpandProperty EstimatedChargeRemaining)'], { timeout: 2000, maxBuffer: 8192, windowsHide: true });
      const readings: unknown = JSON.parse(stdout);
      const valid = (Array.isArray(readings) ? readings : [readings]).filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 && entry <= 100);
      if (valid.length) value = Math.round(valid.reduce((sum, entry) => sum + entry, 0) / valid.length);
    } else if (platform === 'linux') {
      const entries = await readdir('/sys/class/power_supply');
      const values = await Promise.all(entries.filter(entry => /^BAT/i.test(entry)).map(async entry => Number((await readFile(`/sys/class/power_supply/${entry}/capacity`, 'utf8')).trim())));
      const valid = values.filter(entry => Number.isFinite(entry) && entry >= 0 && entry <= 100);
      if (valid.length) value = Math.round(valid.reduce((sum, entry) => sum + entry, 0) / valid.length);
    }
  } catch { /* Desktop machines and unsupported battery providers have no value. */ }
  cachedBattery = { value, sampledAt: Date.now() };
  return value;
}

export async function getSystemStats(): Promise<SystemStats> {
  const sample = os.cpus().reduce((total, cpu) => ({
    idle: total.idle + cpu.times.idle,
    total: total.total + Object.values(cpu.times).reduce((sum, value) => sum + value, 0),
  }), { idle: 0, total: 0 });
  const elapsed = previousCpu ? sample.total - previousCpu.total : 0;
  const cpuPercent = elapsed > 0 && previousCpu ? Math.round(Math.max(0, Math.min(100, (1 - (sample.idle - previousCpu.idle) / elapsed) * 100))) : null;
  previousCpu = sample;
  return {
    platform, hostname: os.hostname(), cpuPercent,
    memoryUsed: os.totalmem() - os.freemem(), memoryTotal: os.totalmem(),
    uptime: os.uptime(), batteryPercent: await batteryPercent(),
  };
}
