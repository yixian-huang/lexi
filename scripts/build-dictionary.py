#!/usr/bin/env python3
"""
Build Lexi local dictionary packs into public/dict/ (gzipped JSON).

Sources (downloaded once into data/raw/):
  - Open English Wordnet 2025 (Princeton WordNet / Open English WordNet license)
  - ECDICT (skywind3000/ECDICT, MIT)
  - CC-CEDICT (CC BY-SA 4.0)

Usage:
  python3 scripts/build-dictionary.py
  LEXI_DICT_ECDICT=full python3 scripts/build-dictionary.py   # all single-token ECDICT rows

Default ECDICT subset: frq > 0 or collins >= 2 (~42k lemmas, smaller download for the app).
"""
from __future__ import annotations

import csv
import gzip
import json
import os
import re
import subprocess
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "dict"
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

OEWN_ZIP = (
    "https://github.com/globalwordnet/english-wordnet/releases/download/"
    "2025-edition/english-wordnet-2025-json.zip"
)
ECDICT_CSV = "https://github.com/skywind3000/ECDICT/raw/master/ecdict.csv"
CEDICT_GZ = (
    "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"
)


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1000:
        print("exists:", dest.name, f"({dest.stat().st_size} bytes)")
        return
    print("download:", url)
    subprocess.check_call(["curl", "-fL", "--retry", "3", "-o", str(dest), url])


def write_json_gz(name: str, obj: object) -> int:
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    dest = OUT / name
    with gzip.open(dest, "wb", compresslevel=9) as f:
        f.write(raw)
    print(f"  wrote {name}: {len(raw)/1e6:.2f} MB json → {dest.stat().st_size/1e6:.2f} MB gz")
    return dest.stat().st_size


