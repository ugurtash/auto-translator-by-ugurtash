const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(initial = {}, responder = async () => { throw new Error('Unexpected network request'); }) {
  const data = { ...initial }; const listeners = [];
  const chrome = { runtime: { id: 'extension-id', getURL: p => 'chrome-extension://extension-id/' + p, onMessage: { addListener: f => listeners.push(f) } }, storage: { local: {
    setAccessLevel: async level => { data.accessLevel = level.accessLevel; },
    get(keys, cb) { const values = {}; for (const k of Array.isArray(keys) ? keys : [keys]) values[k] = data[k]; if (cb) cb(values); else return Promise.resolve(values); },
    set(values, cb) { Object.assign(data, values); if (cb) cb(); else return Promise.resolve(); },
    remove: async keys => { for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k]; }
  } } };
  const context = vm.createContext({ chrome, fetch: responder, URL, AbortSignal, console, Date, Promise });
  context.importScripts = (...paths) => paths.forEach(p => vm.runInContext(fs.readFileSync(p, 'utf8'), context));
  vm.runInContext(fs.readFileSync('background.js', 'utf8'), context);
  async function send(message, sender) {
    return new Promise(resolve => { for (const listener of listeners) if (listener(message, sender, resolve) === true) return; });
  }
  return { data, context, send };
}
const popup = { id: 'extension-id', url: 'chrome-extension://extension-id/popup.html' };
const content = { id: 'extension-id', url: 'https://example.org', tab: { id: 1 } };
test('website content scripts cannot request founder authentication', async () => {
  const app = setup();
  const result = await app.send({ type: 'owner-login', email: 'x', password: 'x' }, content);
  assert.equal(result.ok, false); assert.equal(app.data.accessLevel, 'TRUSTED_CONTEXTS');
});
test('local premium flag cannot bypass the free limit', async () => {
  const app = setup({ premium: true, dailyWords: 500, targetLanguage: 'tr' });
  app.data.usageDate = vm.runInContext('getToday()', app.context);
  const result = await app.send({ type: 'translate', text: 'hello' }, content);
  assert.equal(result.code, 'LIMIT_REACHED');
});
test('public settings request exposes only the translation toggle', async () => {
  const app = setup({ translationEnabled: false, ownerSession: { access_token: 'private' } });
  const result = await app.send({ type: 'translation-settings' }, content);
  assert.equal(result.translationEnabled, false); assert.deepEqual(Object.keys(result), ['translationEnabled']);
});
test('valid owner session uses server translation, bypassing only the local daily quota', async () => {
  const app = setup({ dailyWords: 500, targetLanguage: 'tr', ownerSession: { access_token: 'private', expires_at: Date.now() / 1000 + 3600 } }, async (url, options) => {
    assert.ok(url.endsWith('/translate')); assert.equal(options.headers.Authorization, 'Bearer private');
    return Response.json({ ok: true, translation: 'merhaba', plan: 'owner', limit: null });
  });
  const result = await app.send({ type: 'translate', text: 'hello' }, content);
  assert.equal(result.translation, 'merhaba'); assert.equal(app.data.dailyWords, 500);
});
test('revoked owner session clears stored credentials and allows signing in again', async () => {
  const app = setup({ ownerSession: { access_token: 'revoked', expires_at: Date.now()/1000+3600 } }, async () => Response.json({ ok: false, code: 'AUTH_REQUIRED', error: 'Sign in' }, { status: 401 }));
  const result = await app.send({ type: 'owner-status' }, popup);
  assert.equal(result.signedIn, false); assert.equal(app.data.ownerSession, undefined);
});
test('expired session refresh persists rotated tokens before translation', async () => {
  let calls = 0;
  const app = setup({ targetLanguage: 'tr', ownerSession: { access_token: 'old', refresh_token: 'refresh', expires_at: 1 } }, async (url, options) => {
    calls++;
    if (url.endsWith('/auth')) return Response.json({ ok: true, session: { access_token: 'new', refresh_token: 'rotated', expires_at: Date.now()/1000+3600 } });
    assert.equal(options.headers.Authorization, 'Bearer new');
    return Response.json({ ok: true, translation: 'merhaba' });
  });
  const result = await app.send({ type: 'translate', text: 'hello' }, content);
  assert.equal(result.ok, true); assert.equal(app.data.ownerSession.refresh_token, 'rotated'); assert.equal(calls, 2);
});
