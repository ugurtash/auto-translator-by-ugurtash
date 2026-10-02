import auth from '../api/auth.js';
import account from '../api/account.js';
import translate from '../api/translate.js';
import checkout from '../api/checkout.js';
import webhook from '../api/webhooks/lemonsqueezy.js';
Deno.serve(async (request: Request) => {
  // The login routes are public, but verification is performed by Supabase Auth.
  // Account/translation routes require a validated, confirmed user session.
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  const route = url.pathname.split('/').filter(Boolean).pop();
  if (route === 'confirmed') {
    return new Response('Auto-Translator: Return to the extension and sign in with your email and password. If the confirmation link failed or expired, create the account again to request a new email.', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
  const handlers = { auth, account, translate, checkout, webhook };
  const handler = handlers[route as keyof typeof handlers];
  const headers = new Headers({ ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (!handler) return new Response(JSON.stringify({ ok: false, error: 'Not found.' }), { status: 404, headers });
  let body = undefined; let rawBody = undefined;
  if (request.method === 'POST') {
    // Bound memory use and do not log emails, codes, tokens or translated text.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.length;
        if (length > 65536) { await reader.cancel(); return new Response(JSON.stringify({ ok: false, error: 'Request too large.' }), { status: 413, headers }); }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    rawBody = new TextDecoder().decode(bytes);
    try { body = JSON.parse(rawBody); }
    catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON.' }), { status: 400, headers }); }
  }
  let statusCode = 200; let payload;
  const res = {
    setHeader(name: string, value: string) { headers.set(name, value); },
    status(code: number) { statusCode = code; return this; },
    json(data: unknown) { payload = data; }
  };
  await handler({ method: request.method, headers: { authorization: request.headers.get('authorization') || '', 'x-signature': request.headers.get('x-signature') || '' }, body, rawBody }, res);
  return new Response(JSON.stringify(payload), { status: statusCode, headers });
});
