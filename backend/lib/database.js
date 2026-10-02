import { configuration, ApiError } from './owner.js';
export function env(name) { return globalThis.Deno ? Deno.env.get(name) : process.env[name]; }
export async function database(path, { method = 'GET', body, prefer } = {}) {
  const config = configuration();
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'Account storage is not available yet.');
  const response = await fetch(config.url + '/rest/v1/' + path, {
    method, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Could not update your account. Please retry.');
  if (response.status === 204 || response.headers.get('content-length') === '0') return null;
  return response.json().catch(() => null);
}
export async function ensureProfile(user) {
  // Never accept a profile ID, role or verified email from client input.
  await database('profiles?on_conflict=id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { id: user.id, email: user.email, updated_at: new Date().toISOString() } });
}
