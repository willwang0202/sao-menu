'use client';

import { useEffect, useRef, useState } from 'react';
import { renderFrame } from '../../../src/ui/link-start/render';

/** The desktop app's Link Start tunnel, from the far cluster to the empty room. */
const TUNNEL_FROM = 1.9;
const TUNNEL_TO = 5.08;
const MAX_PIXEL_RATIO = 2;
const NO_CREDENTIALS = { accountLength: 0, passwordLength: 0 };

export function LinkStartHero({ children }: { children: React.ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const view = canvas.current!;
    const ctx = view.getContext('2d', { alpha: false })!;
    const resize = () => {
      const ratio = Math.min(MAX_PIXEL_RATIO, devicePixelRatio || 1);
      view.width = Math.round(view.clientWidth * ratio);
      view.height = Math.round(view.clientHeight * ratio);
    };
    resize();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      renderFrame(ctx, TUNNEL_TO, view.width, view.height, NO_CREDENTIALS);
      setFinished(true);
      return;
    }
    setFinished(false);
    let frame = 0, start = 0;
    const tick = (now: number) => {
      start ||= now;
      const t = Math.min(TUNNEL_TO, TUNNEL_FROM + (now - start) / 1000);
      renderFrame(ctx, t, view.width, view.height, NO_CREDENTIALS);
      if (t < TUNNEL_TO) frame = requestAnimationFrame(tick);
      else setFinished(true);
    };
    frame = requestAnimationFrame(tick);
    const redraw = () => { resize(); renderFrame(ctx, TUNNEL_TO, view.width, view.height, NO_CREDENTIALS); };
    addEventListener('resize', redraw);
    return () => { cancelAnimationFrame(frame); removeEventListener('resize', redraw); };
  }, [run]);

  return (
    <section className="hero" data-finished={finished} aria-labelledby="hero-title">
      <canvas ref={canvas} className="hero-canvas" aria-hidden="true" />
      <div className="hero-content">{children}</div>
      <button type="button" className="hero-replay" onClick={() => setRun(value => value + 1)} disabled={!finished}>Replay Link Start</button>
    </section>
  );
}
