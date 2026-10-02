document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('accountForm');
  var status = document.getElementById('accountStatus');
  var notice = document.getElementById('accountMessage');
  var signOut = document.getElementById('signOut');
  var email = document.getElementById('accountEmail');
  var continueButton = document.getElementById('continueButton');
  var remember = document.getElementById('rememberMe');
  var password = document.getElementById('accountPassword');
  async function request(message) {
    var result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.code === 'OWNER_REQUIRED' ? 'This account does not have access.' : result?.error || 'Account service unavailable.');
    return result;
  }
  async function returnToTranslation() {
    var current = await chrome.tabs.getCurrent();
    return request({ type: 'owner-return-to-page', accountTabId: current && current.id });
  }
  async function refresh() {
    var account = await request({ type: 'owner-status' });
    form.hidden = !account.configured || account.signedIn;
    signOut.hidden = !account.signedIn;
    continueButton.hidden = !account.signedIn;
    status.textContent = account.signedIn ? account.email + ' — Unlimited' : account.configured ? 'Sign in to your account' : 'Account sign-in is currently unavailable.';

  }
  async function run(action) {
    var buttons = document.querySelectorAll('.account button');
    buttons.forEach(button => { button.disabled = true; });
    notice.dataset.kind = 'success';
    notice.textContent = 'Please wait…';
    try { await action(); } catch (error) { notice.dataset.kind = 'error'; notice.textContent = error.message; }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  }
  async function authenticate(type) {
    if (!form.reportValidity()) return;
    await run(async function() {
      var result;
      try { result = await request({ type, email: email.value.trim(), password: password.value, remember: remember.checked }); }
      finally { password.value = ''; }
      if (result.confirmEmail) {
        notice.textContent = 'Confirmation email sent to ' + email.value.trim() + '. Check your inbox and spam folder, confirm your email, then sign in here.';
        return;
      }
      await refresh();
      notice.textContent = 'Signed in successfully. You can continue translating.';
      await returnToTranslation();
    });
  }
  document.getElementById('forgotPassword').addEventListener('click', function() {
    if (!email.reportValidity()) return;
    run(async function() {
      await request({ type: 'owner-forgot-password', email: email.value.trim() });
      notice.textContent = 'If this email has an account, a password reset link has been sent. Check your inbox and spam folder.';
    });
  });
  continueButton.addEventListener('click', function() { run(async function() { await returnToTranslation(); notice.textContent = 'Open Auto-Translator from the toolbar to continue.'; }); });
  document.getElementById('accountRegister').addEventListener('click', function() { authenticate('owner-register'); });
  form.addEventListener('submit', function(event) { event.preventDefault(); authenticate('owner-login'); });
  signOut.addEventListener('click', function() {
    run(async function() {
      try { await request({ type: 'owner-logout' }); }
      finally { await refresh(); }
    });
  });
  run(async function() { await refresh(); notice.textContent = ''; });
});
