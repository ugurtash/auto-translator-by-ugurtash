import { requireOwner, prepare, fail } from '../lib/owner.js';
export default async function handler(req, res) {
  prepare(res);
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const user = await requireOwner(req);
    return res.status(200).json({ ok: true, email: user.email, plan: 'owner', unlimited: true });
  } catch (error) { return fail(res, error); }
}
