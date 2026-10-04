/**
 * Icon lookup per launcher theme. Menu entries store SAO-relative paths
 * (`symbol/info.png`, `item/Other/favs2.png`); the GGO package mirrors that
 * tree, so most paths map one-to-one. Renames follow
 * Configs/system/launcher/themes/launcher@ggo.theme.gpbeta.com.xml.
 */
import type { ThemeId } from './themes';

export const SAO_IMAGES = './sao-original/Images/';
export const GGO_IMAGES = './sao-original/GGO/Images/';

const GGO_RENAMED: Record<string, string> = {
  'symbol/party.png': 'symbol/stats.png',
  'item/equipment.png': 'item/equipments.png',
  'symbol/Media/Camera.png': 'symbol/Media/camera.png',
  'symbol/Media/Champions_League.png': 'symbol/Media/champions_league.png',
};
// Files in the SAO theme package with no GGO counterpart.
const GGO_MISSING = new Set([
  'icon/default.png', 'icon/default-pressed.png', 'icon/next.png', 'icon/next-pressed.png',
  'icon/prev.png', 'icon/prev-pressed.png', 'symbol/Network/b-bing.png',
]);
const GGO_DEFAULT_PANEL_IMAGE = 'etc/info.png';

/** GGO path for an SAO icon path, or null when GGO ships no equivalent. */
export function ggoIconPath(path: string): string | null {
  if (/-hovered\.png$/i.test(path) || GGO_MISSING.has(path)) return null;
  return GGO_RENAMED[path] ?? path;
}

/** The darkblackswords vector icons only match the SAO launcher look. */
export const usesSaoVectorArt = (theme: ThemeId): boolean => theme !== 'ggo';

/** Image URLs to try in order for a menu icon. */
export function themeIconSources(theme: ThemeId, path: string, isRoot: boolean): string[] {
  const help = isRoot ? 'symbol/help.png' : 'item/help.png';
  if (theme !== 'ggo') return [SAO_IMAGES + path, SAO_IMAGES + help];
  const ggo = ggoIconPath(path);
  return [...(ggo ? [GGO_IMAGES + ggo] : []), SAO_IMAGES + path, GGO_IMAGES + help];
}

/** GGO icons have a single face (MainButton/ItemButton only swap the background). */
export function themeHoverSource(theme: ThemeId, normal: string): string {
  return theme === 'ggo' ? normal : normal.replace(/\.png$/i, '-hovered.png');
}

/** Information-panel image URLs to try in order (GGO PanelView.qml defaults to etc/info.png). */
export function themeImageSources(theme: ThemeId, path: string | undefined): string[] {
  const fallback = theme === 'ggo' ? GGO_IMAGES + GGO_DEFAULT_PANEL_IMAGE : SAO_IMAGES + 'icon/default.png';
  if (!path) return [fallback];
  return theme === 'ggo' ? [...themeIconSources('ggo', path, false).slice(0, -1), fallback] : [SAO_IMAGES + path, fallback];
}
