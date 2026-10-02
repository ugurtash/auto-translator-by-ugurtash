import test from 'node:test';
import assert from 'node:assert/strict';
import { requireOwner } from '../lib/owner.js';
import translate from '../api/translate.js';
import auth from '../api/auth.js';
const verified = { id: 'founder-id', email: 'ugurtash11@gmail.com', email_confirmed_at: '2026-01-01' };
process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
process.env.OWNER_USER_ID = 'founder-id';
process.env.OWNER_EMAIL = 'ugurtash11@gmail.com';
function res() { return { code: 200, headers: {}, setHeader(k,v) {this.headers[k]=v;}, status(c) {this.code=c;return this;}, json(b) {this.body=b;} }; }
const request = { headers: { authorization: 'Bearer verified-token' } };
test('missing credentials never grant owner access', async () => {
  await assert.rejects(requireOwner({ headers: {} }), e => e.status === 401);
});
test('server validates session; user metadata cannot grant ownership', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...verified, id: 'other-id', user_metadata: { role: 'owner' } }));
  await assert.rejects(requireOwner(request), e => e.status === 403);
});
test('unconfirmed founder email is refused', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...verified, email_confirmed_at: null }));
  await assert.rejects(requireOwner(request), e => e.status === 403);
});
test('forged token rejected by Auth server', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 401 }));
  await assert.rejects(requireOwner(request), e => e.status === 401);
});
test('owner can translate over 500 words; server enforces identity first', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls++;
    return String(url).includes('/auth/v1/user') ? Response.json(verified) : Response.json([[['translated', 'source']], null, 'en']);
  });
  const output = res();
  await translate({ ...request, method: 'POST', body: { text: 'word '.repeat(600), targetLanguage: 'tr' } }, output);
  assert.equal(output.code, 200); assert.equal(output.body.plan, 'owner'); assert.equal(output.body.limit, null); assert.equal(calls, 2);
});
test('non-owner never reaches translation provider', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ ...verified, id: 'other' }); });
  const output = res();
  await translate({ ...request, method: 'POST', body: { text: 'hello', targetLanguage: 'tr' } }, output);
  assert.equal(output.code, 403); assert.equal(calls, 1);
});
test('registration cannot create arbitrary accounts', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({}); });
  const output = res();
  await auth({ method: 'POST', body: { action: 'register', email: 'other@example.com' } }, output);
  assert.equal(output.code, 403); assert.equal(calls, 0);
});
test('founder login still validates returned identity', async t => {
  t.mock.method(globalThis, 'fetch', async url => String(url).includes('grant_type=password') ? Response.json({ access_token: 'token', refresh_token: 'refresh', expires_in: 3600 }) : Response.json({ ...verified, id: 'other' }));
  const output = res();
  await auth({ method: 'POST', body: { action: 'login', email: verified.email, password: 'example-password-only' } }, output);
  assert.equal(output.code, 403); assert.equal(output.body.session, undefined);
});
test('registration waits for confirmation and never grants an unverified session', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ user: { id: 'founder-id' } }));
  const output = res();
  await auth({ method: 'POST', body: { action: 'register', email: verified.email, password: 'example-password-only' } }, output);
  assert.equal(output.code, 200); assert.equal(output.body.confirmEmail, true); assert.equal(output.body.session, undefined);
});
test('confirmed founder email is accepted before ID pinning, not unverified client data', async t => {
  delete process.env.OWNER_USER_ID;
  t.mock.method(globalThis, 'fetch', async () => Response.json(verified));
  assert.equal((await requireOwner(request)).id, verified.id);
  process.env.OWNER_USER_ID = 'founder-id';
});

test('forgot-password does not reveal whether an unrelated address exists', async t => {
  let calls = 0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({});});
  const output=res();
  await auth({method:'POST',body:{action:'forgot-password',email:'other@example.com'}},output);
  assert.equal(output.code,200);assert.equal(output.body.emailSent,true);assert.equal(calls,0);
});
test('reset-password rejects unauthenticated requests before updating any password',async()=>{
 const output=res();await auth({method:'POST',headers:{},body:{action:'reset-password',password:'example-password'}},output);assert.equal(output.code,401);
});
test('reset-password validates identity and updates the password using the user token',async t=>{
 const paths=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{paths.push(String(url));assert.equal(options.headers.Authorization,'Bearer verified-token');return Response.json(String(url).endsWith('/user')&&options.method==='GET'?verified:{});});
 const output=res();await auth({...request,method:'POST',body:{action:'reset-password',password:'example-password'}},output);assert.equal(output.code,200);assert.equal(paths.length,3);
});
