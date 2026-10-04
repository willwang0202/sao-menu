import React, { useEffect, useRef, useState } from 'react';
import { hpBattery, hpHeight, type HpState } from '../shared/hud';
import './hud.css';
const IMAGE = './sao-original/Images/etc/';
export function HpHudWindow() {
  const [state, setState] = useState<HpState>({ playerName: 'Kirito', reducedMotion: false, stats: null, partyMembers: [] });
  useEffect(() => { const api = window.saoHP!; const detach = api.onState(setState); void api.getState().then(setState); return detach; }, []);
  return <HpHud state={state} />;
}
export function HpHud({ state }: { state: HpState }) {
  const percent = hpBattery(state.stats?.batteryPercent), progress = percent / 100, motion = !state.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const current = useCount(percent, motion);
  return <aside className={`hp-display ${motion ? '' : 'hp-still'}`} style={{ height: hpHeight(state.partyMembers.length) }} aria-label="SAO HP display">
    <div className="hp-main" data-battery-percent={percent} aria-label={`${state.playerName}: battery ${percent}%`}>
      <div className="hp-main-mask"><img className="hp-fill" src={IMAGE + `hp-bar-${color(progress)}.png`} style={{ transform: `translateX(${Math.round((progress - 1) * 258)}px)` }} alt="" /></div>
      <img className="hp-art" src={IMAGE + 'hp-main.png'} alt="" />
      <span className="hp-name" title={state.playerName}>{state.playerName}</span><span className="hp-number">{current} / 100</span><span className="hp-level">LV: --</span>
      <img className="hp-icon" src="./sao-original/WidgetIcons/SAO.png" alt="" />
    </div>
    {state.partyMembers.map((member, index) => {
      const battery = hpBattery(member.batteryPercent), fill = battery / 100;
      return <div className="hp-extra" key={member.id} style={{ top: 47 + index * 42 }} data-party-member={member.id} data-battery-percent={battery} aria-label={`${member.displayName}: battery ${battery}%, ${member.online ? 'online' : 'offline'}`}>
        <div className="hp-extra-mask"><img className="hp-fill" src={IMAGE + `hp-extra-bar-${color(fill)}.png`} style={{ transform: `translateX(${Math.round((fill - 1) * 125) - 3}px)` }} alt="" /></div>
        <img className="hp-art" src={IMAGE + 'hp-extra.png'} alt="" /><span className="hp-extra-name" title={member.displayName}>{member.displayName}</span>
      </div>;
    })}
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
