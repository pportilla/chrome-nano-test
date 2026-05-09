const state = {
  api: null,
  runtimeName: "No runtime",
  availability: "unknown",
  session: null,
  sessionOptionsKey: "",
  downloadProgress: 0,
  promptController: null,
};

const els = {
  apiStatus: document.querySelector("#apiStatus"),
  modelStatus: document.querySelector("#modelStatus"),
  sessionStatus: document.querySelector("#sessionStatus"),
  runtimeLabel: document.querySelector("#runtimeLabel"),
  diagnostic: document.querySelector("#diagnostic"),
  downloadBar: document.querySelector("#downloadBar"),
  messages: document.querySelector("#messages"),
  emptyState: document.querySelector("#emptyState"),
  form: document.querySelector("#promptForm"),
  promptInput: document.querySelector("#promptInput"),
  sendButton: document.querySelector("#sendButton"),
  stopButton: document.querySelector("#stopButton"),
  checkButton: document.querySelector("#checkButton"),
  prepareButton: document.querySelector("#prepareButton"),
  resetButton: document.querySelector("#resetButton"),
  languageSelect: document.querySelector("#languageSelect"),
  systemPrompt: document.querySelector("#systemPrompt"),
};

const isLocalDevelopment =
  ["localhost", "127.0.0.1", "0.0.0.0", ""].includes(location.hostname) ||
  location.protocol === "file:";

function setChip(element, text, tone = "neutral") {
  element.textContent = text;
  element.className = `status-chip ${tone}`;
}

function setDiagnostic(message) {
  els.diagnostic.textContent = message;
}

function setBusy(isBusy) {
  els.sendButton.disabled = isBusy;
  els.prepareButton.disabled = isBusy;
  els.checkButton.disabled = isBusy;
  els.languageSelect.disabled = isBusy;
  els.systemPrompt.disabled = isBusy;
  els.stopButton.disabled = !isBusy || !state.promptController;
}

function setDownloadProgress(value) {
  state.downloadProgress = Math.max(0, Math.min(1, Number(value) || 0));
  els.downloadBar.style.width = `${Math.round(state.downloadProgress * 100)}%`;
}

function getLanguageModelApi() {
  if ("LanguageModel" in globalThis) {
    return { api: globalThis.LanguageModel, name: "LanguageModel" };
  }

  if (globalThis.ai?.languageModel) {
    return { api: globalThis.ai.languageModel, name: "ai.languageModel" };
  }

  if (globalThis.ai?.createTextSession || globalThis.ai?.canCreateTextSession) {
    return { api: legacyCreateTextSessionAdapter(globalThis.ai), name: "ai.createTextSession" };
  }

  return { api: null, name: "No runtime" };
}

function legacyCreateTextSessionAdapter(ai) {
  return {
    async availability() {
      if (!ai.canCreateTextSession) {
        return "available";
      }

      return normalizeAvailability(await ai.canCreateTextSession());
    },
    async create() {
      return ai.createTextSession();
    },
  };
}

function normalizeAvailability(value) {
  switch (value) {
    case "readily":
      return "available";
    case "after-download":
      return "downloadable";
    case "no":
      return "unavailable";
    default:
      return value;
  }
}

function currentOptions() {
  const language = els.languageSelect.value;
  const systemPrompt = els.systemPrompt.value.trim();
  const options = {
    expectedInputs: [{ type: "text", languages: [language] }],
    expectedOutputs: [{ type: "text", languages: [language] }],
  };

  if (systemPrompt) {
    options.initialPrompts = [{ role: "system", content: systemPrompt }];
  }

  return options;
}

function optionsKey(options) {
  return JSON.stringify({
    expectedInputs: options.expectedInputs,
    expectedOutputs: options.expectedOutputs,
    initialPrompts: options.initialPrompts,
  });
}

async function callAvailability(options) {
  if (!state.api?.availability) {
    return "unavailable";
  }

  try {
    return await state.api.availability(options);
  } catch (error) {
    console.warn("availability(options) failed, retrying without options", error);
    return state.api.availability();
  }
}

