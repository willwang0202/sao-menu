/**
 * Launcher geometry per theme, in unscaled menu-group pixels.
 * SAO values come from com.gpbeta.theme.sao (see docs/original-design.md);
 * GGO values from com.gpbeta.theme.ggo MainView.qml / MenuView.qml / PanelView.qml.
 */
import type { ThemeId } from './themes';

export interface LauncherLayout {
  width: number;
  height: number;
  /** Group-local point that sits under the invoking cursor. */
  anchorX: number;
  anchorY: number;
  railLeft: number;
  railTop: number;
  rootCapacity: number;
  rootPitch: number;
  /** Button top inside the rail for a visible slot. */
  rootTop: (slot: number) => number;
  /** Group-local vertical centre of a visible root slot. */
  rootCenter: (slot: number) => number;
  rootEnabled: (slot: number) => boolean;
  rootEntranceDelay: (slot: number) => number;
  /** Delay before the first root is checked after the launcher appears. */
  openDelay: number;
  menuLeft: (depth: number) => number;
}

export interface SubmenuLayout {
  capacity: number;
  pitch: number;
  recenterSelected: boolean;
  popupDelay: number;
  height: (count: number) => number;
  rowTop: (slot: number, visibleCount: number, total: number, hasSelection: boolean) => number;
}

// SAO (MainView.qml/MenuView.qml): 64 px buttons with 6 px gaps; 182x46 items with -2 px gaps.
const SAO_RAIL_HEIGHT = 414;
const SAO_BUTTON = 64;
const SAO_PITCH = 70;
const SAO_CAPACITY = 7;
const SAO_RAIL_LEFT = 271;
const SAO_FIRST_CENTER = 215;
const SAO_MENU_LEFT = 345;
const SAO_MENU_STEP = 172;
const SAO_MENU_HEIGHT = 310;
const SAO_MENU_CENTER_OFFSET = 155;
const SAO_ITEM = 46;
const SAO_ITEM_PITCH = 44;
const SAO_SELECTED_ROW_TOP = 132;
const SAO_OPEN_DELAY = 700;
const SAO_ANCHOR_Y = 298;
const ENTRANCE_STEP = 100;
const STAGGER_LIMIT = 5;

// GGO MainView.qml: width 120, height 516, buttons 94x78, btnMargin -1, pathItemCount 6.
const GGO_RAIL_WIDTH = 120;
const GGO_RAIL_HEIGHT = 516;
const GGO_BUTTON_HEIGHT = 78;
const GGO_BUTTON_MARGIN = -1;
const GGO_CAPACITY = 6;
const GGO_PADDING_BASE = 4;
const GGO_SCROLL_HIGHLIGHT = 68;
const GGO_CLIPPED_BUTTON = 70;
const GGO_FADE_START = 500;
// PanelView x = mainView.x - 434 + 7, so the rail sits 427 px right of the panel.
const GGO_RAIL_LEFT = 427;
// Room above the rail for a full 314 px submenu centred on the first button.
const GGO_RAIL_TOP = 50;
// ThemeLauncher.qml: menuMouseOffset 68; LauncherTemplate: y = mouse.y - 150.
const GGO_MOUSE_OFFSET_X = 68;
const MOUSE_OFFSET_Y = 150;
// MenuView.qml: baseX = mainView.x + mainView.width - 9, nested = parent.x + 200 - 8.
const GGO_MENU_OFFSET = 111;
const GGO_MENU_WIDTH = 200;
const GGO_MENU_STEP = 192;
const GGO_ITEM = 46;
const GGO_ITEM_MARGIN = -4;
const GGO_ITEM_PITCH = GGO_ITEM + GGO_ITEM_MARGIN;
const GGO_MENU_PADDING = 16;
const GGO_MENU_MIN = 50;
const GGO_MENU_MAX = 314;
// MenuView.qml: child y = y + button.y + btnHalfHeight - height / 2 + 7.
const GGO_CHILD_CENTER = GGO_ITEM / 2 + 7;
const MENU_CAPACITY = 8;

const visible = (count: number, capacity: number) => Math.min(Math.max(count, 0), capacity);

function saoLayout(rootCount: number, columnCount: number): LauncherLayout {
  const count = visible(rootCount, SAO_CAPACITY);
  const padding = Math.max((SAO_RAIL_HEIGHT - (count * SAO_BUTTON + (count - 1) * (SAO_PITCH - SAO_BUTTON))) / 2, 0);
  const railTop = SAO_FIRST_CENTER - padding - SAO_BUTTON / 2;
  return {
    width: Math.max(835, SAO_MENU_LEFT + Math.max(1, columnCount) * SAO_MENU_STEP + 10),
    height: Math.max(562, 370 + Math.max(0, count - 1) * SAO_PITCH),
    anchorX: SAO_RAIL_LEFT + SAO_BUTTON / 2,
    // The port keeps the anchor fixed (five-root rail: rail top 148 + 150) so the
    // first root never moves with the root count.
    anchorY: SAO_ANCHOR_Y,
    railLeft: SAO_RAIL_LEFT,
    railTop,
    rootCapacity: SAO_CAPACITY,
    rootPitch: SAO_PITCH,
    rootTop: slot => padding + slot * SAO_PITCH,
    rootCenter: slot => SAO_FIRST_CENTER + slot * SAO_PITCH,
    rootEnabled: () => true,
    rootEntranceDelay: slot => Math.max((Math.min(rootCount, STAGGER_LIMIT) - slot) * ENTRANCE_STEP, 0),
    openDelay: SAO_OPEN_DELAY,
    menuLeft: depth => SAO_MENU_LEFT + depth * SAO_MENU_STEP,
  };
}

