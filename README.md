# Lexi — English ↔ 中文 tutor

Personal dictionary, translator, and flashcard practice desktop app.

Built with **Tauri 2 + React + TypeScript + Vite**. Window title: **Lexi**. Folder/repo slug: `en-zh-tutor`.

## Features (MVP)

1. **Dictionary** — look up English (Free Dictionary API: definitions, phonetic) and attach a 中文 gloss via MyMemory. Chinese queries are translated to English (and dictionary-looked-up when possible).
2. **Translate** — EN↔中文 with auto-detect or explicit direction (MyMemory).
3. **Practice** — flashcards from words you save; flip, mark know / don’t know; deck stored in **localStorage** (no SQLite in this MVP).

Network failures show a clear banner; the UI does not crash.

## APIs (no paid keys)

| Use | Provider | Endpoint |
|-----|----------|----------|
| English dictionary | [Free Dictionary API](https://dictionaryapi.dev/) | `https://api.dictionaryapi.dev/api/v2/entries/en/<word>` |
| Translation | [MyMemory](https://mymemory.translated.net/) | `https://api.mymemory.translated.net/get?q=...&langpair=en\|zh-CN` (or `zh-CN\|en`) |

MyMemory’s anonymous tier is rate-limited. If you need higher volume later, add an email key or switch providers — no keys are required for this MVP.

## Prerequisites

- Node.js 18+ and npm
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Tauri Linux deps (for `tauri dev` / `tauri build` on Linux): see [Tauri prerequisites](https://tauri.app/start/prerequisites/) — typically `libwebkit2gtk-4.1-dev`, `librsvg2-dev`, and related packages

## Install & run

```bash
cd en-zh-tutor
npm install

# Frontend only (Vite):
npm run dev

# Full desktop app (needs Tauri system deps):
npm run tauri dev

# Production frontend bundle:
npm run build

# Native installer (needs Tauri system deps):
npm run tauri build
```

## Project layout

```
en-zh-tutor/
  src/                 React UI
    api/               dictionary + translate clients
    components/        Dictionary, Translate, Practice
    storage/           localStorage vocab deck
  src-tauri/           Tauri 2 / Rust shell
```

## Known limitations

- Vocabulary is per-browser/webview profile (`localStorage`), not a shared SQLite DB yet.
- Free Dictionary API is English-only; Chinese lookups rely on translation (+ optional EN entry).
- MyMemory quality/limits vary; long texts may fail.
- On some Linux boxes, `tauri build` needs webkit2gtk / rsvg packages installed first.

## Next steps

- Open the folder in Cursor / your editor and run `npm run tauri dev` on your machine.
- Optionally create a private GitHub repo and push when ready.
- Later: SQLite via Tauri plugin, spaced repetition, audio pronunciation, offline word packs.


## Verified on scaffold host

- `npm install` — OK
- `npm run build` (`tsc` + Vite) — OK
- Free Dictionary API + MyMemory — reachable from the box
- `npm run tauri build` — **blocked** without Linux packages: `pkg-config`, `libwebkit2gtk-4.1-dev`, `librsvg2-dev`, and related Tauri prerequisites

On Debian/Ubuntu-like systems:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  pkg-config
```

Then `npm run tauri dev` / `npm run tauri build`.
