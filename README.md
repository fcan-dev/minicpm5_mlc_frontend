---
title: MiniCPM5 WebGPU
emoji: 🕊️
colorFrom: blue
colorTo: indigo
sdk: static
app_build_command: npm run build
app_file: dist/index.html
short_description: MiniCPM5-2B chat running fully in your browser
pinned: false
models:
  - fatih-can/MiniCPM5-2B-MLC
---

# MiniCPM5 WebGPU

A chat frontend that runs **MiniCPM5-2B entirely in your browser** — no server, no
inference API, no data leaving the machine. Generation happens on your own GPU
through WebGPU, using [WebLLM](https://github.com/mlc-ai/web-llm) and MLC-compiled
weights from [`fatih-can/MiniCPM5-2B-MLC`](https://huggingface.co/fatih-can/MiniCPM5-2B-MLC).

## Requirements

A browser with **WebGPU** enabled — Chrome/Edge 113+, or Safari 26+. The page shows
a compatibility banner if WebGPU is unavailable.

## Usage

1. Open the Space and wait for the model to download on first load (a few hundred MB,
   cached by the browser afterwards).
2. Pick a quantization (q4f16_1 or q4f16_autoawq) and context size in Settings.
3. Chat. Everything is local; the page itself is static and ships no weights.

## Notes

- Weights and the WebGPU wasm library are fetched from the Hub CDN at runtime, so the
  Space repository contains no model files.
- Quantizations other than the two listed are intentionally absent: MLC's compiled
  int3 kernels produce unusable output on WebGPU.

## Local development

```sh
npm install
npm run dev      # dev server
npm run build    # production build -> dist/
```
