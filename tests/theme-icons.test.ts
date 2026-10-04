import test from 'node:test';
import assert from 'node:assert/strict';
import { ggoIconPath, themeHoverSource, themeIconSources, themeImageSources, usesSaoVectorArt } from '../src/shared/theme-icons';

const SAO = './sao-original/Images/';
const GGO = './sao-original/GGO/Images/';

test('GGO reuses the SAO path when the GGO package ships the same file', () => {
  assert.equal(ggoIconPath('symbol/info.png'), 'symbol/info.png');
  assert.equal(ggoIconPath('item/Other/favs2.png'), 'item/Other/favs2.png');
  assert.equal(ggoIconPath('item/option.png'), 'item/option.png');
});

test('GGO maps renamed icons the way launcher@ggo.theme.gpbeta.com.xml does', () => {
  assert.equal(ggoIconPath('symbol/party.png'), 'symbol/stats.png');
  assert.equal(ggoIconPath('item/equipment.png'), 'item/equipments.png');
  assert.equal(ggoIconPath('symbol/Media/Camera.png'), 'symbol/Media/camera.png');
});

test('GGO has no equivalent for SAO-only icons', () => {
  assert.equal(ggoIconPath('symbol/Network/b-bing.png'), null);
  assert.equal(ggoIconPath('icon/default.png'), null);
  assert.equal(ggoIconPath('item/items-hovered.png'), null);
});

test('SAO icon sources keep the SAO file then the help fallback', () => {
  assert.deepEqual(themeIconSources('sao', 'item/items.png', false), [SAO + 'item/items.png', SAO + 'item/help.png']);
  assert.deepEqual(themeIconSources('alo', 'symbol/info.png', true), [SAO + 'symbol/info.png', SAO + 'symbol/help.png']);
});

test('GGO icon sources try GGO art, then SAO art, then the GGO help icon', () => {
  assert.deepEqual(themeIconSources('ggo', 'symbol/party.png', true), [GGO + 'symbol/stats.png', SAO + 'symbol/party.png', GGO + 'symbol/help.png']);
  assert.deepEqual(themeIconSources('ggo', 'symbol/Network/b-bing.png', false), [SAO + 'symbol/Network/b-bing.png', GGO + 'item/help.png']);
});

test('GGO icons have no hovered variant; SAO uses its -hovered file', () => {
  assert.equal(themeHoverSource('ggo', GGO + 'symbol/info.png'), GGO + 'symbol/info.png');
  assert.equal(themeHoverSource('sao', SAO + 'symbol/info.png'), SAO + 'symbol/info.png'.replace('.png', '-hovered.png'));
});

test('only the SAO-look themes use the darkblackswords vector icons', () => {
  assert.equal(usesSaoVectorArt('sao'), true);
  assert.equal(usesSaoVectorArt('alo'), true);
  assert.equal(usesSaoVectorArt('ggo'), false);
});

test('GGO information panel image defaults to the GGO soldier art', () => {
  assert.deepEqual(themeImageSources('ggo', undefined), [GGO + 'etc/info.png']);
  assert.deepEqual(themeImageSources('ggo', 'etc/info.png'), [GGO + 'etc/info.png', SAO + 'etc/info.png', GGO + 'etc/info.png']);
});
