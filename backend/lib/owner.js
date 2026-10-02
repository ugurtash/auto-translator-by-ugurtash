import { OWNER_EMAIL, OWNER_USER_ID } from './deployment-config.js';
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function configuration() {
  const env = globalThis.Deno ? { SUPABASE_URL: Deno.env.get('SUPABASE_URL'), SUPABASE_PUBLISHABLE_KEY: Deno.env.get('SUPABASE_ANON_KEY'), OWNER_USER_ID: Deno.env.get('OWNER_USER_ID'), OWNER_EMAIL: Deno.env.get('OWNER_EMAIL') } : process.env;
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env;
  const ownerId = env.OWNER_USER_ID || OWNER_USER_ID;
  const ownerEmail = env.OWNER_EMAIL || OWNER_EMAIL;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || (!ownerId && !ownerEmail)) {
    throw new ApiError(503, 'NOT_CONFIGURED', 'Account service is not configured yet.');
  }
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== 'https:') throw new ApiError(503, 'NOT_CONFIGURED', 'Account service is not configured yet.');
  return { url: url.origin, key: SUPABASE_PUBLISHABLE_KEY, ownerId, ownerEmail };
}
export async function authRequest(path, { method = 'GET', body, token } = {}) {
  const config = configuration();
  const response = await fetch(config.url + '/auth/v1/' + path, {
    method, headers: { apikey: config.key, ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, 'TRY_LATER', 'Please wait before trying again.');
    if (response.status >= 500) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Account service is temporarily unavailable.');
    throw new ApiError(401, 'AUTH_REQUIRED', 'Check your email and password, and confirm your email before signing in.');
  }
  return data;
}
export async function requireUser(req) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers?.authorization || '');
  if (!match) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to your account.');
  const user = await authRequest('user', { token: match[1] });
  if (!user.id || !user.email || !user.email_confirmed_at || user.is_anonymous) throw new ApiError(401, 'AUTH_REQUIRED', 'Confirm your email and sign in again.');
  return user;
}
export function isOwner(user) {
  const config = configuration();
  return config.ownerId ? user.id === config.ownerId : user.email.toLowerCase() === config.ownerEmail.toLowerCase();
}
export async function requireOwner(req) {
  const user = await requireUser(req);
  if (!isOwner(user)) throw new ApiError(403, 'OWNER_REQUIRED', 'This account does not have access.');
  return user;
}
export function prepare(res) { res.setHeader('Cache-Control', 'no-store'); }
export function fail(res, error) {
  return res.status(error instanceof ApiError ? error.status : 503).json({
    ok: false, code: error instanceof ApiError ? error.code : 'SERVICE_UNAVAILABLE',
    error: error instanceof ApiError ? error.message : 'Service temporarily unavailable. Please try again.'
  });
}
export function sessionResult(data) {
  if (!data.access_token || !data.refresh_token || !data.expires_in) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in again.');
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in) };
}
