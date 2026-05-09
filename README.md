# Nano Prompt Lab

A tiny localhost playground for Chrome's built-in Gemini Nano Prompt API.

## Run

```bash
npm start
```

Open `http://localhost:5173` in Chrome desktop.

## Chrome setup

For local testing, Chrome's docs say the built-in AI APIs are available on `localhost` after enabling the relevant flags:

1. `chrome://flags/#optimization-guide-on-device-model`
2. `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
3. If the second flag is not present in your Chrome build, try `chrome://flags/#prompt-api-for-gemini-nano`

Restart Chrome after changing flags. The first prompt may trigger the local model download.

Useful diagnostics:

- `chrome://on-device-internals`
- DevTools Console: `await LanguageModel.availability()`

## Sources

- Chrome Prompt API: https://developer.chrome.com/docs/ai/prompt-api
- Chrome built-in AI get started: https://developer.chrome.com/docs/ai/get-started
- Chrome streaming guidance: https://developer.chrome.com/docs/ai/streaming
