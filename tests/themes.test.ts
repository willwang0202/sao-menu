import test from 'node:test';
import assert from 'node:assert/strict';
import { themeSound } from '../src/shared/themes';

test('SAO theme uses the original SAO launcher sounds', () => {
  assert.equal(themeSound('sao', 'click'), 'Feedback.SAO.Click.wav');
  assert.equal(themeSound('sao', 'popupLauncher'), 'Popup.SAO.Launcher.wav');
  assert.equal(themeSound('sao', 'dismissLauncher'), 'Dismiss.SAO.Launcher.wav');
});

test('themes without their own sound for an event fall back to the SAO sound', () => {
  assert.equal(themeSound('ggo', 'popupPanel'), 'Popup.SAO.Panel.wav');
});

test('ALO theme follows the original sfx-alo preset and keeps SAO panel and menu sounds', () => {
  assert.equal(themeSound('alo', 'click'), 'Feedback.ALO.Click.wav');
  assert.equal(themeSound('alo', 'popupLauncher'), 'Popup.ALO.Launcher.wav');
  assert.equal(themeSound('alo', 'dismissLauncher'), 'Dismiss.ALO.Launcher.wav');
  assert.equal(themeSound('alo', 'ready'), 'Ready.ALO.Welcome.wav');
  assert.equal(themeSound('alo', 'popupMenu'), 'Popup.SAO.Menu.wav');
  assert.equal(themeSound('alo', 'popupPanel'), 'Popup.SAO.Panel.wav');
});
