// Read callback credentials before loading page content; keep them in memory only.
(function() {
  var params = new URLSearchParams(location.hash.slice(1));
  var token = params.get('access_token');
  var recovery = params.get('type') === 'recovery';
  var hasError = !!params.get('error') || !!params.get('error_description');
  history.replaceState(null, '', location.pathname);
  params = null;
  document.addEventListener('DOMContentLoaded', async function() {
    var heading = document.getElementById('heading');
    var message = document.getElementById('message');
    var hint = document.getElementById('returnHint');
    var form = document.getElementById('resetForm');
    var endpoint = 'https://cxxbcamghmyttgqikfak.supabase.co/functions/v1/owner-access/';
    if (hasError || !token) {
      message.textContent = 'This link is invalid or expired. Request a new email from Auto-Translator.';
      hint.hidden = false; token = null; return;
    }
    try {
      var response = await fetch(endpoint + 'account', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      var result = await response.json();
      if (!response.ok || !result.ok) throw new Error('This link is invalid or expired. Request a new email from Auto-Translator.');
      if (!recovery) { token = null; message.textContent = 'Email confirmed. Your account is ready to sign in.'; hint.hidden = false; return; }
      heading.textContent = 'Reset your password';
      message.textContent = 'Choose a new password of at least 12 characters.';
      form.hidden = false;
    } catch (error) { token = null; message.textContent = error.message; hint.hidden = false; return; }
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      var password = document.getElementById('newPassword');
      var repeat = document.getElementById('repeatPassword');
      if (password.value !== repeat.value) { message.textContent = 'The passwords do not match.'; return; }
      var button = document.getElementById('resetSubmit');
      button.disabled = true; message.textContent = 'Saving your password…';
      try {
        var response = await fetch(endpoint + 'auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'reset-password', password: password.value }), cache: 'no-store', signal: AbortSignal.timeout(30000) });
        var result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not reset your password. Request a new link.');
        token = null; form.hidden = true; hint.hidden = false;
        message.textContent = 'Password updated. Sign in to Auto-Translator with your new password.';
      } catch (error) { message.textContent = error.message; }
      finally { password.value = ''; repeat.value = ''; button.disabled = false; }
    });
  });
})();
