import { requireUser, prepare, fail, ApiError } from '../lib/owner.js';
import { ensureProfile } from '../lib/database.js';
import { billingConfig, entitlement, lemon, hmac, bindingValue } from '../lib/billing.js';
export default async function handler(req, res) {
  prepare(res);
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const user = await requireUser(req);
    await ensureProfile(user);
    if ((await entitlement(user)).unlimited) throw new ApiError(409, 'ALREADY_UNLIMITED', 'Your account already has unlimited access.');
    const config = billingConfig();
    const signature = await hmac(bindingValue(user.id, config), config.secret);
    const data = await lemon('checkouts', { data: { type: 'checkouts', attributes: {
      test_mode: config.test,
      product_options: { redirect_url: 'https://ugurtash.github.io/auto-translator-by-ugurtash/purchase-complete.html' },
      checkout_data: { email: user.email, custom: { user_id: user.id, user_signature: signature } }
    }, relationships: { store: { data: { type: 'stores', id: config.store } }, variant: { data: { type: 'variants', id: config.variant } } } } });
    const url = new URL(data?.data?.attributes?.url || '');
    if (url.protocol !== 'https:' || !(url.hostname === 'lemonsqueezy.com' || url.hostname.endsWith('.lemonsqueezy.com'))) throw new ApiError(503, 'BILLING_UNAVAILABLE', 'Could not open checkout.');
    return res.status(200).json({ ok: true, url: url.href });
  } catch (error) { return fail(res, error); }
}
