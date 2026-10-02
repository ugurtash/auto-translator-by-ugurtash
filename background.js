importScripts("account-config.js", "account-worker.js");

function getToday() {
  var now = new Date();
  return now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
}

function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function getStorage(keys) {
  return new Promise(function(resolve) {
    chrome.storage.local.get(keys, function(result) {
      resolve(result || {});
    });
  });
}

function setStorage(data) {
  return new Promise(function(resolve) {
    chrome.storage.local.set(data, function() {
      resolve();
    });
  });
}

async function getUsage() {
  var data = await getStorage([
    "usageDate",
    "dailyWords",
    "premium"
  ]);

  var today = getToday();

  if (data.usageDate !== today) {
    await setStorage({
      usageDate: today,
      dailyWords: 0
    });

    return {
      words: 0,
      premium: false
    };
  }

  return {
    words: Number(data.dailyWords || 0),
    premium: false
  };
}

async function translateText(text, targetLanguage) {
  var url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    "&sl=auto" +
    "&tl=" + encodeURIComponent(targetLanguage) +
    "&dt=t" +
    "&q=" + encodeURIComponent(text);

  var response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (response.status === 429) {
    var retryAfter = response.headers.get("Retry-After");
    var waitSeconds = retryAfter ? Number(retryAfter) : 1;
    if (!Number.isFinite(waitSeconds) && retryAfter) waitSeconds = (Date.parse(retryAfter) - Date.now()) / 1000;
    if (Number.isFinite(waitSeconds) && waitSeconds >= 0 && waitSeconds <= 5) {
      await new Promise(function(resolve) { setTimeout(resolve, Math.max(1000, waitSeconds * 1000)); });
      response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    }
  }
  if (!response.ok) {
    if (response.status === 429) throw new Error("Translation service is busy. Please try again shortly.");
    throw new Error("Translation service could not complete this request. Please try again.");
  }

  var data = await response.json();

  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Invalid translation response.");
  }

  var translated = data[0]
    .map(function(item) {
      return item && item[0] ? item[0] : "";
    })
    .join("");

  if (!translated) {
    throw new Error("Empty translation.");
  }

  var sourceLanguage = "";

  if (typeof data[2] === "string") {
    sourceLanguage = data[2];
  }

  return {
    translation: translated,
    sourceLanguage: sourceLanguage
  };
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message && message.type === "translation-settings") {
    getStorage(["translationEnabled"]).then(function(data) {
      sendResponse({ translationEnabled: data.translationEnabled !== false });
    });
    return true;
  }
  if (!message || message.type !== "translate") {
    return;
  }

  (async function() {
    try {
      var text = String(message.text || "").trim();

      if (!text) {
        throw new Error("No text selected.");
      }

      var settings = await getStorage(["targetLanguage"]);
      var targetLanguage = settings.targetLanguage;

      if (!targetLanguage) {
        sendResponse({
          ok: false,
          code: "NO_TARGET_LANGUAGE",
          error: "Please choose a target language first."
        });
        return;
      }

      var ownerResult = await ownerTranslate(text, targetLanguage);
      if (ownerResult) {
        sendResponse(ownerResult);
        return;
      }

      var usage = await getUsage();
      var words = countWords(text);

      if (!usage.premium && usage.words + words > 500) {
        sendResponse({
          ok: false,
          code: "LIMIT_REACHED",
          used: usage.words,
          limit: 500
        });
        return;
      }

      var result = await translateText(text, targetLanguage);

      if (!usage.premium) {
        await setStorage({
          usageDate: getToday(),
          dailyWords: usage.words + words
        });
      }

      sendResponse({
        ok: true,
        translation: result.translation,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: targetLanguage,
        used: usage.premium ? usage.words : usage.words + words,
        limit: 500,
        premium: usage.premium
      });
    } catch (error) {
      sendResponse({
        ok: false,
        code: "TRANSLATION_ERROR",
        error: error && error.message
          ? error.message
          : "Translation failed."
      });
    }
  })();

  return true;
});
