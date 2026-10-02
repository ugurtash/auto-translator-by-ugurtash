document.addEventListener("DOMContentLoaded", function() {
  var select = document.getElementById("targetLanguage");
  var usage = document.getElementById("usage");
  var saved = document.getElementById("saved");
  var translationEnabled = document.getElementById("translationEnabled");
  var accountButton = document.getElementById("accountButton");
  accountButton.addEventListener("click", function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var page = tabs[0];
      chrome.storage.session.set({ accountReturnPage: page ? { tabId: page.id, windowId: page.windowId } : null }, function() {
        chrome.runtime.openOptionsPage(function() {
          if (chrome.runtime.lastError && saved) saved.textContent = "Could not open account settings. Please try again.";
        });
      });
    });
  });

  function getToday() {
    var now = new Date();
    return now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
  }

  function updateUsage() {
    if (!usage) return;

    chrome.runtime.sendMessage({ type: "owner-status" }, function(account) {
      if (chrome.runtime.lastError || (account && !account.ok)) {
        usage.textContent = "Account check unavailable. Reopen to retry.";
        return;
      }
      accountButton.textContent = account && account.signedIn ? "Account" : "Sign in";
      document.getElementById("upgrade").hidden = !!(account && account.unlimited);
      if (account && account.unlimited) {
        usage.textContent = "Today: Unlimited";
        return;
      }
      chrome.storage.local.get(["usageDate", "dailyWords"], function(data) {
        var words = data.usageDate === getToday() ? Number(data.dailyWords || 0) : 0;
        usage.textContent = "Today: " + words + " / 500 words";
      });
    });
  }

  chrome.storage.local.get(
    ["targetLanguage", "translationEnabled"],
    function(data) {
      if (data.targetLanguage) {
        select.value = data.targetLanguage;
      }

      if (translationEnabled) {
        translationEnabled.checked = data.translationEnabled !== false;
      }

      updateUsage();
    }
  );

  if (translationEnabled) {
    translationEnabled.addEventListener("change", function() {
      chrome.storage.local.set({
        translationEnabled: translationEnabled.checked
      }, function() {
        if (saved) {
          saved.textContent = translationEnabled.checked
            ? "Translation enabled"
            : "Translation disabled";

          setTimeout(function() {
            saved.textContent = "";
          }, 1200);
        }
      });
    });
  }

  select.addEventListener("change", function() {
    var value = select.value;

    if (!value) {
      chrome.storage.local.remove("targetLanguage", function() {
        if (saved) {
          saved.textContent = "Choose a language to enable translation.";
        }
        updateUsage();
      });
      return;
    }

    chrome.storage.local.set({
      targetLanguage: value
    }, function() {
      if (saved) {
        saved.textContent = "Saved";

        setTimeout(function() {
          saved.textContent = "";
        }, 1200);
      }

      updateUsage();
    });
  });

  updateUsage();
});


document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("upgrade").addEventListener("click", function() {
    document.getElementById("accountButton").click();
  });
});
