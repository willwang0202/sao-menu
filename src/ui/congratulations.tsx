import { useEffect } from 'react';
import { themeSound, type ThemeId } from '../shared/themes';
import type { Celebration } from '../shared/widgets';
import { ART_SIZE, BAR_POINTS, WORDMARK_PATH } from './congratulations-art';
import './congratulations.css';
const SOUND = './sao-original/Sounds/';
const SOUND_VOLUME = .4;

/** Congratulations!! banner played once after the operating system updates. */
export function CongratulationsBanner({ celebration, reducedMotion, sound, theme }: { celebration: Celebration | null; reducedMotion: boolean; sound: boolean; theme: ThemeId }) {
  useEffect(() => {
    if (!celebration || !sound) return;
    const track = new Audio(SOUND + themeSound(theme, 'congratulations'));
    track.volume = SOUND_VOLUME;
    void track.play().catch(() => { /* The banner still shows when audio is unavailable. */ });
    return () => track.pause();
  }, [celebration?.id]); // Play once per banner run.
  if (!celebration) return null;
  return <div key={celebration.id} className={`sao-congratulations ${reducedMotion ? 'reduced' : ''}`} role="status" aria-label={`Congratulations!! System update: ${celebration.label}`}>
    <svg className="congratulations-art" viewBox={`0 0 ${ART_SIZE.width} ${ART_SIZE.height}`} aria-hidden="true">
      <path className="congratulations-wordmark" d={WORDMARK_PATH} />
      <polygon className="congratulations-bar" points={BAR_POINTS} />
    </svg>
    <div className="congratulations-caption" aria-hidden="true"><span>System Update</span><span>{celebration.label}</span></div>
  </div>;
}
