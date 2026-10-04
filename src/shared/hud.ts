import type { Settings, SystemStats } from './contracts';
import type { PartyMember, SocialSnapshot } from './social';
import type { ThemeId } from './themes';
import { aloHeight } from './hud-alo';
export interface HpState { theme: ThemeId; playerName: string; accountCreatedAt?: number; reducedMotion: boolean; stats: SystemStats | null; partyMembers: PartyMember[] }
export interface HpAPI { setWidth(width: number): Promise<void>; getState(): Promise<HpState>; onState(callback: (state: HpState) => void): () => void }
/** Machines without battery telemetry have a full bar. */
export function hpBattery(percent: number | null | undefined): number {
  return typeof percent === 'number' && Number.isFinite(percent) ? Math.round(Math.max(0, Math.min(100, percent))) : 100;
}
export function hpState(settings: Pick<Settings, 'playerName' | 'reducedMotion' | 'theme'>, stats: SystemStats | null, snapshot: SocialSnapshot | null): HpState {
  const partyMembers = snapshot?.party?.members.some(member => member.id === snapshot.profile.id)
    ? snapshot.party.members.filter(member => member.id !== snapshot.profile.id).slice(0, 5) : [];
  return { theme: settings.theme, playerName: snapshot?.profile.displayName ?? settings.playerName, accountCreatedAt: snapshot?.profile.createdAt, reducedMotion: settings.reducedMotion, stats, partyMembers };
}
export const hpHeight = (companions: number, theme: ThemeId = 'sao') => theme === 'alo' ? aloHeight(companions) : companions > 0 ? 47 + Math.min(5, companions) * 42 : 62;
declare global { interface Window { saoHP?: HpAPI } }

/** Keep the original 40px name box for short labels, with breathing room for longer ones. */
export const hpNameWidth = (textWidth: number) => Math.max(40, Math.ceil(Number.isFinite(textWidth) ? textWidth : 0) + 8);
/** Narrowest HP window the desktop accepts; the 296px ALO bar sits inside it. */
export const HP_MIN_WIDTH = 358;
export const hpWidgetWidth = (textWidths: number[]) => Math.max(HP_MIN_WIDTH + hpNameWidth(textWidths[0] ?? 0) - 40, ...textWidths.slice(1).map(width => 218 + hpNameWidth(width) - 40));

/** Creation day is level one; each full elapsed day advances the counter. */
export function hpLevel(createdAt: number | undefined, now = Date.now()): number {
  return typeof createdAt === 'number' && Number.isFinite(createdAt) && createdAt >= 0
    ? Math.max(1, Math.floor((now - createdAt) / 86400000) + 1) : 1;
}
