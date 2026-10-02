import { configuration, ApiError, authRequest, requireOwner, prepare, fail, sessionResult } from '../lib/owner.js';
export default async function handler(req, res) {
  prepare(res);
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const body = req.body || {};
    if (body.action === 'register' || body.action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      if (email !== configuration().ownerEmail.toLowerCase()) throw new ApiError(403, 'OWNER_REQUIRED', 'Use your registered founder email.');
      const password = body.password;
      if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new ApiError(400, 'INVALID_PASSWORD', 'Use a password of 12 to 128 characters.');
      const data = await authRequest(body.action === 'register' ? 'signup' : 'token?grant_type=password', { method: 'POST', body: { email, password } });
      if (body.action === 'register' && !data.access_token) return res.status(200).json({ ok: true, confirmEmail: true });
      const session = sessionResult(data);
      const user = await requireOwner({ headers: { authorization: 'Bearer ' + session.access_token } });
      return res.status(200).json({ ok: true, session, email: user.email, plan: 'owner' });
    }
    if (body.action === 'forgot-password') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
      // Always return the same message; do not disclose account existence.
      if (email === configuration().ownerEmail.toLowerCase()) await authRequest('recover', { method: 'POST', body: { email } });
      return res.status(200).json({ ok: true, emailSent: true });
    }
    if (body.action === 'reset-password') {
      await requireOwner(req);
      const password = body.password;
      if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new ApiError(400, 'INVALID_PASSWORD', 'Use a password of 12 to 128 characters.');
      await authRequest('user', { method: 'PUT', token: req.headers.authorization.slice(7), body: { password } });
      try { await authRequest('logout?scope=global', { method: 'POST', token: req.headers.authorization.slice(7) }); } catch { /* Password has changed; sign-out can be retried separately. */ }
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'refresh') {
      if (typeof body.refresh_token !== 'string' || !body.refresh_token || body.refresh_token.length > 4096) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in again.');
      const data = await authRequest('token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: body.refresh_token } });
      const session = sessionResult(data);
      const user = await requireOwner({ headers: { authorization: 'Bearer ' + session.access_token } });
      return res.status(200).json({ ok: true, session, email: user.email, plan: 'owner' });
    }
    if (body.action === 'logout') {
      await requireOwner(req);
      await authRequest('logout?scope=local', { method: 'POST', token: req.headers.authorization.slice(7) });
      return res.status(200).json({ ok: true });
    }
    throw new ApiError(400, 'INVALID_ACTION', 'Unknown account action.');
  } catch (error) { return fail(res, error); }
}
