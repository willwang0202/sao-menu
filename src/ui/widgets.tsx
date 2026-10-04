import React, { useEffect, useState } from 'react';
import { CLOCK_SAMPLE_MS, clockAngles, clockText, type WidgetState } from '../shared/widgets';
import './widgets.css';
const IMAGE = './sao-original/Images/';
const MAX_BADGE = 99;

function useWidgetState(): WidgetState {
  const [state, setState] = useState<WidgetState>({ unread: 0, reducedMotion: false });
  useEffect(() => { const api = window.saoWidget; if (!api) return; const detach = api.onState(setState); void api.getState().then(setState).catch(() => {}); return detach; }, []);
  return state;
}

/** Original SAO clock preset: analog hour/minute meters plus embossed %H:%M text, sampled every 5 s. */
export function ClockWidget({ now: fixed }: { now?: Date }) {
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => { if (fixed) return; const timer = setInterval(() => setNow(new Date()), CLOCK_SAMPLE_MS); return () => clearInterval(timer); }, [fixed]);
  const angles = clockAngles(now), text = clockText(now);
  return <div className="sao-clock" role="timer" aria-label={`Time ${text}`}>
    <img className="clock-hand clock-hour" src={IMAGE + 'etc/clock-h.png'} style={{ transform: `rotate(${angles.hour}deg)` }} alt="" />
    <img className="clock-hand clock-minute" src={IMAGE + 'etc/clock-m.png'} style={{ transform: `rotate(${angles.minute}deg)` }} alt="" />
    <span className="clock-text clock-highlight" aria-hidden="true">{text}</span><span className="clock-text">{text}</span>
  </div>;
}

/** Original `widget-mail` button; opens the launcher's Message category. */
export function MessageButton({ unread, onOpen }: { unread: number; onOpen: () => void }) {
  const label = unread ? `Messages, ${unread} unread` : 'Messages';
  return <button type="button" className={`sao-message-button ${unread ? 'has-unread' : ''}`} aria-label={label} title={label} onClick={onOpen}>
    {unread > 0 && <span className="message-badge" aria-hidden="true">{unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}</span>}
  </button>;
}

export function DesktopWidgetWindow({ kind }: { kind: string }) {
  const state = useWidgetState();
  useEffect(() => { document.documentElement.classList.add('widget-window'); }, []);
  if (kind === 'clock') return <ClockWidget />;
  return <MessageButton unread={state.unread} onOpen={() => { void window.saoWidget?.openMessages().catch(() => {}); }} />;
}
