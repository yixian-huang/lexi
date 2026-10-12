# Lexi updater signing keys

Private keys in this folder are **gitignored**. Never commit `*.key`.

## Generate (once)

```bash
npm run tauri signer generate -- -w .keys/lexi.key --ci
```

- Public key → paste into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
- Private key → GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY` (file **contents**, not path)
- Optional password → secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

If you lose the private key, existing installs cannot verify new updates; you must generate a new keypair and ship a manual reinstall.
