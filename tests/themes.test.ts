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
