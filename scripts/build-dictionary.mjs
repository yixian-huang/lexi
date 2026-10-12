#!/usr/bin/env node
/**
 * Build Lexi local dictionary assets (gzipped JSON) into public/dict/
 *
 *   node scripts/build-dictionary.mjs
 *
 * Downloads (once) into data/raw/:
 * - CC-CEDICT (CC BY-SA 4.0)
 * - google-10000-english frequency list
 * - Webster's Unabridged JSON (public domain)
 */
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip, createGunzip } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const rawDir = join(root, "data", "raw");
const outDir = join(root, "public", "dict");
mkdirSync(rawDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 1000) {
    console.log("exists:", dest);
    return;
  }
  console.log("download:", url);
  execFileSync("curl", ["-fsSL", "-o", dest, url], { stdio: "inherit" });
}

download(
  "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
  join(rawDir, "cedict.txt.gz"),
);
download(
  "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt",
  join(rawDir, "google-10k.txt"),
);
download(
  "https://raw.githubusercontent.com/adambom/dictionary/master/dictionary.json",
  join(rawDir, "webster.json"),
);

const cedictTxt = join(rawDir, "cedict.txt");
if (!existsSync(cedictTxt)) {
  await pipeline(
    createReadStream(join(rawDir, "cedict.txt.gz")),
    createGunzip(),
    createWriteStream(cedictTxt),
  );
}

const freq = readFileSync(join(rawDir, "google-10k.txt"), "utf8")
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^[a-z][a-z'-]*$/.test(w));
const topDefs = freq.slice(0, 8000);
const topGloss = new Set(freq.slice(0, 5000));
const topCore = new Set(freq.slice(0, 2500));

const webster = JSON.parse(readFileSync(join(rawDir, "webster.json"), "utf8"));
const enDefs = {};
for (const word of topDefs) {
  const def = webster[word.toUpperCase()];
  if (typeof def !== "string") continue;
  let short = def.replace(/\s+/g, " ").trim();
  const m = short.match(/^(.{20,240}?[.!?])(?:\s|$)/);
  if (m) short = m[1];
  else if (short.length > 240) short = short.slice(0, 237) + "…";
  if (short.length < 8) continue;
  enDefs[word] = [[short]];
}

const zhIndex = {};
const tradMap = {};
const enToZh = {};
const lineRe = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.+)\/\s*$/;
let parsed = 0;

for (const line of readFileSync(cedictTxt, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const m = line.match(lineRe);
  if (!m) continue;
  const [, traditional, simplified, pinyin, defsRaw] = m;
  const defs = defsRaw
    .split("/")
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => !/^(see |variant of|CL:|surname )/i.test(d));
  if (!defs.length) continue;
  parsed += 1;

  const hits = [];
  for (const d of defs) {
    if (/^[a-z][a-z'-]*$/i.test(d) && topGloss.has(d.toLowerCase())) {
      hits.push(d.toLowerCase());
    }
    for (const tok of d.toLowerCase().match(/[a-z][a-z'-]*/g) || []) {
      if (topCore.has(tok)) hits.push(tok);
    }
  }
  const uniqHits = [...new Set(hits)];
  const keep =
    simplified.length === 1 || (simplified.length === 2 && uniqHits.length > 0);

  if (keep) {
    if (!zhIndex[simplified]) zhIndex[simplified] = [pinyin, ...defs.slice(0, 4)];
    else {
      const cur = zhIndex[simplified];
      const merged = [...new Set([...cur.slice(1), ...defs])].slice(0, 6);
      zhIndex[simplified] = [cur[0] || pinyin, ...merged];
    }
    if (traditional !== simplified && !tradMap[traditional]) {
      tradMap[traditional] = simplified;
    }
  }

  for (const lemma of uniqHits) {
    if (!enToZh[lemma]) enToZh[lemma] = [];
    if (enToZh[lemma].length >= 5) continue;
    if (enToZh[lemma].some((x) => x[0] === simplified)) continue;
    if (simplified.length > 3) continue;
    enToZh[lemma].push([simplified, pinyin]);
  }
}

async function writeGz(name, obj) {
  const jsonPath = join(outDir, name);
  const data = Buffer.from(JSON.stringify(obj), "utf8");
  writeFileSync(jsonPath, data);
  await pipeline(
    createReadStream(jsonPath),
    createGzip({ level: 9 }),
    createWriteStream(jsonPath + ".gz"),
  );
  unlinkSync(jsonPath); // ship gzip only
  return statSync(jsonPath + ".gz").size;
}

const bytes = {
  "en-defs.json.gz": await writeGz("en-defs.json", enDefs),
  "zh-cedict.json.gz": await writeGz("zh-cedict.json", zhIndex),
  "en-zh.json.gz": await writeGz("en-zh.json", enToZh),
  "trad-map.json.gz": await writeGz("trad-map.json", tradMap),
};

const meta = {
  builtAt: new Date().toISOString(),
  format: {
    "en-defs.json.gz": "{ lemma: [[definition, ...], ...] }",
    "zh-cedict.json.gz": "{ simplified: [pinyin, def1, ...] }",
    "en-zh.json.gz": "{ lemma: [[simplified, pinyin], ...] }",
    "trad-map.json.gz": "{ traditional: simplified }",
  },
  sources: [
    {
      name: "CC-CEDICT",
      license: "CC BY-SA 4.0",
      url: "https://www.mdbg.net/chinese/dictionary?page=cc-cedict",
    },
    {
      name: "Webster's Unabridged (adambom/dictionary)",
      license: "Public domain",
      url: "https://github.com/adambom/dictionary",
    },
    {
      name: "google-10000-english",
      license: "Public frequency word list",
      url: "https://github.com/first20hours/google-10000-english",
    },
  ],
  stats: {
    cedictParsed: parsed,
    zhEntries: Object.keys(zhIndex).length,
    tradMap: Object.keys(tradMap).length,
    enZhLemmas: Object.keys(enToZh).length,
    enDefs: Object.keys(enDefs).length,
    bytes,
  },
};
writeFileSync(join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta.stats, null, 2));
console.log(
  "shipped MB:",
  (
    (Object.values(bytes).reduce((a, b) => a + b, 0) +
      statSync(join(outDir, "meta.json")).size) /
    1024 /
    1024
  ).toFixed(2),
);
