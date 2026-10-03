import React, { useEffect, useRef, useState } from 'react';
import { hpProgress, type HpState } from '../shared/hud';
import './hud.css';
const IMAGE = './sao-original/Images/etc/';
export function HpHudWindow() {
  const [state, setState] = useState<HpState>({ playerName: 'Kirito', reducedMotion: false, stats: null });
  useEffect(() => { const api = window.saoHP!; const detach = api.onState(setState); void api.getState().then(setState); return detach; }, []);
  return <HpHud state={state} />;
}
export function HpHud({ state }: { state: HpState }) {
  const progress = hpProgress(state.stats), motion = !state.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const current = useCount(progress.cpu === null ? null : Math.round(progress.cpu * 250), motion);
  return <aside className={`hp-display ${motion ? '' : 'hp-still'}`} aria-label="SAO HP display">
    <div className="hp-main" data-cpu-progress={progress.cpu ?? 'unknown'} aria-label={`${state.playerName}: CPU headroom`}>
      <div className="hp-main-mask"><img className="hp-fill" src={IMAGE + `hp-bar-${color(progress.cpu)}.png`} style={{ transform: `translateX(${Math.round(((progress.cpu ?? 0) - 1) * 258)}px)` }} alt="" /></div>
      <img className="hp-art" src={IMAGE + 'hp-main.png'} alt="" />
      <span className="hp-name">{state.playerName}</span><span className="hp-number">{current === null ? '--' : current} / 250</span><span className="hp-level">LV: --</span>
      <img className="hp-icon" src="./sao-original/WidgetIcons/SAO.png" alt="" />
    </div>
    <div className="hp-extra" data-ram-progress={progress.ram ?? 'unknown'} aria-label="Asuna: RAM headroom">
      <div className="hp-extra-mask"><img className="hp-fill" src={IMAGE + `hp-extra-bar-${color(progress.ram)}.png`} style={{ transform: `translateX(${Math.round(((progress.ram ?? 0) - 1) * 125) - 3}px)` }} alt="" /></div>
      <img className="hp-art" src={IMAGE + 'hp-extra.png'} alt="" /><span className="hp-extra-name">Asuna</span>
    </div>
  </aside>;
}
const color = (value: number | null) => value !== null && value <= .25 ? 'red' : value !== null && value <= .5 ? 'yellow' : 'green';
function useCount(target: number | null, motion: boolean) {
  const value = useRef<number | null>(null), [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (target === null || value.current === null || !motion) { value.current = target; setShown(target); return; }
    const from = value.current, start = performance.now(); let frame = 0;
    const tick = (time: number) => { const progress = Math.min(1, (time - start) / 500); value.current = from + (target - from) * progress; setShown(Math.round(value.current)); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [target, motion]); return shown;
}
