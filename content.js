(function() {
  "use strict";

  var currentPopup = null;
  var currentRequestId = 0;

  function removePopup() {
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
  }

  function createPopup(x, y) {
    removePopup();

    var popup = document.createElement("div");

    popup.id = "ugur-translate-popup";

    popup.style.cssText =
      "position:fixed;" +
      "z-index:2147483647;" +
      "max-width:420px;" +
      "min-width:180px;" +
      "padding:12px 14px;" +
      "background:#111;" +
      "color:#fff;" +
      "border-radius:10px;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.28);" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "font-size:14px;" +
      "line-height:1.45;" +
      "word-break:break-word;";

    popup.style.left = Math.min(
      Math.max(10, x),
      window.innerWidth - 440
    ) + "px";

    popup.style.top = Math.min(
      Math.max(10, y + 10),
      window.innerHeight - 100
    ) + "px";

    popup.textContent = "Translating...";

    document.documentElement.appendChild(popup);

    currentPopup = popup;

    return popup;
  }

  function showResult(
    popup,
    originalText,
    translation,
    targetLanguage,
    sourceLanguage
  ) {
    if (!popup || !popup.isConnected) {
      return;
    }

    popup.textContent = "";

    var row = document.createElement("div");

    row.style.cssText =
      "display:flex;" +
      "align-items:flex-start;" +
      "gap:8px;";

    var text = document.createElement("div");

    text.textContent = translation;

    text.style.cssText =
      "flex:1;" +
      "font-weight:500;";

    var audioButton = document.createElement("button");

    audioButton.type = "button";
    audioButton.textContent = "🔊";
    audioButton.title = "Listen to the original text";

    audioButton.style.cssText =
      "border:0;" +
      "background:transparent;" +
      "color:#fff;" +
      "cursor:pointer;" +
      "font-size:16px;" +
      "padding:0;" +
      "line-height:1;";

    audioButton.addEventListener("click", function(event) {
      event.stopPropagation();

      try {
        if (!sourceLanguage) {
          console.warn(
            "Auto-Translator: source language was not detected."
          );
          return;
        }

        window.speechSynthesis.cancel();

        var utterance =
          new SpeechSynthesisUtterance(originalText);

        utterance.lang = sourceLanguage;

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("Speech error:", error);
      }
    });

    row.appendChild(text);

    popup.appendChild(row);

    var closeButton = document.createElement("button");

    closeButton.type = "button";
    closeButton.textContent = "×";

    closeButton.style.cssText =
      "position:absolute;" +
      "top:4px;" +
      "right:7px;" +
      "border:0;" +
      "background:transparent;" +
      "color:#aaa;" +
      "cursor:pointer;" +
      "font-size:18px;" +
      "line-height:1;";

    closeButton.addEventListener("click", function(event) {
      event.stopPropagation();
      removePopup();
    });

    popup.style.position = "fixed";

    popup.appendChild(closeButton);
  }

  function showError(popup, message) {
    if (!popup || !popup.isConnected) {
      return;
    }

    popup.textContent = message;
    popup.style.color = "#ffb4b4";
  }

  function getSelectedText() {
    var selection = window.getSelection();

    if (!selection) {
      return "";
    }

    return selection.toString().trim();
  }

  function getSelectionPosition() {
    var selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return {
        x: 20,
        y: 20
      };
    }

    var range = selection.getRangeAt(0);
    var rect = range.getBoundingClientRect();

    var x = rect.left;
    var y = rect.bottom;

    if (!Number.isFinite(x)) {
      x = 20;
    }

    if (!Number.isFinite(y)) {
      y = 20;
    }

    return {
      x: x,
      y: y
    };
  }

  function requestTranslation(text, x, y) {
    var requestId = ++currentRequestId;
    var popup = createPopup(x, y);

    chrome.runtime.sendMessage(
      {
        type: "translate",
        text: text
      },
      function(response) {
        if (requestId !== currentRequestId) {
          return;
        }

        if (chrome.runtime.lastError) {
          showError(
            popup,
            "Translation error. Please reload the page."
          );

          console.error(
            "Auto-Translator:",
            chrome.runtime.lastError.message
          );

          return;
        }

        if (!response || !response.ok) {
          if (response && response.code === "NO_TARGET_LANGUAGE") {
            showError(
              popup,
              "Choose a target language in the extension."
            );

            return;
          }

          if (response && response.code === "LIMIT_REACHED") {
            showError(
              popup,
              "Daily limit reached: 500 words."
            );

            return;
          }

          showError(
            popup,
            response && response.error
              ? response.error
              : "Translation failed."
          );

          return;
        }

        showResult(
          popup,
          text,
          response.translation,
          response.targetLanguage,
          response.sourceLanguage
        );
      }
    );
  }

  function handleSelection() {
    var text = getSelectedText();

    if (!text) {
      return;
    }

    var position = getSelectionPosition();

    chrome.storage.local.get(["translationEnabled"], function(data) {
      if (data.translationEnabled === false) {
        return;
      }

      requestTranslation(
        text,
        position.x,
        position.y
      );
    });
  }

  document.addEventListener(
    "mouseup",
    function(event) {
      if (
        currentPopup &&
        currentPopup.contains(event.target)
      ) {
        return;
      }

      setTimeout(function() {
        handleSelection();
      }, 0);
    },
    false
  );

  document.addEventListener(
    "dblclick",
    function() {
      setTimeout(function() {
        handleSelection();
      }, 0);
    },
    false
  );

  document.addEventListener(
    "mousedown",
    function(event) {
      if (
        currentPopup &&
        !currentPopup.contains(event.target)
      ) {
        removePopup();
      }
    },
    false
  );
})();
