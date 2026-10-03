import React, { useEffect, useRef, useState } from 'react';
import type { Settings } from '../shared/contracts';
import type { SocialState } from '../shared/social';
import './startup.css';

/** Local source footage preserves the exact reference frames and original SFX. */
export function LinkStart({ settings, onComplete }: { settings: Settings; onComplete: () => void }) {
  const reduced = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'tunnel' | 'sensors' | 'login'>(reduced ? 'login' : 'tunnel');
  const [state, setState] = useState<SocialState | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const voice = useRef<HTMLAudioElement | null>(null);
  const voiced = useRef(false);
  const done = useRef(onComplete); done.current = onComplete;
  const sayLinkStart = () => {
    if (!settings.sound || voiced.current || !voice.current) return;
    voiced.current = true; void voice.current.play().catch(() => {});
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
    const track = new Audio('./sao-original/Sounds/LinkStart.SAO.Kirito.wav'); track.volume = .55; voice.current = track;
    const movie = video.current;
    if (movie) {
      movie.volume = .55;
      void movie.play().then(() => { sayLinkStart(); }).catch(() => setBlocked(true));
    } else sayLinkStart();
    return () => { movie?.pause(); track.pause(); track.src = ''; voice.current = null; };
  }, []);
  useEffect(() => { if (phase === 'login' && state?.snapshot) done.current(); }, [phase, state?.snapshot]);
  const skip = () => { video.current?.pause(); voice.current?.pause(); setPhase('login'); };
  return <section className="link-start" data-phase={phase} aria-label="Link Start" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && phase !== 'login') skip(); }}>
    {phase !== 'login' && <video ref={video} className="startup-film" src="./startup/link-start.webm" playsInline muted={!settings.sound} preload="auto" aria-label="Original Integral Factor Link Start animation" onPlaying={() => { setBlocked(false); sayLinkStart(); }} onTimeUpdate={event => { if (event.currentTarget.currentTime >= 3.6) setPhase('sensors'); }} onEnded={() => setPhase('login')} onError={() => { setError('The startup movie could not be played.'); setPhase('login'); }} />}
    {blocked && <button className="start-intro" onClick={() => { sayLinkStart(); void video.current?.play().catch(() => setError('The startup movie could not be played.')); }}>Start Link Start</button>}
    {phase === 'login' && !state?.snapshot && <StartupLogin state={state} error={error} onComplete={onComplete} />}
    {phase !== 'login' && <button className="skip-intro" onClick={skip}>Skip intro</button>}
  </section>;
}

function StartupLogin({ state, error: initialError, onComplete }: { state: SocialState | null; error: string; onComplete: () => void }) {
  const [account, setAccount] = useState(''), [password, setPassword] = useState(''), [service, setService] = useState(state?.serviceURL ?? '');
  const [configure, setConfigure] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(initialError);
  useEffect(() => { if (state?.serviceURL) setService(state.serviceURL); }, [state?.serviceURL]);
  return <div className="startup-login-scene">
    <div className="login-art">
      <img className="login-reference-rings" src="./startup/login-reference.png" alt="" />
      <img className="login-reference-panel" src="./startup/login-reference.png" alt="" />
      <form id="sao-account-login" className="anime-login" aria-label="SAO account login" onSubmit={async event => {
        event.preventDefault(); if (busy) return;
        if (!window.saoSocial || !service) { setConfigure(true); setError('Set your account service, or continue offline.'); return; }
        setBusy(true); setError('');
        try { await window.saoSocial.authenticate({ serviceURL: service, username: account, password, register: false, displayName: '' }); setPassword(''); onComplete(); }
        catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
      }}>
        <h1 className="startup-accessible">Log in_::</h1>
        <input className="anime-account" aria-label="Account" value={account} onChange={e => setAccount(e.target.value)} required maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} />
        <input className="anime-password" aria-label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} autoComplete="current-password" />
      </form>
    </div>
    <div className="startup-login-actions"><button form="sao-account-login" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button><button onClick={onComplete}>Continue offline</button><button onClick={() => setConfigure(!configure)}>Account service</button></div>
    {configure && <label className="startup-service">Account service<input aria-label="Startup account service" type="url" value={service} onChange={e => setService(e.target.value)} placeholder="https://…" spellCheck={false} autoCapitalize="none" /></label>}
    {error && <p className="startup-login-error" role="alert">{error}</p>}
  </div>;
}
