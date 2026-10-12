#!/usr/bin/env node
/** Deprecated wrapper — prefer: npm run dict:build → python3 scripts/build-dictionary.py */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("python3", [join(root, "scripts/build-dictionary.py")], {
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status ?? 1);
