import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { menuArtwork } from '../src/ui/menu-art';

test('SAO themes use the darkblackswords vector icons', () => {
  assert.deepEqual(menuArtwork('symbol/info.png', true, 'sao'), { normal: './sao-art/player.svg', active: './sao-art/player-active.svg' });
  assert.deepEqual(menuArtwork('item/help.png', false, 'alo'), { normal: './sao-art/help.svg', active: './sao-art/help-active.svg' });
});

test('Sky theme uses its own line icon set', () => {
  assert.deepEqual(menuArtwork('symbol/info.png', true, 'sky'), { normal: './sky-art/player.svg', active: './sky-art/player-active.svg' });
  assert.deepEqual(menuArtwork('item/logout.png', false, 'sky'), { normal: './sky-art/logout.svg', active: './sky-art/logout-active.svg' });
});

test('returns null for icons without vector artwork', () => {
  assert.equal(menuArtwork('item/Other/favs2.png', false, 'sky'), null);
});

test('every Sky icon referenced by the menu ships in public/sky-art', () => {
  const icons = ['symbol/info.png', 'symbol/party.png', 'symbol/msg.png', 'symbol/navi.png', 'symbol/setting.png'].map(icon => menuArtwork(icon, true, 'sky'))
    .concat(['item/items.png', 'item/skills.png', 'item/equipment.png', 'item/option.png', 'item/help.png', 'item/logout.png'].map(icon => menuArtwork(icon, false, 'sky')));
  for (const art of icons) {
    assert.ok(art);
    for (const file of [art.normal, art.active]) assert.ok(existsSync(path.join('public', file)), `${file} is missing`);
  }
});
