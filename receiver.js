(function () {
  "use strict";

  const DEFAULT_NAMESPACE = "urn:x-cast:com.example.translationtool";
  const SEARCH = new URLSearchParams(window.location.search);
  const NAMESPACE = SEARCH.get("namespace") || DEFAULT_NAMESPACE;

  const connectionLabel = document.getElementById("connectionLabel");
  const statusEl = document.querySelector(".status");
  const targetLanguageEl = document.getElementById("targetLanguage");
  const sourceLanguageEl = document.getElementById("sourceLanguage");
  const timestampEl = document.getElementById("timestamp");
  const translationTextEl = document.getElementById("translationText");
  const translationFeedEl = document.getElementById("translationFeed");
  const clockEl = document.getElementById("clock");
  const MAX_LINES = 10;
  const renderedChunks = new Map();

  function setConnected(connected, label) {
    statusEl.classList.toggle("connected", connected);
    connectionLabel.textContent = label;
  }

  function setClock() {
    clockEl.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function parseMessage(raw) {
    if (raw && typeof raw === "object") return raw;
    if (typeof raw !== "string") return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function humanLang(code) {
    if (!code || typeof code !== "string") return "--";
    return code.toUpperCase();
  }

  function upsertFeedLine(payload, text, sourceLanguage, targetLanguage, timestamp) {
    const chunkId = (payload.chunk_id || payload.chunkId || "").toString();
    if (!chunkId) {
      return;
    }

    let lineEl = renderedChunks.get(chunkId);
    if (!lineEl) {
      lineEl = document.createElement("article");
      lineEl.className = "translation-line";

      const metaEl = document.createElement("div");
      metaEl.className = "translation-line__meta";

      const textEl = document.createElement("div");
      textEl.className = "translation-line__text";

      lineEl.appendChild(metaEl);
      lineEl.appendChild(textEl);
      renderedChunks.set(chunkId, lineEl);
      translationFeedEl.appendChild(lineEl);
    }

    const metaEl = lineEl.children[0];
    const textEl = lineEl.children[1];
    metaEl.textContent = `${humanLang(sourceLanguage)} -> ${humanLang(targetLanguage)}  ${timestamp}`;
    textEl.textContent = text || " ";

    for (const element of translationFeedEl.querySelectorAll(".translation-line")) {
      element.classList.remove("translation-line--latest");
    }
    lineEl.classList.add("translation-line--latest");
    translationFeedEl.appendChild(lineEl);

    while (translationFeedEl.children.length > MAX_LINES) {
      const firstChild = translationFeedEl.firstElementChild;
      if (!firstChild) break;
      if (firstChild.id === "translationText") {
        translationFeedEl.removeChild(firstChild);
        continue;
      }
      renderedChunks.forEach((value, key) => {
        if (value === firstChild) {
          renderedChunks.delete(key);
        }
      });
      translationFeedEl.removeChild(firstChild);
    }

    translationFeedEl.scrollTop = translationFeedEl.scrollHeight;
  }

  function renderPayload(payload) {
    const text = (
      payload.translation ||
      payload.translation_text ||
      payload.text ||
      ""
    ).toString();
    const targetLanguage =
      payload.target_language || payload.targetLanguage || payload.target || "";
    const sourceLanguage =
      payload.source_language || payload.sourceLanguage || payload.source || "";
    const timestamp =
      payload.timestamp || payload.timestamp_label || payload.time || "--";
    if (translationTextEl) {
      translationTextEl.remove();
    }
    targetLanguageEl.textContent = `Target: ${humanLang(targetLanguage)}`;
    sourceLanguageEl.textContent = `Source: ${humanLang(sourceLanguage)}`;
    timestampEl.textContent = String(timestamp);
    upsertFeedLine(payload, text, sourceLanguage, targetLanguage, timestamp);
  }

  function bootstrapCastReceiver() {
    const context = cast.framework.CastReceiverContext.getInstance();
    const playerManager = context.getPlayerManager();

    context.addCustomMessageListener(NAMESPACE, (event) => {
      const payload = parseMessage(event.data);
      if (!payload) return;
      renderPayload(payload);
      setConnected(true, "Connected");
    });

    context.addEventListener(
      cast.framework.system.EventType.SENDER_CONNECTED,
      () => {
        setConnected(true, "Connected");
      }
    );
    context.addEventListener(
      cast.framework.system.EventType.SENDER_DISCONNECTED,
      () => {
        const senderCount = context.getSenders().length;
        setConnected(senderCount > 0, senderCount > 0 ? "Connected" : "Waiting for sender...");
      }
    );

    playerManager.setMessageInterceptor(
      cast.framework.messages.MessageType.LOAD,
      (requestData) => requestData
    );

    context.start({
      disableIdleTimeout: true,
      maxInactivity: 3600,
    });
  }

  setClock();
  setInterval(setClock, 1000);
  setConnected(false, "Waiting for sender...");
  bootstrapCastReceiver();
})();
