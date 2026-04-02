(function () {
  "use strict";

  const DEFAULT_NAMESPACE = "urn:x-cast:com.example.translationtool";
  const SEARCH = new URLSearchParams(window.location.search);
  const NAMESPACE = SEARCH.get("namespace") || DEFAULT_NAMESPACE;

  const connectionLabel = document.getElementById("connectionLabel");
  const statusEl = document.querySelector(".status");
  const targetLanguageEl = document.getElementById("targetLanguage");
  const sourceLanguageEl = document.getElementById("sourceLanguage");
  const translationTextEl = document.getElementById("translationText");
  const translationFeedEl = document.getElementById("translationFeed");
  const clockEl = document.getElementById("clock");
  const tickerTextEl = document.getElementById("tickerText");
  const tickerViewportEl = document.getElementById("tickerViewport");
  const appEl = document.getElementById("app");
  const MAX_LINES = 10;
  const renderedChunks = new Map();
  let displayMode = "feed";

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

  function refreshTicker(text) {
    tickerTextEl.textContent = text || " ";
    tickerTextEl.classList.remove("ticker__text--static", "ticker__text--scrolling");
    tickerTextEl.style.removeProperty("--ticker-start");
    tickerTextEl.style.removeProperty("--ticker-end");
    tickerTextEl.style.animationDuration = "";

    requestAnimationFrame(() => {
      const viewportWidth = tickerViewportEl.clientWidth;
      const textWidth = tickerTextEl.scrollWidth;
      if (!viewportWidth || !textWidth) {
        tickerTextEl.classList.add("ticker__text--static");
        return;
      }

      if (textWidth <= viewportWidth * 0.92) {
        tickerTextEl.classList.add("ticker__text--static");
        return;
      }

      const startX = Math.max(viewportWidth * 0.08, 40);
      const endX = -Math.max(textWidth - viewportWidth + startX, 24);
      const travel = startX - endX;
      const durationSeconds = Math.max(4.5, Math.min(12, travel / 120));

      tickerTextEl.style.setProperty("--ticker-start", `${startX}px`);
      tickerTextEl.style.setProperty("--ticker-end", `${endX}px`);
      tickerTextEl.style.animationDuration = `${durationSeconds}s`;
      void tickerTextEl.offsetWidth;
      tickerTextEl.classList.add("ticker__text--scrolling");
    });
  }

  function applyDisplayMode(nextMode) {
    displayMode = ["feed", "caption", "ticker"].includes(nextMode) ? nextMode : "feed";
    appEl.classList.remove("mode-feed", "mode-caption", "mode-ticker");
    appEl.classList.add(`mode-${displayMode}`);
  }

  function upsertFeedLine(payload, text) {
    const chunkId = (payload.chunk_id || payload.chunkId || "").toString();
    if (!chunkId) {
      return;
    }

    let lineEl = renderedChunks.get(chunkId);
    if (!lineEl) {
      lineEl = document.createElement("article");
      lineEl.className = "translation-line";

      const textEl = document.createElement("div");
      textEl.className = "translation-line__text";

      lineEl.appendChild(textEl);
      renderedChunks.set(chunkId, lineEl);
      translationFeedEl.prepend(lineEl);
    }

    const textEl = lineEl.children[0];
    textEl.textContent = text || " ";

    for (const element of translationFeedEl.querySelectorAll(".translation-line")) {
      element.classList.remove("translation-line--latest");
    }
    lineEl.classList.add("translation-line--latest");
    translationFeedEl.prepend(lineEl);

    while (translationFeedEl.children.length > MAX_LINES) {
      const lastChild = translationFeedEl.lastElementChild;
      if (!lastChild) break;
      if (lastChild.id === "translationText") {
        translationFeedEl.removeChild(lastChild);
        continue;
      }
      renderedChunks.forEach((value, key) => {
        if (value === lastChild) {
          renderedChunks.delete(key);
        }
      });
      translationFeedEl.removeChild(lastChild);
    }
  }

  function renderPayload(payload) {
    if ((payload.message_type || payload.messageType || "") === "config") {
      applyDisplayMode((payload.display_mode || payload.displayMode || "").toString().toLowerCase());
      return;
    }
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
    const nextDisplayMode = (
      payload.display_mode ||
      payload.displayMode ||
      displayMode
    ).toString().toLowerCase();
    if (translationTextEl) {
      translationTextEl.remove();
    }
    targetLanguageEl.textContent = `Target: ${humanLang(targetLanguage)}`;
    sourceLanguageEl.textContent = `Source: ${humanLang(sourceLanguage)}`;
    refreshTicker(text);
    applyDisplayMode(nextDisplayMode);
    upsertFeedLine(payload, text);
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
  applyDisplayMode("feed");
  refreshTicker("Connect from TranslationTool and start speaking.");
  bootstrapCastReceiver();
})();
