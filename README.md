# Lexi — English ↔ 中文 tutor

Personal dictionary, translator, and flashcard practice desktop app.

Built with **Tauri 2 + React + TypeScript + Vite**. Window title: **Lexi**. GitHub: [`yixian-huang/lexi`](https://github.com/yixian-huang/lexi). Local folder: `en-zh-tutor`.

## Features (MVP)

1. **Dictionary** — **local-first**: Open English Wordnet 2025 (EN senses) + ECDICT (EN→ZH) + full CC-CEDICT (ZH→EN). No network for word lookup.
2. **Translate** — free-form EN↔中文 sentences via MyMemory (online). Prefer Dictionary for single words.
3. **Practice** — spaced-repetition flashcards from words you save; Again / Hard / Good scheduling; deck in **localStorage**.

Network failures show a clear banner; the UI does not crash.

## Dictionary data (local-first)

On-device packs in `public/dict/` (~**10 MB** gzipped JSON):

| Pack | Source | Coverage (default build) |
|------|--------|---------------------------|
| `en-defs.json.gz` | [Open English Wordnet 2025](https://en-word.net/) | ~127k lemmas, senses + IPA |
| `en-zh.json.gz` | [ECDICT](https://github.com/skywind3000/ECDICT) (MIT) | ~42k lemmas (`frq>0` or `collins≥2`) |
| `zh-cedict.json.gz` | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) | ~121k simplified entries (full dump) |
| `trad-map.json.gz` | CC-CEDICT | ~77k traditional→simplified |

**API:** `lookup(query) → DictionaryEntry | null` in `src/dictionary/` (sync-ready; no server yet).

### Attribution & licenses

- **Open English Wordnet 2025** — see [en-word.net](https://en-word.net/) / [globalwordnet/english-wordnet](https://github.com/globalwordnet/english-wordnet) (Princeton WordNet license / OEWN terms).
- **ECDICT** — [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT), **MIT**.
- **CC-CEDICT** — [MDBG](https://www.mdbg.net/chinese/dictionary?page=cc-cedict), **CC BY-SA 4.0**.

### Rebuild packs

```bash
# Default (app-sized ECDICT subset ~42k + full OEWN + full CEDICT)
npm run dict:build

# Larger ECDICT (all single-token rows with translations — bigger download)
npm run dict:build:full
```

Raw downloads land in `data/raw/` (gitignored). Tradeoff: default ECDICT omits rare lemmas without frequency/Collins tags; use `:full` locally if you need broader EN→ZH coverage.

### Online APIs (Translate only)

| Use | Provider |
|-----|----------|
| Sentence translation | [MyMemory](https://mymemory.translated.net/) free tier |

Dictionary lookup does **not** use Free Dictionary API or MyMemory.


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
    dictionary/              lookup() + gzip pack loader
    api/                     MyMemory translate + re-exports
    components/
    storage/                 SRS vocab (localStorage)
  public/dict/               ~10 MB gzipped packs (OEWN + ECDICT + CEDICT)
  scripts/build-dictionary.py
  src-tauri/
```

## Auto-update (Tauri updater)

Lexi checks GitHub Releases on launch (and via **Check for updates** in the header) using `tauri-plugin-updater`.

- Endpoint: `https://github.com/yixian-huang/lexi/releases/latest/download/latest.json`
- Artifacts are **minisign-signed** (`createUpdaterArtifacts` + CI `TAURI_SIGNING_PRIVATE_KEY`)
- After download, the app relaunches via `tauri-plugin-process`

### Private repo limitation

Anonymous clients **cannot** download assets from a **private** GitHub repo. Until Releases (or the whole repo) are publicly fetchable, in-app update checks will fail. Options:

1. **Recommended for seamless updates:** make the repo or at least release assets public, **or**
2. Host `latest.json` + `.app.tar.gz` / `.sig` on any public HTTPS URL and change `plugins.updater.endpoints` in `tauri.conf.json`, **or**
3. (Not recommended) ship a GitHub token inside the app.

This repo stays private unless you change visibility yourself — the updater is wired for when the feed is reachable.

### First signed release (Yixian)

Keys were generated under `.keys/` on the build machine (gitignored). To publish signed updates:

1. Ensure you have the private key file (`.keys/lexi.key`) or regenerate:
   ```bash
   npm run tauri signer generate -- -w .keys/lexi.key --ci
   ```
   Then copy the **public** key into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` (already set for the current keypair).
2. In GitHub → **Settings → Secrets and variables → Actions**, add:
   - `TAURI_SIGNING_PRIVATE_KEY` = **contents** of `.keys/lexi.key` (entire file)
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = password if you set one (omit/empty if none)
3. Tag a new version (e.g. `v0.4.0`) so `release.yml` builds, signs, and uploads `.sig` + `latest.json`.
4. Install that build once; later tags should prompt in-app updates when the release feed is publicly readable.

**Do not commit** the private key. Losing it breaks the update chain for existing installs.

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
- Default ECDICT pack is frequency/Collins-filtered (~42k); run `dict:build:full` for broader EN→ZH.
- OEWN + CEDICT ship in full for this release of the packs.
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
