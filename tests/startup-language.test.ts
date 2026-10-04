import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStartupLanguage, startupStrings, STARTUP_LANGUAGES } from '../src/shared/startup-language';
import { defaultSettings, normalizeSettings } from '../src/shared/settings';

test('System follows the operating system language, falling back to English', () => {
  assert.equal(resolveStartupLanguage('system', 'ja-JP'), 'ja');
  assert.equal(resolveStartupLanguage('system', 'zh-TW'), 'zh-Hant');
  assert.equal(resolveStartupLanguage('system', 'zh-Hant-HK'), 'zh-Hant');
  assert.equal(resolveStartupLanguage('system', 'zh-CN'), 'zh-Hans');
  assert.equal(resolveStartupLanguage('system', 'de-AT'), 'de');
  assert.equal(resolveStartupLanguage('system', 'pt-BR'), 'en');
  assert.equal(resolveStartupLanguage('ko', 'ja-JP'), 'ko');
});

test('Japanese keeps the anime cards word for word', () => {
  const ja = startupStrings('ja');
  assert.equal(ja.registrationTitle, 'キャラクター登録');
  assert.deepEqual(ja.registrationBody, ['βテスト時に登録したデータが', '残っていますが、使用しますか？']);
  assert.deepEqual([ja.languageLabel, ja.languageName, ja.login, ja.account, ja.password], ['Language', 'Japanese', 'Log in_::', ':account', ':password']);
});

test('every language fills every blue-card string', () => {
  for (const language of STARTUP_LANGUAGES) {
    const strings = startupStrings(language);
    for (const value of [strings.languageLabel, strings.languageName, strings.login, strings.signUp, strings.account, strings.password, strings.registrationTitle, strings.yes, strings.no, ...strings.registrationBody]) assert.ok(value.trim(), `${language} is missing a string`);
    assert.equal(strings.registrationBody.length, 2);
  }
});

test('the Link Start language setting defaults to System and rejects unknown values', () => {
  assert.equal(defaultSettings('darwin').startupLanguage, 'system');
  assert.equal(normalizeSettings({ startupLanguage: 'zh-Hant' }, 'darwin').startupLanguage, 'zh-Hant');
  assert.equal(normalizeSettings({ startupLanguage: 'klingon' }, 'darwin').startupLanguage, 'system');
});
