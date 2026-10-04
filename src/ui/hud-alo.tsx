import React, { useEffect } from 'react';
import { hpBattery, hpHeight, hpLevel, HP_MIN_WIDTH, type HpState } from '../shared/hud';
import { aloExtraTop, aloFillWidth, aloHpImage, aloMana, ALO_HP_WIDTH, ALO_MP_WIDTH } from '../shared/hud-alo';
import './hud-alo.css';
const ART = './sao-original/HPBar/';
/** The original ALO preset dresses Leafa with the Sylph race icon. */
const ICON = ART + 'icon/Sylph.png';

/** ALO style of the original HP-Bar widget: HP from battery, MP from memory load, level and charging badge on the main bar. */
export function AloHud({ state, onWidth }: { state: HpState; onWidth?: (width: number) => void }) {
  useEffect(() => { onWidth?.(HP_MIN_WIDTH); }, []);
  const motion = !state.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const percent = hpBattery(state.stats?.batteryPercent), level = hpLevel(state.accountCreatedAt);
  return <aside className={`alo-display ${motion ? '' : 'alo-still'}`} style={{ height: hpHeight(state.partyMembers.length, 'alo') }} aria-label="ALO HP display">
    <AloBar name={state.playerName} hp={percent / 100} mp={aloMana(state.stats)} label={`${state.playerName}: battery ${percent}%`} batteryPercent={percent}>
      <div className="alo-status">
        <span className="alo-level" title="Account age in days">Lv.{level}</span>
        {state.stats?.isCharging && <img className="alo-buff" src={ART + 'alo-buff.png'} alt="Charging" />}
      </div>
    </AloBar>
    {state.partyMembers.map((member, index) => {
      const battery = hpBattery(member.batteryPercent);
      // Companions report only battery, so their MP bar stays full like an unconfigured original bar.
      return <AloBar key={member.id} top={aloExtraTop(index)} name={member.displayName} hp={battery / 100} mp={1} memberId={member.id} batteryPercent={battery} label={`${member.displayName}: battery ${battery}%, ${member.online ? 'online' : 'offline'}`} />;
    })}
  </aside>;
}

function AloBar({ top = 0, name, hp, mp, label, memberId, batteryPercent, children }: { top?: number; name: string; hp: number; mp: number; label: string; memberId?: string; batteryPercent: number; children?: React.ReactNode }) {
  return <div className="alo-bar" style={{ top }} aria-label={label} data-party-member={memberId} data-battery-percent={batteryPercent}>
    <img className="alo-background" src={ART + 'alo-background.png'} alt="" />
    <div className="alo-label-row"><span className="alo-name" title={name}>{name}</span>{children}</div>
    <img className="alo-icon" src={ICON} alt="" />
    <AloGauge top={23} image={aloHpImage(hp)} width={ALO_HP_WIDTH} progress={hp} kind="hp" />
    <AloGauge top={37} image="alo-mp.png" width={ALO_MP_WIDTH} progress={mp} kind="mp" />
  </div>;
}

/** BarALO.qml: the bar is revealed up to the progress point, then closed with its own left cap mirrored. */
function AloGauge({ top, image, width, progress, kind }: { top: number; image: string; width: number; progress: number; kind: 'hp' | 'mp' }) {
  const fill = aloFillWidth(progress, width), art = { backgroundImage: `url(${ART + image})` };
  return <div className={`alo-gauge alo-gauge-${kind}`} style={{ top, width }} aria-hidden="true">
    <div className="alo-gauge-fill" style={{ ...art, width: fill }} /><div className="alo-gauge-cap" style={{ ...art, left: fill }} />
  </div>;
}
