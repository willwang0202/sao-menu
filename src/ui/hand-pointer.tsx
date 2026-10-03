import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../shared/bridge';
import type { HandCursor, HandTrackingStatus, Position } from '../shared/contracts';
import './hand-pointer.css';

/** After this long without a hand sample, the mouse stream owns hover again. */
const HAND_POINTER_TIMEOUT_MS = 600;
const STATUS_REFRESH_MS = 2000;
const CLICKABLE = 'button, a[href], [role="menuitem"], [role="button"], [data-hover-id]';

export interface HandPointer {
  reticle: HandCursor | null;
  clicks: number;
  /** False for unchanged mouse samples while the hand is steering, so the two inputs don't fight. */
  acceptsMouse(point: Position): boolean;
}

/** Routes webcam hand events into the overlay's existing hover and click paths. */
export function useHandPointer(
  lastPointer: RefObject<Position | null>,
  evaluatePointer: RefObject<() => void>,
  setCursor: (point: Position) => void,
): HandPointer {
  const [reticle, setReticle] = useState<HandCursor | null>(null);
  const [clicks, setClicks] = useState(0);
  const handActiveUntil = useRef(0);
  const lastMouse = useRef<Position | null>(null);

  const acceptsMouse = useCallback((point: Position) => {
    const isUnchanged = lastMouse.current?.x === point.x && lastMouse.current.y === point.y;
    lastMouse.current = point;
    if (isUnchanged && performance.now() < handActiveUntil.current) return false;
    if (!isUnchanged) handActiveUntil.current = 0;
    return true;
  }, []);

  useEffect(() => {
    const detachCursor = api.onHandCursor(cursor => {
      if (!cursor.visible) { handActiveUntil.current = 0; setReticle(null); return; }
      handActiveUntil.current = performance.now() + HAND_POINTER_TIMEOUT_MS;
      const point = { x: cursor.x, y: cursor.y };
      lastPointer.current = point;
      setCursor(point);
      setReticle(cursor);
      evaluatePointer.current();
    });
    const detachClick = api.onHandClick(point => {
      setClicks(count => count + 1);
      const target = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>(CLICKABLE);
      if (target && !target.closest('.dismissing')) target.click();
    });
    return () => { detachCursor(); detachClick(); };
  }, [lastPointer, evaluatePointer, setCursor]);

  return { reticle, clicks, acceptsMouse };
}

export function HandReticle({ pointer }: { pointer: HandPointer }) {
  if (!pointer.reticle) return null;
  return (
    <div className="hand-reticle" style={{ left: pointer.reticle.x, top: pointer.reticle.y }} aria-hidden="true">
      <span key={pointer.clicks} className={pointer.clicks ? 'hand-reticle-pulse' : ''} />
    </div>
  );
}

/** Live camera status for the preferences dialog. */
export function HandTrackingStatusLine({ isDesktop, isEnabled }: { isDesktop: boolean; isEnabled: boolean }) {
  const [status, setStatus] = useState<HandTrackingStatus | null>(null);
  useEffect(() => {
    let isActive = true;
    const refresh = () => {
      api.getHandTrackingStatus()
        .then(next => { if (isActive) setStatus(next); })
        .catch(error => { if (isActive) setStatus({ supported: false, enabled: false, permission: 'unknown', running: false, message: String(error?.message ?? error) }); });
    };
    refresh();
    const timer = isDesktop ? setInterval(refresh, STATUS_REFRESH_MS) : null;
    return () => { isActive = false; if (timer) clearInterval(timer); };
  }, [isDesktop, isEnabled]);
  const label = status?.running ? 'Camera tracking active' : status?.permission === 'denied' ? 'Camera permission required' : isEnabled ? 'Camera starting or unavailable' : 'Camera off';
  return <>
    <div className="gesture-status"><span className={status?.running ? 'ready-dot' : ''} />{label}</div>
    <p className="preference-description">{status?.message ?? 'Checking camera status…'}</p>
  </>;
}
