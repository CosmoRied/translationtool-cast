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
  const clockEl = document.getElementById("clock");

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
    translationTextEl.textContent = text || " ";
    targetLanguageEl.textContent = `Target: ${humanLang(targetLanguage)}`;
    sourceLanguageEl.textContent = `Source: ${humanLang(sourceLanguage)}`;
    timestampEl.textContent = String(timestamp);
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
