/** GGO launcher pieces with no SAO counterpart: rail tray, submenu tray and side panel. */
import React, { useEffect, useState } from 'react';
import type { MenuEntry } from '../shared/contracts';
import { GGO_IMAGES, themeImageSources } from '../shared/theme-icons';
import './ggo.css';

// PanelView.qml: indicator centre = button centre; indicator 20x32 starts at shadowPadding 18.
const PANEL_TOP_OFFSET = 34;
const PANEL_SHADOW_PADDING = 18;
const PANEL_INDICATOR_HALF = 16;
const BUTTON_HALF_HEIGHT = 39;
// Label/image appear once the 200 ms delay, 600 ms unfold and 400 ms bar growth finish.
const PANEL_CONTENT_DELAY = 1200;
const CONTENT_FADE = 250;

/** PanelBarL/PanelBarS positions and target widths from PanelView.qml. */
const PANEL_BARS: { size: 'l' | 's'; x: number; y: number; width: number }[] = [
  { size: 'l', x: 217, y: 27, width: 190 }, { size: 'l', x: 217, y: 45, width: 60 },
  { size: 's', x: 218, y: 186, width: 54 }, { size: 's', x: 218, y: 191, width: 40 },
  { size: 's', x: 218, y: 244, width: 28 }, { size: 's', x: 218, y: 249, width: 22 },
  { size: 's', x: 218, y: 302, width: 54 }, { size: 's', x: 218, y: 307, width: 28 },
  { size: 's', x: 218, y: 351, width: 40 }, { size: 's', x: 306, y: 307, width: 28 },
];

/** MainView.qml tray: a white silhouette wipes in, then crossfades into btn-tray.png. */
export function GgoRailTray({ left, top, openDelay }: { left: number; top: number; openDelay: number }) {
  return <div className="ggo-rail" style={{ left, top, '--ggo-open-delay': `${openDelay}ms` } as React.CSSProperties} aria-hidden="true">
    <div className="ggo-rail-tray" />
    <div className="ggo-rail-flash"><div className="ggo-rail-wipe" /></div>
  </div>;
}

/** MenuView.qml item-tray.png border image with the left indicator and shadow edge. */
export function GgoMenuTray() {
  return <div className="ggo-menu-tray" aria-hidden="true"><span className="ggo-menu-frame" /><span className="ggo-menu-edge"><i /><b /><i /></span></div>;
}

function FallbackImage({ sources, className }: { sources: string[]; className: string }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [sources.join('\n')]);
  return <img className={className} src={sources[Math.min(attempt, sources.length - 1)]} alt="" draggable="false" onError={() => setAttempt(value => value + 1)} />;
}

/** Indicator top inside the panel for a root button top inside the rail. */
export const ggoPanelIndicatorTop = (rootButtonTop: number) => rootButtonTop + BUTTON_HALF_HEIGHT - PANEL_TOP_OFFSET - PANEL_INDICATOR_HALF;
export const ggoPanelTop = (railTop: number) => railTop + PANEL_TOP_OFFSET;

function useIntro(): boolean {
  const [isIntro, setIntro] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setIntro(false), PANEL_CONTENT_DELAY + CONTENT_FADE); return () => clearTimeout(timer); }, []);
  return isIntro;
}

/** The indicator starts at the shadow padding and eases to the selected root. */
function useSettledTop(target: number): number {
  const [isSettled, setSettled] = useState(false);
  useEffect(() => {
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setSettled(true)); });
    return () => cancelAnimationFrame(frame);
  }, []);
  return isSettled ? target : PANEL_SHADOW_PADDING;
}

interface GgoInfoPanelProps { entry: MenuEntry; playerName: string; left: number; top: number; indicatorTop: number; onPopup: () => void }
export function GgoInfoPanel({ entry, playerName, left, top, indicatorTop, onPopup }: GgoInfoPanelProps) {
  useEffect(() => { onPopup(); }, []);
  const isIntro = useIntro();
  const indicator = useSettledTop(indicatorTop);
  const label = entry.id === 'user' ? playerName || entry.name : entry.name;
  const content = `ggo-panel-content${isIntro ? ' intro' : ''}`;
  return <section className="ggo-panel info-panel" style={{ left, top }} aria-label={`${entry.name} information`}>
    <div className="ggo-panel-clip">
      <div className="ggo-panel-art">
        <img className="ggo-panel-icon" src={GGO_IMAGES + 'icon/info.png'} alt="" />
        <img className="ggo-panel-status" src={GGO_IMAGES + 'etc/panel-text.png'} alt="" />
        {PANEL_BARS.map((bar, index) => <span key={index} className={`ggo-panel-bar ${bar.size}`} style={{ left: bar.x, top: bar.y, '--bar-width': `${bar.width}px` } as React.CSSProperties} />)}
        <h1 key={`label:${entry.id}`} className={`ggo-panel-label ${content}`}>{label}</h1>
        <div className="ggo-panel-image"><FallbackImage key={`image:${entry.id}`} className={content} sources={themeImageSources('ggo', entry.image)} /></div>
      </div>
      <span className="ggo-panel-shadow" style={{ top: PANEL_SHADOW_PADDING, height: Math.max(0, indicator - PANEL_SHADOW_PADDING) }} />
      <img className="ggo-panel-indicator" style={{ top: indicator }} src={GGO_IMAGES + 'etc/panel-indicator.png'} alt="" />
      <span className="ggo-panel-shadow lower" style={{ top: indicator + PANEL_INDICATOR_HALF * 2 }} />
    </div>
  </section>;
}
