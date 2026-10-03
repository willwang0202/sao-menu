import type { SystemStats } from './contracts';
export interface HpState { playerName: string; reducedMotion: boolean; stats: SystemStats | null }
export interface HpAPI { getState(): Promise<HpState>; onState(callback: (state: HpState) => void): () => void }
export function hpProgress(stats: Pick<SystemStats, 'cpuPercent' | 'memoryUsed' | 'memoryTotal'> | null) {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const cpu = stats?.cpuPercent, used = stats?.memoryUsed, total = stats?.memoryTotal;
  return {
    cpu: typeof cpu === 'number' && Number.isFinite(cpu) ? clamp(1 - cpu / 100) : null,
    ram: typeof used === 'number' && Number.isFinite(used) && typeof total === 'number' && Number.isFinite(total) && total > 0 ? clamp(1 - used / total) : null,
  };
}
declare global { interface Window { saoHP?: HpAPI } }
