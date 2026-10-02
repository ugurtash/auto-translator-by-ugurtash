import { ApiError, requireOwner, prepare, fail } from '../lib/owner.js';
export default async function handler(req, res) {
  prepare(res);
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    await requireOwner(req);
    const { text, targetLanguage } = req.body || {};
    if (typeof text !== 'string' || !text.trim() || typeof targetLanguage !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(targetLanguage)) {
      throw new ApiError(400, 'INVALID_INPUT', 'Text and a valid target language are required.');
    }
    // A transport safeguard, not a daily word quota.
    if (text.length > 12000) throw new ApiError(413, 'REQUEST_TOO_LARGE', 'Select a shorter passage (up to 12,000 characters).');
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.search = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: targetLanguage, dt: 't', q: text }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new ApiError(502, 'TRANSLATION_ERROR', 'Translation service temporarily unavailable.');
    const data = await response.json();
    if (!Array.isArray(data?.[0])) throw new ApiError(502, 'TRANSLATION_ERROR', 'Invalid translation response.');
    const translation = data[0].map(item => item?.[0] || '').join('');
    if (!translation) throw new ApiError(502, 'TRANSLATION_ERROR', 'Empty translation response.');
    return res.status(200).json({ ok: true, translation, sourceLanguage: typeof data[2] === 'string' ? data[2] : '', targetLanguage, premium: true, plan: 'owner', limit: null });
  } catch (error) { return fail(res, error); }
}
