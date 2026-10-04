import type { Settings, SystemStats } from './contracts';
import type { PartyMember, SocialSnapshot } from './social';
export interface HpState { playerName: string; reducedMotion: boolean; stats: SystemStats | null; partyMembers: PartyMember[] }
export interface HpAPI { getState(): Promise<HpState>; onState(callback: (state: HpState) => void): () => void }
/** Machines without battery telemetry have a full bar. */
export function hpBattery(percent: number | null | undefined): number {
  return typeof percent === 'number' && Number.isFinite(percent) ? Math.round(Math.max(0, Math.min(100, percent))) : 100;
}
export function hpState(settings: Pick<Settings, 'playerName' | 'reducedMotion'>, stats: SystemStats | null, snapshot: SocialSnapshot | null): HpState {
  const partyMembers = snapshot?.party?.members.some(member => member.id === snapshot.profile.id)
    ? snapshot.party.members.filter(member => member.id !== snapshot.profile.id).slice(0, 5) : [];
  return { playerName: snapshot?.profile.displayName ?? settings.playerName, reducedMotion: settings.reducedMotion, stats, partyMembers };
}
export const hpHeight = (companions: number) => companions > 0 ? 47 + Math.min(5, companions) * 42 : 62;
declare global { interface Window { saoHP?: HpAPI } }
