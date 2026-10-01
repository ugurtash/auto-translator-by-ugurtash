var translationCache = new Map();
var FREE_DAILY_WORD_LIMIT = 500;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function countWords(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

function getUsage() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(["usageDate", "dailyWords", "premium"], function(data) {
      var today = todayKey();
      if (data.usageDate !== today) {
        chrome.storage.local.set({ usageDate: today, dailyWords: 0 }, function() {
          resolve({ words: 0, premium: !!data.premium });
        });
        return;
      }
      resolve({ words: Number(data.dailyWords || 0), premium: !!data.premium });
    });
  });
}

function addUsage(words) {
  return new Promise(function(resolve) {
    chrome.storage.local.get(["usageDate", "dailyWords"], function(data) {
      var today = todayKey();
      var current = data.usageDate === today ? Number(data.dailyWords || 0) : 0;
      var next = current + words;
      chrome.storage.local.set({ usageDate: today, dailyWords: next }, function() {
        resolve(next);
      });
    });
  });
}

async function translate(text, targetLanguage) {
  var key = targetLanguage + "|" + text;
  if (translationCache.has(key)) return translationCache.get(key);

  var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
    encodeURIComponent(targetLanguage) + "&dt=t&q=" + encodeURIComponent(text);

  var controller = new AbortController();
  var timeout = setTimeout(function() { controller.abort(); }, 8000);

  try {
    var response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Translation request failed");
    var data = await response.json();
    var result = data && data[0]
      ? data[0].map(function(part) { return part && part[0] ? part[0] : ""; }).join("").trim()
      : "";

    if (!result) throw new Error("Translation not found");

    translationCache.set(key, result);
    if (translationCache.size > 200) {
      var firstKey = translationCache.keys().next().value;
      translationCache.delete(firstKey);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (!message || message.type !== "TRANSLATE") return;

  (async function() {
    try {
      var text = String(message.text || "").trim();
      var targetLanguage = String(message.targetLanguage || "").trim();

      if (!text || !targetLanguage) {
        sendResponse({ ok: false, error: "Missing translation data." });
        return;
      }

      var words = countWords(text);
      var usage = await getUsage();

      if (!usage.premium && usage.words + words > FREE_DAILY_WORD_LIMIT) {
        sendResponse({ ok: false, error: "Daily free limit reached (500 words). Upgrade for unlimited use." });
        return;
      }

      var result = await translate(text, targetLanguage);

      if (!usage.premium) await addUsage(words);
      sendResponse({ ok: true, result: result });
    } catch (error) {
      sendResponse({ ok: false, error: error && error.name === "AbortError" ? "Translation timed out." : "Translation error." });
    }
  })();

  return true;
});