function updateAvailabilityUi(value) {
  state.availability = value;

  switch (value) {
    case "available":
      setChip(els.modelStatus, "Model: available", "ok");
      setDiagnostic("The model is available for this page.");
      setDownloadProgress(1);
      break;
    case "downloadable":
      setChip(els.modelStatus, "Model: downloadable", "warn");
      setDiagnostic("The model can be downloaded after a direct click on this page.");
      setDownloadProgress(0);
      break;
    case "downloading":
      setChip(els.modelStatus, "Model: downloading", "warn");
      setDiagnostic("Chrome is downloading the on-device model. Keep this page open.");
      break;
    case "checking":
      setChip(els.modelStatus, "Model: checking", "neutral");
      setDiagnostic("Checking Chrome's local model state.");
      break;
    case "unavailable":
      setChip(els.modelStatus, "Model: unavailable", "bad");
      setDiagnostic("Chrome reports that this device, browser, language, or flag setup is not available.");
      setDownloadProgress(0);
      break;
    default:
      setChip(els.modelStatus, `Model: ${value || "unknown"}`, "neutral");
      setDiagnostic("Chrome returned an unknown model state.");
      break;
  }
}

async function checkRuntime() {
  const detected = getLanguageModelApi();
  state.api = detected.api;
  state.runtimeName = detected.name;
  els.runtimeLabel.textContent = detected.name;

  if (!state.api) {
    setChip(els.apiStatus, "API: missing", "bad");
    updateAvailabilityUi("unavailable");
    setDiagnostic(promptApiMissingMessage());
    return;
  }

  setChip(els.apiStatus, "API: found", "ok");

  try {
    updateAvailabilityUi("checking");
    const availability = await callAvailability(currentOptions());
    updateAvailabilityUi(normalizeAvailability(availability));
  } catch (error) {
    setChip(els.modelStatus, "Model: error", "bad");
    setDiagnostic(errorMessage(error));
  }
}

function createMonitor() {
  return (monitor) => {
    if (!monitor?.addEventListener) {
      return;
    }

    monitor.addEventListener("downloadprogress", (event) => {
      setDownloadProgress(event.loaded);
      setChip(els.modelStatus, `Model: ${Math.round(event.loaded * 100)}%`, "warn");
      setDiagnostic("Chrome is downloading Gemini Nano for local use.");
    });
  };
}

async function createSession() {
  if (!state.api) {
    await checkRuntime();
  }

  if (!state.api?.create) {
    throw new Error(`${promptApiMissingMessage()} Check the Chrome flags and reopen this page.`);
  }

  const options = currentOptions();
  const key = optionsKey(options);

  if (state.session && state.sessionOptionsKey === key) {
    return state.session;
  }

  if (state.session?.destroy) {
    state.session.destroy();
  }

  setChip(els.sessionStatus, "Session: preparing", "warn");
  setDiagnostic("Preparing a local model session.");

  const optionsWithMonitor = {
    ...options,
    monitor: createMonitor(),
  };

  try {
    state.session = await state.api.create(optionsWithMonitor);
  } catch (error) {
    console.warn("create(options) failed, retrying with fewer options", error);
    const minimalOptions = options.initialPrompts
      ? { initialPrompts: options.initialPrompts, monitor: createMonitor() }
      : { monitor: createMonitor() };

    try {
      state.session = await state.api.create(minimalOptions);
    } catch (secondError) {
      console.warn("create(minimalOptions) failed, retrying bare create()", secondError);
      state.session = await state.api.create();
    }
  }

  state.sessionOptionsKey = key;
  setChip(els.sessionStatus, "Session: ready", "ok");
  setDiagnostic("Session ready.");
  updateContextStatus();
  return state.session;
}

async function prepareSession() {
  if (!state.api) {
    await checkRuntime();
  }

  if (!state.api) {
    return;
  }

  setBusy(true);
  try {
    const availability = await callAvailability(currentOptions());
    const normalizedAvailability = normalizeAvailability(availability);
    updateAvailabilityUi(normalizedAvailability);

    if (normalizedAvailability === "unavailable") {
      return;
    }

    await createSession();
    await checkRuntime();
  } catch (error) {
    setChip(els.sessionStatus, "Session: error", "bad");
    setDiagnostic(errorMessage(error));
  } finally {
    setBusy(false);
  }
}