function ggoRootTop(rootCount: number): (slot: number) => number {
  const count = visible(rootCount, GGO_CAPACITY);
  const content = count * GGO_BUTTON_HEIGHT + (count - 1) * GGO_BUTTON_MARGIN;
  // PathView spreads the delegates evenly along a path as long as the content.
  const spacing = count ? content / count : 0;
  const isSnapped = rootCount < GGO_CAPACITY;
  const first = isSnapped ? GGO_PADDING_BASE + Math.max(GGO_RAIL_HEIGHT - content, 0) / 2 : GGO_SCROLL_HIGHLIGHT;
  return slot => first + slot * spacing;
}

function ggoLayout(rootCount: number, columnCount: number): LauncherLayout {
  const rootTop = ggoRootTop(rootCount);
  const rootCenter = (slot: number) => GGO_RAIL_TOP + rootTop(slot) + GGO_BUTTON_HEIGHT / 2;
  const rootEnabled = (slot: number) => rootCount < GGO_CAPACITY || rootTop(slot) < GGO_RAIL_HEIGHT - GGO_CLIPPED_BUTTON;
  const lastSlot = Math.max(0, visible(rootCount, GGO_CAPACITY) - (rootCount < GGO_CAPACITY ? 1 : 2));
  return {
    width: GGO_RAIL_LEFT + GGO_MENU_OFFSET + Math.max(1, columnCount) * GGO_MENU_STEP + (GGO_MENU_WIDTH - GGO_MENU_STEP),
    height: Math.ceil(Math.max(GGO_RAIL_TOP + GGO_RAIL_HEIGHT, rootCenter(lastSlot) + GGO_MENU_MAX / 2)),
    anchorX: GGO_RAIL_LEFT + GGO_MOUSE_OFFSET_X,
    anchorY: GGO_RAIL_TOP + MOUSE_OFFSET_Y,
    railLeft: GGO_RAIL_LEFT,
    railTop: GGO_RAIL_TOP,
    rootCapacity: GGO_CAPACITY,
    rootPitch: GGO_BUTTON_HEIGHT + GGO_BUTTON_MARGIN,
    rootTop,
    rootCenter,
    rootEnabled,
    rootEntranceDelay: slot => GGO_FADE_START + slot * ENTRANCE_STEP,
    openDelay: GGO_FADE_START + (Math.min(visible(rootCount, GGO_CAPACITY), STAGGER_LIMIT) + 1) * ENTRANCE_STEP,
    menuLeft: depth => GGO_RAIL_LEFT + GGO_MENU_OFFSET + depth * GGO_MENU_STEP,
  };
}

export function launcherLayout(theme: ThemeId, rootCount: number, columnCount: number): LauncherLayout {
  return theme === 'ggo' ? ggoLayout(rootCount, columnCount) : saoLayout(rootCount, columnCount);
}

const SAO_SUBMENU: SubmenuLayout = {
  capacity: MENU_CAPACITY,
  pitch: SAO_ITEM_PITCH,
  recenterSelected: true,
  popupDelay: 300,
  height: () => SAO_MENU_HEIGHT,
  rowTop: (slot, count, total, hasSelection) => {
    if (hasSelection) return SAO_SELECTED_ROW_TOP + (slot - Math.floor(count / 2)) * SAO_ITEM_PITCH;
    const padding = total >= MENU_CAPACITY ? 0 : (SAO_MENU_HEIGHT - (count * SAO_ITEM + Math.max(0, count - 1) * (SAO_ITEM_PITCH - SAO_ITEM))) / 2;
    return padding + slot * SAO_ITEM_PITCH;
  },
};

// GGO MenuView.qml: height = clamp(contentHeight + 16, 50, 314); items fade in at 200 ms and
// the PopupMenu sound plays when that 200 ms fade ends.
const GGO_SUBMENU: SubmenuLayout = {
  capacity: MENU_CAPACITY,
  pitch: GGO_ITEM_PITCH,
  recenterSelected: false,
  popupDelay: 400,
  height: count => {
    const shown = visible(count, MENU_CAPACITY);
    const content = shown * GGO_ITEM + Math.max(0, shown - 1) * GGO_ITEM_MARGIN;
    return Math.max(Math.min(content + GGO_MENU_PADDING, GGO_MENU_MAX), GGO_MENU_MIN);
  },
  rowTop: slot => slot * GGO_ITEM_PITCH,
};

export function submenuLayout(theme: ThemeId): SubmenuLayout {
  return theme === 'ggo' ? GGO_SUBMENU : SAO_SUBMENU;
}

/**
 * Column tops for an open menu chain. SAO columns all share the selected root
 * height; GGO trays centre on the selected root, then on each selected row.
 */
export function columnTops(theme: ThemeId, rootCenter: number, itemCounts: number[], selectedRowTops: (number | undefined)[]): number[] {
  if (theme !== 'ggo') return itemCounts.map(() => rootCenter - SAO_MENU_CENTER_OFFSET);
  const tops: number[] = [];
  itemCounts.forEach((count, depth) => {
    const height = GGO_SUBMENU.height(count);
    const center = depth === 0 ? rootCenter : tops[depth - 1] + (selectedRowTops[depth - 1] ?? 0) + GGO_CHILD_CENTER;
    tops.push(center - height / 2);
  });
  return tops;
}

export const GGO_RAIL = { width: GGO_RAIL_WIDTH, height: GGO_RAIL_HEIGHT } as const;
