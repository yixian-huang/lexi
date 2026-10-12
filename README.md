# Lexi — English ↔ 中文 tutor

Personal dictionary, translator, and flashcard practice desktop app.

Built with **Tauri 2 + React + TypeScript + Vite**. Window title: **Lexi**. GitHub: [`yixian-huang/lexi`](https://github.com/yixian-huang/lexi). Local folder: `en-zh-tutor`.

## Features (MVP)

1. **Dictionary** — **local-first** English definitions (Webster public-domain subset) + EN↔ZH glosses (CC-CEDICT subset). No network for word lookup.
2. **Translate** — free-form EN↔中文 sentences via MyMemory (online). Prefer Dictionary for single words.
3. **Practice** — spaced-repetition flashcards from words you save; Again / Hard / Good scheduling; deck in **localStorage**.

Network failures show a clear banner; the UI does not crash.

## Dictionary data (local-first)

Word lookup uses on-device packs in `public/dict/` (gzipped JSON, ~2 MB):

| Pack | Contents |
|------|----------|
| `en-defs.json.gz` | English definitions for high-frequency lemmas |
| `en-zh.json.gz` | English lemma → Chinese glosses |
| `zh-cedict.json.gz` | Chinese (1–2 chars, frequency-filtered) → pinyin + defs |
| `trad-map.json.gz` | Traditional → simplified map |

**API:** `lookup(query) → DictionaryEntry | null` in `src/dictionary/` (ready for a future self-hosted sync; no server yet).

### Attribution

- **[CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict)** — Chinese–English dictionary, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Webster's Unabridged** (via [adambom/dictionary](https://github.com/adambom/dictionary)) — public domain English definitions (subset).
- **[google-10000-english](https://github.com/first20hours/google-10000-english)** — frequency list used to choose the starter subset.

Rebuild / expand packs (downloads into `data/raw/`, not committed):

```bash
npm run dict:build
```

### Online APIs (Translate only)

| Use | Provider |
|-----|----------|
| Sentence translation | [MyMemory](https://mymemory.translated.net/) free tier (`en\|zh-CN` / `zh-CN\|en`) |

MyMemory is rate-limited anonymously. Dictionary lookup does **not** call Free Dictionary API or MyMemory.

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

## Download (macOS)

GitHub Releases publish **unsigned** macOS builds (Apple Silicon and Intel):

1. Open [Releases](https://github.com/yixian-huang/lexi/releases) and download the `.dmg` for your Mac (`aarch64` = Apple Silicon / M-series, `x86_64` = Intel).
2. Open the DMG and drag **Lexi** into Applications.
3. **Gatekeeper (unsigned app):** the first launch may say the app “can’t be opened.” Use **Right-click (or Control-click) → Open**, then confirm **Open**. Or go to **System Settings → Privacy & Security** and click **Open Anyway**.

Releases are built by `.github/workflows/release.yml` on tags `v*` (e.g. `v0.1.0`) or via **Actions → Release → Run workflow**.

## Project layout

```
en-zh-tutor/
  src/
    dictionary/        local lookup() + pack loader
    api/               translate (MyMemory) + thin re-exports
    components/        Dictionary, Translate, Practice
    storage/           SRS vocab (localStorage)
  public/dict/         gzipped dictionary packs (~2 MB)
  scripts/build-dictionary.mjs
  src-tauri/           Tauri 2 / Rust shell
```

## Practice scheduling (SRS)

Lexi uses a **minimal SM-2-like** scheduler stored on each card in `localStorage`:

| Field | Meaning |
|-------|---------|
| `interval` | Days until the next review |
| `ease` | Ease factor (starts at 2.5, floor 1.3) |
| `due` | Next review time (epoch ms) |
| `reps` | Successful review count |
| `lapses` | Times graded **Again** |

**Grades**

- **Again** (1) — lapse; reset reps; ease −0.2; due again in ~10 minutes
- **Hard** (2) — ease −0.15; shorter growth (first hard ≈ 12h, then ×1.2)
- **Good** (3) — classic steps: 1 day → 3 days → `interval × ease`

**Session queue**

1. Cards with `due ≤ now` first (oldest due first)
2. If none due → new / learning cards
3. If still none → “study ahead” (soonest upcoming)

Deck pills show **Due**, **Today**, **Learning** (new + learning), and **Mastered** (interval ≥ 21 days and reps ≥ 3). Existing cards without SRS fields are migrated on load (due immediately).

## Known limitations

- Vocabulary is per-browser/webview profile (`localStorage`), not a shared SQLite DB yet.
- Local dictionary is a **starter subset** (not full CEDICT / not all English words).
- No self-hosted sync yet — data layer is sync-ready via `lookup()`.
- MyMemory quality/limits vary; long texts may fail.
- On some Linux boxes, `tauri build` needs webkit2gtk / rsvg packages installed first.

## Next steps

- Open the folder in Cursor / your editor and run `npm run tauri dev` on your machine.
- Optionally create a private GitHub repo and push when ready.
- Later: SQLite via Tauri plugin, audio pronunciation, offline word packs, richer SRS tunables.


## Verified on scaffold host

- `npm install` — OK
- `npm run build` (`tsc` + Vite) — OK
- Local dictionary packs built; MyMemory still used for Translate only
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
