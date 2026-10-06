import type { ThemeId } from '../shared/themes';

/** Vector artwork from the user-supplied darkblackswords SAO fan kit; Sky ships its own line set. */
const ROOT_ART: Record<string, string> = {
  'symbol/info.png': 'player',
  'symbol/party.png': 'party',
  'symbol/msg.png': 'message',
  'symbol/navi.png': 'navigation',
  'symbol/setting.png': 'settings',
};
const ITEM_ART: Record<string, string> = {
  'item/items.png': 'items',
  'item/skills.png': 'skills',
  'item/equipment.png': 'equipment',
  'item/option.png': 'option',
  'item/help.png': 'help',
  'item/logout.png': 'logout',
};

const artFolder = (theme: ThemeId): string => theme === 'sky' ? './sky-art' : './sao-art';

export function menuArtwork(icon: string, root: boolean, theme: ThemeId): { normal: string; active: string } | null {
  const name = (root ? ROOT_ART : ITEM_ART)[icon];
  const folder = artFolder(theme);
  return name ? { normal: `${folder}/${name}.svg`, active: `${folder}/${name}-active.svg` } : null;
}
