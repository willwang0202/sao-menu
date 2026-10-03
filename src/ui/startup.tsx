import React, { useEffect, useRef, useState } from 'react';
import type { Settings } from '../shared/contracts';
import type { SocialState } from '../shared/social';
import './startup.css';

const LOGIN_HOLD = 10.635;
const ENTRY_START = 12.85;
type Phase = 'tunnel' | 'sensors' | 'login' | 'entering';

/** The selected source supplies the voice, animation, login transition and SFX. */
export function LinkStart({ settings, onComplete }: { settings: Settings; onComplete: () => void }) {
  const reduced = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<Phase>(reduced ? 'login' : 'tunnel');
  const [state, setState] = useState<SocialState | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const held = useRef(reduced), currentPhase = useRef(phase);
  const done = useRef(onComplete); done.current = onComplete;
  const changePhase = (next: Phase) => { currentPhase.current = next; setPhase(next); };
  const holdLogin = () => {
    held.current = true;
    const movie = video.current;
    movie?.pause();
    if (movie && movie.readyState >= 1) movie.currentTime = LOGIN_HOLD;
    changePhase('login'); setBlocked(false);
  };
  const enter = () => {
    if (currentPhase.current === 'entering') return;
    if (reduced || error || !video.current) { done.current(); return; }
    changePhase('entering'); video.current.currentTime = ENTRY_START;
    void video.current.play().catch(() => done.current());
  };
  useEffect(() => {
    const api = window.saoSocial;
    if (!api) return;
    let active = true;
    const detach = api.onState(next => { if (active) setState(next); });
    void api.getState().then(next => { if (active) setState(next); }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; detach(); };
  }, []);
  useEffect(() => {
    const movie = video.current!; movie.volume = .55;
    if (!reduced) void movie.play().catch(() => setBlocked(true));
    let callback = 0, active = true;
    const advance = (_time: number, frame: VideoFrameCallbackMetadata) => {
      if (!active) return;
      if (!held.current && frame.mediaTime >= LOGIN_HOLD) holdLogin();
      else if (currentPhase.current === 'tunnel' && frame.mediaTime >= 4) changePhase('sensors');
      callback = movie.requestVideoFrameCallback(advance);
    };
    if (movie.requestVideoFrameCallback) callback = movie.requestVideoFrameCallback(advance);
    return () => { active = false; movie.pause(); if (callback) movie.cancelVideoFrameCallback(callback); };
  }, []);
  useEffect(() => { if (phase === 'login' && state?.snapshot) enter(); }, [phase, state?.snapshot]);
  return <section className="link-start" data-phase={phase} aria-label="Link Start" onKeyDown={event => {
    event.stopPropagation(); if (event.key === 'Escape' && phase !== 'login') { if (phase === 'entering') onComplete(); else holdLogin(); }
  }}>
    <div className="startup-film-plane">
      <video ref={video} className="startup-film" src="./startup/link-start.mp4" playsInline muted={!settings.sound} preload="auto" aria-label="Original anime Link Start and login animation"
        onLoadedMetadata={() => { if (held.current) holdLogin(); }}
        onPlaying={() => setBlocked(false)}
        onTimeUpdate={event => { if (!event.currentTarget.requestVideoFrameCallback && !held.current && event.currentTarget.currentTime >= LOGIN_HOLD) holdLogin(); }}
        onEnded={onComplete} onError={() => { setError('The startup movie could not be played.'); changePhase('login'); }} />
      {phase === 'login' && !state?.snapshot && <StartupLogin state={state} error={error} onAuthenticated={enter} onOffline={onComplete} />}
    </div>
    {blocked && <button className="start-intro" onClick={() => { void video.current?.play().catch(() => setError('The startup movie could not be played.')); }}>Start Link Start</button>}
    {phase !== 'login' && <button className="skip-intro" onClick={() => { if (phase === 'entering') onComplete(); else holdLogin(); }}>Skip intro</button>}
  </section>;
}

function StartupLogin({ state, error: initialError, onAuthenticated, onOffline }: { state: SocialState | null; error: string; onAuthenticated: () => void; onOffline: () => void }) {
  const [account, setAccount] = useState(''), [password, setPassword] = useState(''), [service, setService] = useState(state?.serviceURL ?? '');
  const [configure, setConfigure] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(initialError);
  useEffect(() => { if (state?.serviceURL) setService(state.serviceURL); }, [state?.serviceURL]);
  return <div className="startup-login-scene">
    <form id="sao-account-login" className="anime-login" aria-label="SAO account login" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      if (!window.saoSocial || !service) { setConfigure(true); setError('Set your account service, or continue offline.'); return; }
      setBusy(true); setError('');
      try { await window.saoSocial.authenticate({ serviceURL: service, username: account, password, register: false, displayName: '' }); setPassword(''); onAuthenticated(); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
    }}>
      <h1 className="startup-accessible">Log in_::</h1>
      <input className="anime-account" aria-label="Account" value={account} onChange={e => setAccount(e.target.value)} required maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} />
      <input className="anime-password" aria-label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} autoComplete="current-password" />
    </form>
    <div className="startup-login-actions"><button form="sao-account-login" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button><button onClick={onOffline}>Continue offline</button><button onClick={() => setConfigure(!configure)}>Account service</button></div>
    {configure && <label className="startup-service">Account service<input aria-label="Startup account service" type="url" value={service} onChange={e => setService(e.target.value)} placeholder="https://…" spellCheck={false} autoCapitalize="none" /></label>}
    {error && <p className="startup-login-error" role="alert">{error}</p>}
  </div>;
}
