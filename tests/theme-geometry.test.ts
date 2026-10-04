import test from 'node:test';
import assert from 'node:assert/strict';
import { columnTops, launcherLayout, submenuLayout } from '../src/shared/theme-geometry';

// SAO values are the constants main.tsx used before themes; they must not move.
test('SAO layout keeps the original SAO rail, anchor and submenu placement', () => {
  const layout = launcherLayout('sao', 5, 1);
  assert.equal(layout.width, 835);
  assert.equal(layout.height, 650);
  assert.deepEqual([layout.anchorX, layout.anchorY], [303, 298]);
  assert.deepEqual([layout.railLeft, layout.railTop], [271, 148]);
  assert.deepEqual([0, 1, 4].map(layout.rootTop), [35, 105, 315]);
  assert.equal(layout.rootCapacity, 7);
  assert.equal(layout.rootPitch, 70);
  assert.equal(layout.rootCenter(2), 355);
  assert.deepEqual([0, 2].map(layout.menuLeft), [345, 689]);
  assert.equal(layout.openDelay, 700);
  assert.deepEqual([0, 4, 6].map(layout.rootEntranceDelay), [500, 100, 0]);
  assert.equal(layout.rootEnabled(6), true);
});

test('SAO layout widens for deep menus and reserves height for long rails', () => {
  assert.equal(launcherLayout('sao', 9, 4).width, 1043);
  assert.equal(launcherLayout('sao', 9, 4).height, 790);
  assert.equal(launcherLayout('sao', 0, 0).width, 835);
});

test('SAO submenu recentres the selected row and keeps its 44 px pitch', () => {
  const sao = submenuLayout('sao');
  assert.equal(sao.recenterSelected, true);
  assert.equal(sao.pitch, 44);
  assert.equal(sao.height(3), 310);
  assert.equal(sao.rowTop(0, 3, 3, false), (310 - (3 * 46 - 2 * 2)) / 2);
  assert.equal(sao.rowTop(0, 8, 12, false), 0);
  assert.equal(sao.rowTop(1, 3, 3, true), 132);
  assert.equal(sao.popupDelay, 300);
});

test('SAO submenu columns share the selected root height', () => {
  assert.deepEqual(columnTops('sao', 355, [3, 4, 2], [0, 44]), [200, 200, 200]);
});

test('GGO rail uses the 120x516 tray, 94x78 buttons and -1 px margin', () => {
  const layout = launcherLayout('ggo', 5, 1);
  assert.deepEqual([layout.railLeft, layout.railTop], [427, 50]);
  assert.deepEqual([layout.anchorX, layout.anchorY], [495, 200]);
  // paddingTop = 4 + (516 - (5 * 78 - 4)) / 2; path spacing = contentHeight / visibleCount.
  assert.equal(layout.rootTop(0), 69);
  assert.equal(layout.rootTop(1), 69 + 386 / 5);
  assert.equal(layout.rootCenter(0), 50 + 69 + 39);
  assert.equal(layout.rootCapacity, 6);
  assert.deepEqual([0, 1].map(layout.menuLeft), [538, 730]);
  assert.equal(layout.width, 738);
});

test('GGO rail with six or more roots scrolls with the current item 68 px down', () => {
  const layout = launcherLayout('ggo', 8, 1);
  assert.equal(layout.rootTop(0), 68);
  assert.equal(layout.rootTop(1), 68 + 463 / 6);
  assert.equal(layout.rootEnabled(4), true);
  assert.equal(layout.rootEnabled(5), false);
  assert.equal(launcherLayout('ggo', 5, 1).rootEnabled(4), true);
});

test('GGO entrance fades buttons from 500 ms and checks the first after the stagger', () => {
  const layout = launcherLayout('ggo', 5, 1);
  assert.deepEqual([0, 1, 4].map(layout.rootEntranceDelay), [500, 600, 900]);
  assert.equal(layout.openDelay, 500 + 6 * 100);
  assert.equal(launcherLayout('ggo', 3, 1).openDelay, 500 + 4 * 100);
  assert.equal(launcherLayout('ggo', 9, 1).openDelay, 500 + 6 * 100);
});

test('GGO submenu tray height follows its item count within 50..314 px', () => {
  const ggo = submenuLayout('ggo');
  assert.equal(ggo.recenterSelected, false);
  assert.equal(ggo.pitch, 42);
  assert.equal(ggo.height(0), 50);
  assert.equal(ggo.height(3), 3 * 42 + 4 + 16);
  assert.equal(ggo.height(8), 314);
  assert.equal(ggo.height(20), 314);
  assert.equal(ggo.rowTop(2, 3, 3, true), 84);
  assert.equal(ggo.popupDelay, 400);
});

test('GGO submenus centre on the selected root and then on each selected row', () => {
  const center = 158;
  const first = center - (3 * 42 + 20) / 2;
  const second = first + 42 + 30 - (2 * 42 + 20) / 2;
  assert.deepEqual(columnTops('ggo', center, [3, 2], [42]), [first, second]);
});

test('GGO nested column waits at the parent top until its selected row is known', () => {
  const [first, second] = columnTops('ggo', 200, [1, 1], []);
  assert.equal(second, first + 30 - 62 / 2);
});
