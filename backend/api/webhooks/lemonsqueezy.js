import { ApiError, prepare, fail } from '../../lib/owner.js';
import { billingConfig, lemon, hmac, constantEqual, bindingValue } from '../../lib/billing.js';
import { database } from '../../lib/database.js';
const subscriptionEvents = new Set(['subscription_created','subscription_updated','subscription_cancelled','subscription_resumed','subscription_expired','subscription_paused','subscription_unpaused']);
const invoiceEvents = new Set(['subscription_payment_success','subscription_payment_failed','subscription_payment_recovered','subscription_payment_refunded']);
export default async function handler(req, res) {
  prepare(res);
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const config = billingConfig();
    if (typeof req.rawBody !== 'string') throw new ApiError(400, 'INVALID_BODY', 'Raw request body required.');
    const signature = req.headers?.['x-signature'];
    if (!/^[a-f0-9]{64}$/i.test(signature || '') || !constantEqual(signature.toLowerCase(), await hmac(req.rawBody, config.secret))) throw new ApiError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature.');
    const payload = JSON.parse(req.rawBody);
    const event = payload.meta?.event_name;
    if (!subscriptionEvents.has(event) && !invoiceEvents.has(event)) return res.status(200).json({ ok: true, ignored: true });
    const subscriptionId = subscriptionEvents.has(event) ? payload.data?.id : payload.data?.attributes?.subscription_id;
    if (!/^\d+$/.test(String(subscriptionId || ''))) throw new ApiError(400, 'INVALID_EVENT', 'Invalid subscription.');
    // Fetch the authoritative latest state: delayed events cannot reactivate an expired subscription.
    const current = await lemon('subscriptions/' + subscriptionId);
    const attributes = current.data?.attributes;
    if (!attributes || String(attributes.store_id) !== config.store || String(attributes.variant_id) !== config.variant || attributes.test_mode !== config.test) return res.status(200).json({ ok: true, ignored: true });
    const saved = await database('billing_subscriptions?subscription_id=eq.' + subscriptionId + '&select=user_id&limit=1');
    let userId = saved?.[0]?.user_id;
    if (!userId) {
      userId = payload.meta?.custom_data?.user_id;
      if (!/^[0-9a-f-]{36}$/i.test(userId || '') || !constantEqual(payload.meta?.custom_data?.user_signature, await hmac(bindingValue(userId, config), config.secret))) throw new ApiError(400, 'UNBOUND_PURCHASE', 'Purchase is not linked to a verified account.');
    }
    const end = attributes.status === 'cancelled' || attributes.status === 'expired' ? attributes.ends_at : attributes.status === 'on_trial' ? attributes.trial_ends_at : attributes.renews_at;
    // Reconcile the newest invoice too: a late refund of an old period must not
    // revoke a newer paid renewal, and later payments can restore refunded access.
    const invoices = await lemon('subscription-invoices?filter[subscription_id]=' + subscriptionId + '&sort=-createdAt&page[size]=1');
    const invoice = invoices.data?.[0]?.attributes;
    if (attributes.status !== 'on_trial' && (!invoice || String(invoice.subscription_id) !== String(subscriptionId) || invoice.test_mode !== config.test || String(invoice.store_id) !== config.store)) throw new ApiError(503, 'BILLING_PENDING', 'Payment confirmation pending.');
    const subscriptionUpdated = Date.parse(attributes.updated_at || '');
    const invoiceUpdated = Date.parse(invoice?.updated_at || '');
    if (!Number.isFinite(subscriptionUpdated)) throw new ApiError(400, 'INVALID_EVENT', 'Missing subscription timestamp.');
    const updated = new Date(Math.max(subscriptionUpdated, Number.isFinite(invoiceUpdated) ? invoiceUpdated : 0)).toISOString();
    const refunded = attributes.status !== 'on_trial' && !['paid','partial_refund'].includes(invoice.status);
    const eventKey = await hmac(req.rawBody, config.secret);
    await database('rpc/apply_billing_subscription', { method: 'POST', body: { event_key: eventKey, snapshot: {
      subscription_id: String(subscriptionId), user_id: userId, customer_id: String(attributes.customer_id), store_id: config.store, variant_id: config.variant,
      status: attributes.status, access_until: Number.isFinite(Date.parse(end || '')) ? end : null, test_mode: config.test,
      provider_updated_at: updated, revoked: refunded
    } } });
    return res.status(200).json({ ok: true });
  } catch (error) { return fail(res, error); }
}
