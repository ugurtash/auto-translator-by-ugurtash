const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(initial = {}, responder = async () => { throw new Error('Unexpected network request'); }) {
  const data = { ...initial }; const listeners = [];
  const transient = {};
  const chrome = { runtime: { id: 'extension-id', getURL: p => 'chrome-extension://extension-id/' + p, onMessage: { addListener: f => listeners.push(f) } }, storage: { local: {
    setAccessLevel: async level => { data.accessLevel = level.accessLevel; },
    get(keys, cb) { const values = {}; for (const k of Array.isArray(keys) ? keys : [keys]) values[k] = data[k]; if (cb) cb(values); else return Promise.resolve(values); },
    set(values, cb) { Object.assign(data, values); if (cb) cb(); else return Promise.resolve(); },
    remove: async keys => { for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k]; }
  }, session: { setAccessLevel: async () => {}, get: async keys => Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,transient[k]])), set: async values => Object.assign(transient,values), remove: async keys => {for(const k of Array.isArray(keys)?keys:[keys])delete transient[k];} } } };
  const context = vm.createContext({ chrome, fetch: responder, URL, AbortSignal, console, Date, Promise, setTimeout });
  context.importScripts = (...paths) => paths.forEach(p => vm.runInContext(fs.readFileSync(p, 'utf8'), context));
  vm.runInContext(fs.readFileSync('background.js', 'utf8'), context);
  async function send(message, sender) {
    return new Promise(resolve => { for (const listener of listeners) if (listener(message, sender, resolve) === true) return; });
  }
  return { data, transient, context, send };
}
const settings = { id: 'extension-id', url: 'chrome-extension://extension-id/account.html' };
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
test('owner authorization is validated server-side before direct provider translation', async () => {
  const app = setup({ dailyWords: 500, targetLanguage: 'tr', ownerSession: { access_token: 'private', expires_at: Date.now() / 1000 + 3600 } }, async (url, options) => {
    if (String(url).endsWith('/account')) { assert.equal(options.headers.Authorization, 'Bearer private'); return Response.json({ok:true,unlimited:true,plan:'owner'}); }
    assert.ok(String(url).startsWith('https://translate.googleapis.com/'));
    return Response.json([[['merhaba','hello']], null, 'en']);
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
    if (String(url).endsWith('/account')) { assert.equal(options.headers.Authorization, 'Bearer new'); return Response.json({ok:true,unlimited:true,plan:'owner'}); }
    return Response.json([[['merhaba','hello']],null,'en']);
  });
  const result = await app.send({ type: 'translate', text: 'hello' }, content);
  assert.equal(result.ok, true); assert.equal(app.data.ownerSession.refresh_token, 'rotated'); assert.equal(calls, 3);
});

test('popup cannot start login; account settings can access account status', async () => {
  const app = setup();
  const blocked = await app.send({ type: 'owner-login' }, popup);
  assert.equal(blocked.ok, false);
  const status = await app.send({ type: 'owner-status' }, settings);
  assert.equal(status.signedIn, false);
});

test('remember me controls persistent versus browser-session token storage', async () => {
  for (const remember of [false,true]) {
    const app = setup({}, async url => String(url).endsWith('/auth') ? Response.json({ok:true,session:{access_token:'private',refresh_token:'refresh',expires_at:Date.now()/1000+3600}}) : Response.json({ok:true,unlimited:true,plan:'owner',email:'account@example.com'}));
    await app.send({type:'owner-login',email:'account@example.com',password:'example-password',remember},settings);
    assert.equal(!!app.data.ownerSession,remember);
    assert.equal(!!app.transient.ownerSession,!remember);
  }
});

test('provider throttling never reports a successful translation or consumes free usage',async()=>{
 const app=setup({targetLanguage:'tr'},async()=>Response.json({}, {status:429,headers:{'Retry-After':'60'}}));
 const result=await app.send({type:'translate',text:'hello'},content);
 assert.equal(result.ok,false);assert.match(result.error,/service is busy/);assert.equal(app.data.dailyWords,0);
});

test('returning to translation closes only the verified account tab',async()=>{
 const app=setup();app.transient.accountReturnPage={tabId:1,windowId:3};const calls=[];
 app.context.chrome.tabs={update:async id=>calls.push(['activate',id]),get:async id=>({id,url:'chrome-extension://extension-id/account.html'}),remove:async id=>calls.push(['close',id])};
 app.context.chrome.windows={update:async()=>{}};app.context.chrome.action={openPopup:async()=>{}};
 await app.send({type:'owner-return-to-page',accountTabId:2},settings);
 assert.deepEqual(calls,[['activate',1],['close',2]]);
});
test('missing original tab keeps the account tab open',async()=>{
 const app=setup();app.transient.accountReturnPage={tabId:1,windowId:3};let closed=false;
 app.context.chrome.tabs={update:async()=>{throw new Error('Missing tab');},remove:async()=>{closed=true;}};
 app.context.chrome.action={};
 await app.send({type:'owner-return-to-page',accountTabId:2},settings);assert.equal(closed,false);
});

test('signed-in free account continues translating under the free quota',async()=>{
 const app=setup({targetLanguage:'tr',ownerSession:{access_token:'private',expires_at:Date.now()/1000+3600}},async url=>String(url).endsWith('/account')?Response.json({ok:true,unlimited:false,plan:'free'}):Response.json([[['merhaba','hello']],null,'en']));
 const result=await app.send({type:'translate',text:'hello'},content);assert.equal(result.ok,true);assert.equal(result.premium,false);assert.equal(app.data.dailyWords,1);
});
test('paid entitlement permits translation beyond the local quota',async()=>{
 const app=setup({targetLanguage:'tr',dailyWords:500,ownerSession:{access_token:'private',expires_at:Date.now()/1000+3600}},async url=>String(url).endsWith('/account')?Response.json({ok:true,unlimited:true,plan:'premium'}):Response.json([[['merhaba','hello']],null,'en']));
 const result=await app.send({type:'translate',text:'hello'},content);assert.equal(result.ok,true);assert.equal(result.plan,'premium');assert.equal(app.data.dailyWords,500);
});
test('website cannot initiate a checkout or read its account binding',async()=>{
 const app=setup();const result=await app.send({type:'owner-checkout'},content);assert.equal(result.ok,false);
});
