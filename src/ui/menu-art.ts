/** Vector artwork from the user-supplied darkblackswords SAO fan kit. */
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

export function menuArtwork(icon: string, root: boolean): { normal: string; active: string } | null {
  const name = (root ? ROOT_ART : ITEM_ART)[icon];
  return name ? { normal: `./sao-art/${name}.svg`, active: `./sao-art/${name}-active.svg` } : null;
}
