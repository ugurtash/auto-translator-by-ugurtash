import { requireUser, prepare, fail } from '../lib/owner.js';
import { ensureProfile } from '../lib/database.js';
import { entitlement, billingReady } from '../lib/billing.js';
export default async function handler(req, res) {
  prepare(res);
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const user = await requireUser(req);
    await ensureProfile(user);
    const access = await entitlement(user);
    return res.status(200).json({ ok: true, email: user.email, ...access, billingAvailable: billingReady() });
  } catch (error) { return fail(res, error); }
}
