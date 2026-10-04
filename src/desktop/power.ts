/** Battery readings; `isCharging` mirrors the original HP-Bar Utils.qml: external power with a battery present. */
export interface PowerReading { percent: number | null; isCharging: boolean }

export function pmsetPower(stdout: string): PowerReading {
  const match = stdout.match(/(\d+)%/), percent = match ? Number(match[1]) : null;
  return { percent, isCharging: percent !== null && /'AC Power'/.test(stdout) };
}

const LINUX_EXTERNAL_POWER = new Set(['charging', 'full', 'not charging']);
export const linuxCharging = (statuses: string[]) => statuses.some(status => LINUX_EXTERNAL_POWER.has(status.trim().toLowerCase()));
