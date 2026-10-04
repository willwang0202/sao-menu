import test from 'node:test';
import assert from 'node:assert/strict';
import { aloFillWidth, aloHeight, aloExtraTop, aloHpImage, aloMana, ALO_HP_WIDTH, ALO_MP_WIDTH } from '../src/shared/hud-alo';
import { hpHeight, hpState } from '../src/shared/hud';
import { pmsetPower, linuxCharging } from '../src/desktop/power';

test('ALO bars stack a 68px main bar, 10px gap, then 68px companion bars 1px apart', () => {
  assert.equal(aloHeight(0), 68);
  assert.equal(aloHeight(1), 146);
  assert.equal(aloHeight(2), 215);
  assert.equal(aloHeight(9), aloHeight(5), 'at most five companions');
  assert.equal(aloExtraTop(0), 78); assert.equal(aloExtraTop(1), 147);
});

test('hpHeight keeps SAO geometry and switches to ALO geometry for the ALO theme', () => {
  assert.equal(hpHeight(1), 89); assert.equal(hpHeight(1, 'sao'), 89); assert.equal(hpHeight(1, 'ggo'), 89);
  assert.equal(hpHeight(1, 'alo'), 146);
});

test('ALO fill keeps a 7px cap at each end like BarALO.qml', () => {
  assert.equal(aloFillWidth(1, ALO_HP_WIDTH), 249);
  assert.equal(aloFillWidth(0, ALO_HP_WIDTH), 7);
  assert.equal(aloFillWidth(.5, ALO_HP_WIDTH), 128);
  assert.equal(aloFillWidth(1, ALO_MP_WIDTH), 203);
  assert.equal(aloFillWidth(2, ALO_HP_WIDTH), 249); assert.equal(aloFillWidth(-1, ALO_HP_WIDTH), 7); assert.equal(aloFillWidth(NaN, ALO_HP_WIDTH), 249);
});

test('ALO HP artwork turns yellow at half and red at a quarter', () => {
  assert.equal(aloHpImage(1), 'alo-hp-green.png'); assert.equal(aloHpImage(.51), 'alo-hp-green.png');
  assert.equal(aloHpImage(.5), 'alo-hp-yellow.png'); assert.equal(aloHpImage(.26), 'alo-hp-yellow.png');
  assert.equal(aloHpImage(.25), 'alo-hp-red.png'); assert.equal(aloHpImage(0), 'alo-hp-red.png');
});

test('ALO mana mirrors physical memory load like the original preset, full without telemetry', () => {
  const stats = { platform: 'darwin' as const, hostname: 'h', cpuPercent: 1, memoryUsed: 4, memoryTotal: 16, uptime: 1, batteryPercent: 50 };
  assert.equal(aloMana(stats), .25);
  assert.equal(aloMana(null), 1);
  assert.equal(aloMana({ ...stats, memoryTotal: 0 }), 1);
  assert.equal(aloMana({ ...stats, memoryUsed: null }), 1);
});

test('HP state carries the theme so the HP window can draw ALO art', () => {
  const settings = { playerName: 'Leafa', reducedMotion: false, theme: 'alo' as const };
  assert.equal(hpState(settings, null, null).theme, 'alo');
  assert.equal(hpState({ ...settings, theme: 'sao' }, null, null).theme, 'sao');
});

test('external power is read from pmset and Linux battery status, and needs a battery', () => {
  assert.deepEqual(pmsetPower("Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t100%; charged; 0:00 remaining present: true\n"), { percent: 100, isCharging: true });
  assert.deepEqual(pmsetPower("Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t64%; discharging; 3:10 remaining present: true\n"), { percent: 64, isCharging: false });
  assert.deepEqual(pmsetPower("Now drawing from 'AC Power'\n"), { percent: null, isCharging: false });
  assert.equal(linuxCharging(['Charging']), true); assert.equal(linuxCharging(['Full']), true); assert.equal(linuxCharging(['Not charging']), true);
  assert.equal(linuxCharging(['Discharging']), false); assert.equal(linuxCharging([]), false); assert.equal(linuxCharging(['Unknown']), false);
});
