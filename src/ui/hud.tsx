import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hpBattery, hpHeight, hpNameWidth, hpWidgetWidth, hpLevel, type HpState } from '../shared/hud';
import { AloHud } from './hud-alo';
import './hud.css';
const IMAGE = './sao-original/Images/etc/';
export function HpHudWindow() {
  const [state, setState] = useState<HpState>({ theme: 'sao', playerName: 'Kirito', reducedMotion: false, stats: null, partyMembers: [] });
  useEffect(() => { const api = window.saoHP!; const detach = api.onState(setState); void api.getState().then(setState); return detach; }, []);
  return <HpHud state={state} onWidth={width => { void window.saoHP!.setWidth(width).catch(() => {}); }} />;
}
type HudProps = { state: HpState; onWidth?: (width: number) => void };
export const HpHud = (props: HudProps) => props.state.theme === 'alo' ? <AloHud {...props} /> : <SaoHud {...props} />;
function SaoHud({ state, onWidth }: HudProps) {
  const element = useRef<HTMLElement>(null);
  const [textWidths, setTextWidths] = useState<number[]>([]);
  const names = JSON.stringify([state.playerName, ...state.partyMembers.map(member => member.displayName)]);
  useLayoutEffect(() => {
    let active = true;
    const labels = [...(element.current?.querySelectorAll<HTMLElement>('.hp-name-text') ?? [])];
    const measure = () => {
      if (!active) return;
      const next = labels.map(label => label.getBoundingClientRect().width);
      setTextWidths(previous => previous.length === next.length && previous.every((width, index) => width === next[index]) ? previous : next);
    };
    const observer = new ResizeObserver(measure); labels.forEach(label => observer.observe(label));
    measure(); void document.fonts.ready.then(measure);
    return () => { active = false; observer.disconnect(); };
  }, [names]);
  const width = hpWidgetWidth(textWidths);
  useEffect(() => { onWidth?.(width); }, [width]);
  const extension = (index: number) => ({ '--hp-name-extension': `${hpNameWidth(textWidths[index] ?? 0) - 40}px` } as React.CSSProperties);
  const percent = hpBattery(state.stats?.batteryPercent), progress = percent / 100, motion = !state.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const current = useCount(percent, motion);
  return <aside ref={element} className={`hp-display ${motion ? '' : 'hp-still'}`} style={{ width, height: hpHeight(state.partyMembers.length) }} aria-label="SAO HP display">
    <div className="hp-main" style={extension(0)} data-battery-percent={percent} aria-label={`${state.playerName}: battery ${percent}%`}>
      <div className="hp-main-mask"><img className="hp-fill" src={IMAGE + `hp-bar-${color(progress)}.png`} style={{ transform: `translateX(${Math.round((progress - 1) * 258)}px)` }} alt="" /></div>
      <div className="hp-art hp-main-art" aria-hidden="true" />
      <span className="hp-name" title={state.playerName}><span className="hp-name-text">{state.playerName}</span></span><span className="hp-number">{current} / 100</span><span className="hp-level" title="Account age in days">LV: {hpLevel(state.accountCreatedAt)}</span>
      <img className="hp-icon" src="./sao-original/WidgetIcons/SAO.png" alt="" />
    </div>
    {state.partyMembers.map((member, index) => {
      const battery = hpBattery(member.batteryPercent), fill = battery / 100;
      return <div className="hp-extra" key={member.id} style={{ top: 47 + index * 42, ...extension(index + 1) }} data-party-member={member.id} data-battery-percent={battery} aria-label={`${member.displayName}: battery ${battery}%, ${member.online ? 'online' : 'offline'}`}>
        <div className="hp-extra-mask"><img className="hp-fill" src={IMAGE + `hp-extra-bar-${color(fill)}.png`} style={{ transform: `translateX(${Math.round((fill - 1) * 125) - 3}px)` }} alt="" /></div>
        <div className="hp-art hp-extra-art" aria-hidden="true" /><span className="hp-extra-name" title={member.displayName}><span className="hp-name-text">{member.displayName}</span></span>
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
