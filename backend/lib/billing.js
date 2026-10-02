import { BILLING_TEST_MODE } from './deployment-config.js';
import { ApiError, isOwner } from './owner.js';
import { database, env } from './database.js';
export function billingConfig() {
  const prefix = BILLING_TEST_MODE ? 'LEMON_SQUEEZY_TEST_' : 'LEMON_SQUEEZY_';
  const config = { key: env(prefix + 'API_KEY'), secret: env(prefix + 'WEBHOOK_SECRET'), store: env(prefix + 'STORE_ID'), variant: env(prefix + 'VARIANT_ID'), test: BILLING_TEST_MODE };
  if (env('BILLING_TEST_MODE') === 'true' && !BILLING_TEST_MODE) throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Live subscriptions are not available yet.');
  if (!config.key || !config.secret || !/^\d+$/.test(config.store || '') || !/^\d+$/.test(config.variant || '')) throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Subscriptions are not available yet.');
  return config;
}
export function billingReady() { try { billingConfig(); return true; } catch { return false; } }
export async function lemon(path, body) {
  const config = billingConfig();
  const response = await fetch('https://api.lemonsqueezy.com/v1/' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + config.key, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new ApiError(503, 'BILLING_UNAVAILABLE', 'Billing is temporarily unavailable. Please retry.');
  return response.json();
}
export function subscriptionAccess(row, now = Date.now()) {
  if (!row || row.revoked) return false;
  const end = Date.parse(row.access_until || '');
  if (!Number.isFinite(end) || end <= now) return false;
  return ['active', 'on_trial', 'cancelled'].includes(row.status);
}
export async function entitlement(user) {
  if (isOwner(user)) return { plan: 'owner', unlimited: true };
  const rows = await database('billing_subscriptions?user_id=eq.' + encodeURIComponent(user.id) + '&test_mode=eq.false&select=status,access_until,revoked');
  const paid = rows?.some(row => subscriptionAccess(row));
  return { plan: paid ? 'premium' : 'free', unlimited: !!paid };
}
export async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
export function constantEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i); return difference === 0;
}
export function bindingValue(userId, config) { return [userId, config.store, config.variant, String(config.test)].join('|'); }