function resetSession() {
  if (state.promptController) {
    state.promptController.abort();
  }

  if (state.session?.destroy) {
    state.session.destroy();
  }

  state.session = null;
  state.sessionOptionsKey = "";
  setChip(els.sessionStatus, "Session: idle", "neutral");
  setDiagnostic("New session cleared.");
  showEmptyState();
}

function ensureMessagesStarted() {
  if (els.emptyState) {
    els.emptyState.remove();
    els.emptyState = null;
  }
}

function showEmptyState() {
  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.id = "emptyState";

  const title = document.createElement("strong");
  title.textContent = "Ready when Chrome is.";

  const subtitle = document.createElement("span");
  subtitle.textContent = "Check the model, then send a prompt.";

  emptyState.append(title, subtitle);
  els.messages.replaceChildren(emptyState);
  els.emptyState = emptyState;
}

function addMessage(role, text = "") {
  ensureMessagesStarted();
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const roleLabel = document.createElement("span");
  roleLabel.className = "role";
  roleLabel.textContent = role;

  const content = document.createElement("div");
  content.className = "content";
  content.textContent = text;

  message.append(roleLabel, content);
  els.messages.append(message);
  scrollMessages();
  return content;
}

function appendChunk(target, chunk) {
  target.append(document.createTextNode(normalizeChunk(chunk)));
  scrollMessages();
}

function normalizeChunk(chunk) {
  if (typeof chunk === "string") {
    return chunk;
  }

  if (chunk?.text) {
    return chunk.text;
  }

  if (chunk?.value) {
    return chunk.value;
  }

  return String(chunk ?? "");
}

function scrollMessages() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

async function submitPrompt(event) {
  event.preventDefault();
  const prompt = els.promptInput.value.trim();

  if (!prompt) {
    els.promptInput.focus();
    return;
  }

  setBusy(true);
  state.promptController = new AbortController();
  els.stopButton.disabled = false;
  addMessage("user", prompt);
  els.promptInput.value = "";

  const responseTarget = addMessage("assistant", "");

  try {
    const session = await createSession();
    await runPrompt(session, prompt, responseTarget, state.promptController.signal);
    updateContextStatus();
  } catch (error) {
    if (error?.name === "AbortError") {
      appendChunk(responseTarget, "\n\nStopped.");
    } else {
      responseTarget.textContent = errorMessage(error);
      setChip(els.sessionStatus, "Session: error", "bad");
      setDiagnostic(errorMessage(error));
    }
  } finally {
    state.promptController = null;
    setBusy(false);
    els.promptInput.focus();
  }
}

async function runPrompt(session, prompt, target, signal) {
  if (session.promptStreaming) {
    const stream = await session.promptStreaming(prompt, { signal });

    if (stream?.[Symbol.asyncIterator]) {
      for await (const chunk of stream) {
        appendChunk(target, chunk);
      }
      return;
    }

    if (stream?.getReader) {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        appendChunk(target, value);
      }
      return;
    }
  }

  const result = await session.prompt(prompt, { signal });
  target.textContent = normalizeChunk(result);
}

function stopPrompt() {
  state.promptController?.abort();
}

function updateContextStatus() {
  if (!state.session) {
    return;
  }

  const { contextUsage, contextWindow } = state.session;
  if (Number.isFinite(contextUsage) && Number.isFinite(contextWindow) && contextWindow > 0) {
    setDiagnostic(`Session ready. Context: ${contextUsage} / ${contextWindow} tokens.`);
  }
}

function errorMessage(error) {
  if (!error) {
    return "Unknown error.";
  }

  if (error.name && error.message) {
    return `${error.name}: ${error.message}`;
  }

  return error.message || String(error);
}

function promptApiMissingMessage() {
  if (isLocalDevelopment) {
    return "No Prompt API runtime was found. Check Chrome flags and use a supported Chrome desktop build.";
  }

  return "No Prompt API runtime was found for this hosted origin. Chrome may require Prompt API origin-trial access for published web pages.";
}

els.form.addEventListener("submit", submitPrompt);
els.stopButton.addEventListener("click", stopPrompt);
els.checkButton.addEventListener("click", checkRuntime);
els.prepareButton.addEventListener("click", prepareSession);
els.resetButton.addEventListener("click", resetSession);
els.languageSelect.addEventListener("change", resetSession);
els.systemPrompt.addEventListener("change", resetSession);

checkRuntime();
