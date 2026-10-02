document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('accountForm');
  var status = document.getElementById('accountStatus');
  var notice = document.getElementById('accountMessage');
  var signOut = document.getElementById('signOut');
  var email = document.getElementById('accountEmail');
  var password = document.getElementById('accountPassword');
  async function request(message) {
    var result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || 'Account service unavailable.');
    return result;
  }
  async function refresh() {
    var account = await request({ type: 'owner-status' });
    form.hidden = !account.configured || account.signedIn;
    signOut.hidden = !account.signedIn;
    status.textContent = account.signedIn ? account.email + ' — Founder: Unlimited' : account.configured ? 'Sign in to your founder account' : 'Founder sign-in is awaiting service setup.';
    document.getElementById('upgrade').hidden = account.signedIn;
    if (account.unlimited) document.getElementById('usage').textContent = 'Founder account: Unlimited';
  }
  async function run(action) {
    var buttons = document.querySelectorAll('.account button');
    buttons.forEach(button => { button.disabled = true; });
    notice.textContent = '';
    try { await action(); } catch (error) { notice.textContent = error.message; }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  }
  async function authenticate(type) {
    if (!form.reportValidity()) return;
    await run(async function() {
      var result;
      try { result = await request({ type, email: email.value.trim(), password: password.value }); }
      finally { password.value = ''; }
      if (result.confirmEmail) {
        notice.textContent = 'Check your email and click the confirmation link. Then return here and sign in.';
        return;
      }
      await refresh();
    });
  }
  document.getElementById('accountRegister').addEventListener('click', function() { authenticate('owner-register'); });
  form.addEventListener('submit', function(event) { event.preventDefault(); authenticate('owner-login'); });
  signOut.addEventListener('click', function() {
    run(async function() {
      try { await request({ type: 'owner-logout' }); }
      finally { await refresh(); document.getElementById('usage').textContent = 'Free use: 500 words per day'; }
    });
  });
  run(refresh);
});
