var ownerRefreshPromise = null;
var ownerSessionEpoch = 0;
var ownerStorageReady = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
function ownerBackendUrl() {
  var configured = globalThis.AUTO_TRANSLATOR_ACCOUNT.backendUrl;
  if (!configured) throw new Error('Account sign-in is currently unavailable.');
  var url = new URL(configured);
  if (url.protocol !== 'https:') throw new Error('Account service must use HTTPS.');
  return configured.replace(/\/$/, "");
}
async function ownerFetch(path, body, token) {
  var response = await fetch(ownerBackendUrl() + '/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000), cache: 'no-store'
  });
  var result = await response.json();
  if (!response.ok || !result.ok) {
    var error = new Error(result.error || 'Account service unavailable.');
    error.code = result.code;
    throw error;
  }
  return result;
}
async function ownerSession() {
  await ownerStorageReady;
  var data = await chrome.storage.local.get('ownerSession');
  var session = data.ownerSession;
  if (!session) return null;
  if (session.expires_at > Date.now() / 1000 + 60) return session;
  if (!ownerRefreshPromise) {
    var epoch = ownerSessionEpoch;
    ownerRefreshPromise = (async function() {
      try {
        var result = await ownerFetch('auth', { action: 'refresh', refresh_token: session.refresh_token });
        if (epoch !== ownerSessionEpoch) throw new Error('Account changed. Please sign in again.');
        await chrome.storage.local.set({ ownerSession: result.session });
        return result.session;
      } catch (error) {
        if (epoch === ownerSessionEpoch && ['AUTH_REQUIRED', 'OWNER_REQUIRED'].includes(error.code)) await chrome.storage.local.remove('ownerSession');
        throw error;
      } finally { ownerRefreshPromise = null; }
    })();
  }
  return ownerRefreshPromise;
}
async function ownerAccountStatus() {
  if (!globalThis.AUTO_TRANSLATOR_ACCOUNT.backendUrl) return { ok: true, configured: false, signedIn: false };
  var session = await ownerSession();
  if (!session) return { ok: true, configured: true, signedIn: false };
  var result;
  try { result = await ownerFetch('account', null, session.access_token); }
  catch (error) {
    if (['AUTH_REQUIRED', 'OWNER_REQUIRED'].includes(error.code)) {
      ++ownerSessionEpoch;
      await chrome.storage.local.remove('ownerSession');
      return { ok: true, configured: true, signedIn: false };
    }
    throw error;
  }
  return { ok: true, configured: true, signedIn: true, email: result.email, plan: result.plan, unlimited: result.unlimited };
}
async function ownerTranslate(text, targetLanguage) {
  var session = await ownerSession();
  if (!session) return null;
  // The server checks owner access for every translation; local flags grant nothing.
  return ownerFetch('translate', { text, targetLanguage }, session.access_token);
}
async function handleOwnerMessage(message) {
  if (message.type === 'owner-status') return ownerAccountStatus();
  if (message.type === 'owner-login' || message.type === 'owner-register') {
    var epoch = ++ownerSessionEpoch;
    var result = await ownerFetch('auth', { action: message.type === 'owner-login' ? 'login' : 'register', email: message.email, password: message.password });
    if (epoch !== ownerSessionEpoch) throw new Error('Account changed. Please try again.');
    if (result.confirmEmail) return result;
    await ownerStorageReady;
    await chrome.storage.local.set({ ownerSession: result.session });
    return ownerAccountStatus();
  }
  if (message.type === 'owner-logout') {
    var data = await chrome.storage.local.get('ownerSession');
    ++ownerSessionEpoch;
    await chrome.storage.local.remove('ownerSession');
    if (data.ownerSession) await ownerFetch('auth', { action: 'logout' }, data.ownerSession.access_token);
    return { ok: true };
  }
  throw new Error('Unknown account action.');
}
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (!message || !message.type?.startsWith('owner-')) return;
  // Account actions are only available to trusted extension pages, never website content scripts.
  if (sender.id !== chrome.runtime.id || ![chrome.runtime.getURL('popup.html'), chrome.runtime.getURL('account.html')].includes(sender.url)) {
    sendResponse({ ok: false, error: 'Account action not allowed.' }); return;
  }
  if (sender.url === chrome.runtime.getURL('popup.html') && message.type !== 'owner-status') {
    sendResponse({ ok: false, error: 'Open account settings to sign in.' }); return;
  }
  handleOwnerMessage(message).then(sendResponse, function(error) { sendResponse({ ok: false, error: error.message, code: error.code }); });
  return true;
});