def build_oewn() -> dict:
    zpath = RAW / "english-wordnet-2025-json.zip"
    download(OEWN_ZIP, zpath)
    odir = RAW / "oewn2025"
    if not odir.exists() or not any(odir.glob("entries-*.json")):
        if odir.exists():
            import shutil

            shutil.rmtree(odir)
        odir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(odir)

    synsets: dict = {}
    for f in odir.glob("*.json"):
        if f.name.startswith("entries") or f.name == "frames.json":
            continue
        synsets.update(json.loads(f.read_text(encoding="utf-8")))
    print("OEWN synsets:", len(synsets))

    pos_map = {"n": "noun", "v": "verb", "a": "adj", "s": "adj", "r": "adv"}
    lemma_senses: dict[str, list] = defaultdict(list)
    lemma_pron: dict[str, str] = {}

    for f in sorted(odir.glob("entries-*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        for lemma, posdict in data.items():
            if not isinstance(posdict, dict):
                continue
            key = lemma.lower()
            for pos, info in posdict.items():
                if not isinstance(info, dict):
                    continue
                prons = info.get("pronunciation") or []
                if prons and key not in lemma_pron:
                    us = next(
                        (p.get("value") for p in prons if p.get("variety") == "US"),
                        None,
                    )
                    lemma_pron[key] = us or prons[0].get("value")
                for sense in info.get("sense") or []:
                    sid = sense.get("synset")
                    ss = synsets.get(sid) if sid else None
                    if not ss:
                        continue
                    defs = ss.get("definition") or []
                    if not defs:
                        continue
                    lemma_senses[key].append(
                        {"pos": pos_map.get(pos, pos), "def": str(defs[0])[:320]}
                    )

    out: dict = {}
    for lem, senses in lemma_senses.items():
        seen: set[str] = set()
        uniq = []
        for s in senses:
            if s["def"] in seen:
                continue
            seen.add(s["def"])
            uniq.append(s)
            if len(uniq) >= 5:
                break
        out[lem] = {
            "p": lemma_pron.get(lem),
            "s": [[s["pos"], s["def"]] for s in uniq],
        }
    print("OEWN lemmas:", len(out))
    return out


def build_ecdict() -> dict:
    cpath = RAW / "ecdict.csv"
    download(ECDICT_CSV, cpath)
    full = os.environ.get("LEXI_DICT_ECDICT", "").lower() in {"1", "full", "all"}
    rows: dict = {}
    kept = 0
    with cpath.open(newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            w = (row.get("word") or "").strip().lower()
            if not w or any(c.isspace() for c in w):
                continue
            trans = (row.get("translation") or "").replace("\r", "").strip()
            if not trans:
                continue
            try:
                frq = int(row.get("frq") or 0)
            except ValueError:
                frq = 0
            collins_raw = row.get("collins") or ""
            try:
                collins = int(collins_raw) if str(collins_raw).isdigit() else 0
            except ValueError:
                collins = 0

            if not full and not (frq > 0 or collins >= 2):
                continue

            if len(trans) > 280:
                trans = trans[:277] + "…"
            phonetic = (row.get("phonetic") or "").strip() or None
            pos = (row.get("pos") or "").strip() or None
            score = frq if frq > 0 else 10**9
            prev = rows.get(w)
            if prev and prev["_score"] <= score:
                continue
            rows[w] = {
                "p": phonetic,
                "t": trans,
                "pos": pos,
                "frq": frq or None,
                "_score": score,
            }
            kept += 1

    for v in rows.values():
        v.pop("_score", None)
    print("ECDICT lemmas:", len(rows), "(full)" if full else "(frq>0|collins>=2)")
    return rows


def build_cedict() -> tuple[dict, dict]:
    gz = RAW / "cedict.txt.gz"
    download(CEDICT_GZ, gz)
    txt = RAW / "cedict.txt"
    if not txt.exists():
        txt.write_bytes(gzip.open(gz).read())

    line_re = re.compile(r"^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.+)\/\s*$")
    zh: dict = {}
    trad: dict = {}
    parsed = 0
    for line in txt.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        m = line_re.match(line)
        if not m:
            continue
        T, S, pin, defs_raw = m.groups()
        parsed += 1
        defs = [
            d.strip()
            for d in defs_raw.split("/")
            if d.strip() and not re.match(r"^(surname )", d.strip(), re.I)
        ][:6]
        if not defs:
            continue
        if S not in zh:
            zh[S] = [pin, *defs]
        else:
            merged = list(dict.fromkeys([*zh[S][1:], *defs]))[:8]
            zh[S] = [zh[S][0] or pin, *merged]
        if T != S and T not in trad:
            trad[T] = S
    print("CEDICT parsed:", parsed, "zh:", len(zh), "trad:", len(trad))
    return zh, trad


def main() -> None:
    print("Building Lexi dictionary packs…")
    en_defs = build_oewn()
    en_zh = build_ecdict()
    zh, trad = build_cedict()

    # Remove old Webster-era files if present
    for stale in ("en-defs.json", "en-zh.json", "zh-cedict.json", "trad-map.json"):
        p = OUT / stale
        if p.exists():
            p.unlink()

    bytes_out = {
        "en-defs.json.gz": write_json_gz("en-defs.json.gz", en_defs),
        "en-zh.json.gz": write_json_gz("en-zh.json.gz", en_zh),
        "zh-cedict.json.gz": write_json_gz("zh-cedict.json.gz", zh),
        "trad-map.json.gz": write_json_gz("trad-map.json.gz", trad),
    }

    meta = {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "format": {
            "en-defs.json.gz": '{ lemma: { p: phonetic|null, s: [[pos, definition], ...] } }  // Open English Wordnet 2025',
            "en-zh.json.gz": '{ lemma: { p, t: translation, pos, frq } }  // ECDICT subset',
            "zh-cedict.json.gz": "{ simplified: [pinyin, def1, ...] }",
            "trad-map.json.gz": "{ traditional: simplified }",
        },
        "sources": [
            {
                "name": "Open English Wordnet 2025",
                "license": "Princeton WordNet License / Open English WordNet terms",
                "url": "https://en-word.net/",
                "release": "https://github.com/globalwordnet/english-wordnet/releases/tag/2025-edition",
            },
            {
                "name": "ECDICT",
                "license": "MIT",
                "url": "https://github.com/skywind3000/ECDICT",
                "note": "Default pack: frq>0 or collins>=2. Full: LEXI_DICT_ECDICT=full",
            },
            {
                "name": "CC-CEDICT",
                "license": "CC BY-SA 4.0",
                "url": "https://www.mdbg.net/chinese/dictionary?page=cc-cedict",
            },
        ],
        "stats": {
            "enDefs": len(en_defs),
            "enZh": len(en_zh),
            "zhEntries": len(zh),
            "tradMap": len(trad),
            "ecdictMode": os.environ.get("LEXI_DICT_ECDICT", "subset"),
            "bytes": bytes_out,
            "shippedMB": round(sum(bytes_out.values()) / 1e6, 2),
        },
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print("meta stats:", json.dumps(meta["stats"], indent=2))
    print("done →", OUT)


if __name__ == "__main__":
    main()
