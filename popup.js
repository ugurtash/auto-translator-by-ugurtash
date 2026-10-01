document.addEventListener("DOMContentLoaded", function() {
  var select = document.getElementById("targetLanguage");
  var usage = document.getElementById("usage");
  var saved = document.getElementById("saved");
  var translationEnabled = document.getElementById("translationEnabled");

  function getToday() {
    var now = new Date();
    return now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
  }

  function updateUsage() {
    if (!usage) return;

    chrome.storage.local.get(
      ["usageDate", "dailyWords", "premium"],
      function(data) {
        var today = getToday();

        if (data.usageDate !== today) {
          chrome.storage.local.set({
            usageDate: today,
            dailyWords: 0
          }, function() {
            usage.textContent = "Today: 0 / 500 words";
          });
          return;
        }

        var words = Number(data.dailyWords || 0);

        if (data.premium) {
          usage.textContent = "Today: Unlimited";
        } else {
          usage.textContent = "Today: " + words + " / 500 words";
        }
      }
    );
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
  var upgradeButton = document.getElementById("upgrade");

  if (!upgradeButton) {
    return;
  }

  upgradeButton.addEventListener("click", function() {
    window.open("https://auto-translator-by-ugurtash.lemonsqueezy.com/checkout/buy/2269476f-19bf-4668-9afb-135b2aaa285b", "_blank");
  });
});
