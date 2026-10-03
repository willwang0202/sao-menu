import React, { useEffect, useRef, useState } from 'react';
import type { Settings } from '../shared/contracts';
import type { SocialState } from '../shared/social';
import { clockTime, followAudio, holdClock, resumeClock, shouldResyncAudio, startClock, type StartupClock } from './link-start/clock';
import { renderFrame, type FrameOptions } from './link-start/render';
import { STARTUP, sceneAt } from './link-start/timeline';
import './startup.css';

type Phase = 'playing' | 'login' | 'entering';
/** Start silently if the audio track has not begun by then; the dark opening hides the wait. */
const AUDIO_START_TIMEOUT_MS = 1000;
const AUDIO_VOLUME = 0.55;
const MAX_PIXEL_RATIO = 2;

/**
 * Real-time Link Start: every display refresh renders a unique frame of the procedural
 * reconstruction, timed by a clock the original voice/SFX track follows.
 */
export function LinkStart({ settings, onComplete }: { settings: Settings; onComplete: () => void }) {
  const reduced = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<Phase>(reduced ? 'login' : 'playing');
  const [state, setState] = useState<SocialState | null>(null);
  const [audioError, setAudioError] = useState('');
  const [serviceError, setServiceError] = useState('');
  const section = useRef<HTMLElement>(null), canvas = useRef<HTMLCanvasElement>(null), audio = useRef<HTMLAudioElement>(null);
  const clock = useRef<StartupClock | null>(reduced ? holdClock(startClock(0), STARTUP.loginHold) : null);
  const currentPhase = useRef(phase), credentials = useRef<FrameOptions>({ accountLength: 0, passwordLength: 0 });
  const completed = useRef(false), done = useRef(onComplete); done.current = onComplete;
  const changePhase = (next: Phase) => { currentPhase.current = next; setPhase(next); };
  const complete = () => {
    if (completed.current) return;
    completed.current = true; audio.current?.pause(); done.current();
  };
  const holdLogin = () => {
    if (currentPhase.current !== 'playing') return;
    clock.current = holdClock(clock.current ?? startClock(performance.now()), STARTUP.loginHold);
    audio.current?.pause();
    changePhase('login');
  };
  const enter = (lengths: FrameOptions) => {
    if (currentPhase.current === 'entering') return;
    if (reduced) { complete(); return; }
    credentials.current = lengths;
    clock.current = resumeClock(clock.current!, performance.now(), STARTUP.loginResume);
    const track = audio.current;
    if (track && settings.sound) { track.currentTime = STARTUP.loginResume; void track.play().catch(() => setAudioError('blocked')); }
    changePhase('entering');
  };

  useEffect(() => {
    const api = window.saoSocial;
    if (!api) return;
    let active = true;
    const detach = api.onState(next => { if (active) setState(next); });
    void api.getState().then(next => { if (active) setState(next); }).catch(e => { if (active) setServiceError(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; detach(); };
  }, []);

  useEffect(() => {
    const track = audio.current!;
    track.volume = AUDIO_VOLUME;
    if (reduced) return;
    const begin = () => { if (!clock.current) clock.current = startClock(performance.now(), track.currentTime); };
    const timeout = window.setTimeout(begin, settings.sound ? AUDIO_START_TIMEOUT_MS : 0);
    track.addEventListener('playing', begin, { once: true });
    if (settings.sound) void track.play().catch(() => { setAudioError('blocked'); begin(); });
    return () => { window.clearTimeout(timeout); track.removeEventListener('playing', begin); track.pause(); };
  }, []);

  useEffect(() => {
    const view = canvas.current!, ctx = view.getContext('2d', { alpha: false })!;
    let frame = 0, scene = '';
    const resize = () => {
      const ratio = Math.min(MAX_PIXEL_RATIO, devicePixelRatio || 1);
      view.width = Math.round(innerWidth * ratio); view.height = Math.round(innerHeight * ratio);
    };
    const tick = (now: number) => {
      if (currentPhase.current === 'playing' && clock.current && clockTime(clock.current, now) >= STARTUP.loginHold) holdLogin();
      const track = audio.current;
      if (clock.current && track && !track.paused && !track.seeking) {
        // Large drift re-seeks the audio; small offsets ease the picture onto the voice.
        if (shouldResyncAudio(track.currentTime, clockTime(clock.current, now))) track.currentTime = clockTime(clock.current, now);
        else clock.current = followAudio(clock.current, now, track.currentTime);
      }
      const time = clock.current ? clockTime(clock.current, now) : 0;
      if (time >= STARTUP.end) { complete(); return; }
      renderFrame(ctx, time, view.width, view.height, credentials.current);
      const next = sceneAt(time);
      if (next !== scene && section.current) { scene = next; section.current.dataset.scene = next; }
      frame = requestAnimationFrame(tick);
    };
    resize();
    addEventListener('resize', resize);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); removeEventListener('resize', resize); };
  }, []);

  useEffect(() => { if (phase === 'login' && state?.snapshot) enter(credentials.current); }, [phase, state?.snapshot]);
  const skip = () => { if (currentPhase.current === 'entering') complete(); else holdLogin(); };
  return <section ref={section} className="link-start" data-phase={phase} data-audio={audioError || undefined} aria-label="Link Start" onKeyDown={event => {
    event.stopPropagation(); if (event.key === 'Escape' && phase !== 'login') skip();
  }}>
    <canvas ref={canvas} className="startup-canvas" role="img" aria-label="Link Start animation" />
    <audio ref={audio} src="./startup/link-start.m4a" preload="auto" />
    {phase === 'login' && !state?.snapshot && <StartupLogin state={state} initialError={serviceError} onAuthenticated={enter} onOffline={complete} />}
    {phase !== 'login' && <button className="skip-intro" onClick={skip}>Skip intro</button>}
  </section>;
}

function StartupLogin({ state, initialError, onAuthenticated, onOffline }: { state: SocialState | null; initialError: string; onAuthenticated: (lengths: FrameOptions) => void; onOffline: () => void }) {
  const [account, setAccount] = useState(''), [password, setPassword] = useState(''), [service, setService] = useState(state?.serviceURL ?? '');
  const [configure, setConfigure] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(initialError);
  useEffect(() => { if (state?.serviceURL) setService(state.serviceURL); }, [state?.serviceURL]);
  return <div className="startup-login-scene">
    <form id="sao-account-login" className="anime-login" aria-label="SAO account login" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      if (!window.saoSocial || !service) { setConfigure(true); setError('Set your account service, or continue offline.'); return; }
      setBusy(true); setError('');
      try {
        await window.saoSocial.authenticate({ serviceURL: service, username: account, password, register: false, displayName: '' });
        const lengths = { accountLength: account.length, passwordLength: password.length };
        setPassword(''); onAuthenticated(lengths);
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
    }}>
      <h1 className="startup-accessible">Log in_::</h1>
      <input className="anime-account" aria-label="Account" value={account} onChange={e => setAccount(e.target.value)} required maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} />
      <input className="anime-password" aria-label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} autoComplete="current-password" />
    </form>
    <div className="startup-login-tools">
      <div className="startup-login-actions"><button form="sao-account-login" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button><button onClick={onOffline}>Continue offline</button><button onClick={() => setConfigure(!configure)}>Account service</button></div>
      {configure && <label className="startup-service">Account service<input aria-label="Startup account service" type="url" value={service} onChange={e => setService(e.target.value)} placeholder="https://…" spellCheck={false} autoCapitalize="none" /></label>}
      {error && <p className="startup-login-error" role="alert">{error}</p>}
    </div>
  </div>;
}
