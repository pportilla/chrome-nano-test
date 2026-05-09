# Nano Prompt Lab

A tiny browser playground for Chrome's built-in Gemini Nano Prompt API.

## Public page

Open the hosted version:

https://pportilla.github.io/chrome-nano-test/

The page is static and hosted by GitHub Pages. Inference still happens locally in each visitor's Chrome browser; there is no backend and no API key.

Chrome's Prompt API for normal web pages is still experimental/origin-trial based. If the public page shows `API: missing`, try the local setup below or register the exact `https://pportilla.github.io` origin for Chrome's Prompt API origin trial.

## Run locally

```bash
npm start
```

Open `http://localhost:5173` in Chrome desktop.

## Chrome setup

For local testing, Chrome's docs say the built-in AI APIs are available on `localhost` after enabling the relevant flags:

1. `chrome://flags/#optimization-guide-on-device-model`
2. `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
3. If the second flag is not present in your Chrome build, try `chrome://flags/#prompt-api-for-gemini-nano`

Restart Chrome after changing flags.

## First use

Click **Prepare** before asking a question. This creates the local session and lets Chrome download Gemini Nano if it is not already installed.

The first download can take a while because the on-device model is roughly 4 GB. Keep the page open until the model finishes downloading, then enter a prompt and click **Ask**.

Useful diagnostics:

- `chrome://on-device-internals`
- DevTools Console: `await LanguageModel.availability()`

## Sources

- Chrome Prompt API: https://developer.chrome.com/docs/ai/prompt-api
- Chrome built-in AI get started: https://developer.chrome.com/docs/ai/get-started
- Chrome streaming guidance: https://developer.chrome.com/docs/ai/streaming
- Chrome origin trials: https://developer.chrome.com/docs/web-platform/origin-trials
