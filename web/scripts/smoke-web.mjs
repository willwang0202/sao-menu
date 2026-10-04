// End-to-end check of SAO Menu flows in a real browser.
// Usage: node web/scripts/smoke-web.mjs <base-url>   (screenshots in output/web/)
// Registers two disposable players; run against local or preview databases, not production.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:3100';
const output = path.resolve('output/web');
const suffix = Date.now().toString(36);
const player = { username: `kirito_${suffix}`, displayName: 'Kirito', password: 'a long web test password' };
const friend = { username: `asuna_${suffix}`, displayName: 'Asuna', password: 'another long web test password' };
await mkdir(output, { recursive: true });

const api = async (route, body, token) => {
  const response = await fetch(`${base}/v1/${route}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
};

/** The headline fades in after the tunnel; wait it out before screenshots. */
const HERO_FADE_MS = 900;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('.hero[data-finished="true"]').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(HERO_FADE_MS);
  await page.screenshot({ path: path.join(output, 'landing-hero.png') });
  await page.screenshot({ path: path.join(output, 'landing-full.png'), fullPage: true });
  assert.match(await page.getByRole('link', { name: /Download for Mac/ }).getAttribute('href'), /\.dmg$/);
  assert.match(await page.getByRole('link', { name: /Download for Windows/ }).getAttribute('href'), /sao-menu\/releases\/download\/v0\.1\.4\/.*windows-x64\.exe$/);
  assert.match(await page.getByRole('link', { name: /Download for Linux/ }).getAttribute('href'), /linux-x64\.AppImage$/);
  await page.getByRole('link', { name: 'Support', exact: true }).click();
  await page.getByRole('heading', { name: 'Report a bug' }).waitFor();
  assert.equal(await page.getByRole('link', { name: /Report a bug/ }).getAttribute('href'), 'https://github.com/willwang0202/sao-menu/issues/new?template=bug_report.yml');
  assert.equal(await page.getByRole('link', { name: /View issues/ }).getAttribute('href'), 'https://github.com/willwang0202/sao-menu/issues');

  await page.getByRole('link', { name: 'Create account' }).first().click();
  await page.getByLabel(':account').fill(player.username);
  await page.getByLabel(':player name').fill(player.displayName);
  await page.getByLabel(':password').fill('short');
  await page.screenshot({ path: path.join(output, 'register.png') });
  await page.getByLabel(':password').fill(player.password);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(`${base}/account`);
  await page.getByRole('heading', { name: 'Kirito' }).waitFor();

  // The second player uses the same API the desktop app speaks.
  const asuna = await api('register', friend);
  assert.equal(asuna.status, 201);
  assert.equal((await api('friends/request', { username: player.username }, asuna.data.token)).status, 200);
  await page.reload();
  await page.getByRole('button', { name: 'YES' }).click();
  await page.getByRole('link', { name: /Asuna/ }).waitFor();
  await api('messages/send', { peer: (await api('state', undefined, asuna.data.token)).data.friends[0].id, text: 'See you on floor 75.' }, asuna.data.token);
  await page.reload();
  await page.getByRole('link', { name: /Asuna/ }).click();
  await page.getByText('See you on floor 75.').waitFor();
  await page.getByLabel('Message').fill('Link Start!');
  await page.getByRole('button', { name: 'Send' }).last().click();
  await page.locator('.messages li.mine', { hasText: 'Link Start!' }).waitFor();
  const seen = (await api(`messages?peer=${(await api('state', undefined, asuna.data.token)).data.friends[0].id}`, undefined, asuna.data.token)).data.messages;
  assert.equal(seen.at(-1).text, 'Link Start!', 'web messages reach the app protocol');
  assert.equal((await api('state', undefined, asuna.data.token)).data.conversations[0].unread, 1);
  await page.screenshot({ path: path.join(output, 'account.png'), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(base);
  await mobile.locator('.hero[data-finished="true"]').waitFor({ timeout: 15_000 });
  await mobile.waitForTimeout(HERO_FADE_MS);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll on phones');
  await mobile.screenshot({ path: path.join(output, 'landing-mobile.png'), fullPage: true });
  await mobile.goto(`${base}/login`);
  await mobile.screenshot({ path: path.join(output, 'login-mobile.png') });
  await mobile.goto(`${base}/support`);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'support fits phones');
  await mobile.getByRole('link', { name: /Report a bug/ }).waitFor();

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(`${base}/`);
  await page.goto(`${base}/account`);
  await page.waitForURL(`${base}/login`);
  assert.deepEqual(errors, []);
  console.log(`Web flows passed against ${base}; screenshots in ${output}`);
} finally { await browser.close(); }
