/** Lazy-load gzipped JSON dictionary packs from /dict/*.json.gz */

async function fetchJsonGz<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load dictionary asset ${path} (${res.status})`);
  }
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream("gzip");
    const decompressed = res.body!.pipeThrough(ds);
    const text = await new Response(decompressed).text();
    return JSON.parse(text) as T;
  }
  const plain = path.replace(/\.gz$/, "");
  const res2 = await fetch(plain);
  if (!res2.ok) {
    throw new Error(
      "Gzip decompression unavailable and uncompressed dictionary missing.",
    );
  }
  return (await res2.json()) as T;
}

/** OEWN: lemma → { p: phonetic, s: [[pos, def], ...] } */
export type EnDefs = Record<
  string,
  { p?: string | null; s: [string, string][] }
>;

/** ECDICT: lemma → { p, t, pos, frq } */
export type EnZh = Record<
  string,
  { p?: string | null; t: string; pos?: string | null; frq?: number | null }
>;

/** CEDICT: simplified → [pinyin, ...defs] */
export type ZhCedict = Record<string, string[]>;

export type TradMap = Record<string, string>;

type Packs = {
  enDefs: EnDefs;
  zh: ZhCedict;
  enZh: EnZh;
  trad: TradMap;
};

let packsPromise: Promise<Packs> | null = null;

export function loadDictionaryPacks(): Promise<Packs> {
  if (!packsPromise) {
    packsPromise = (async () => {
      const [enDefs, zh, enZh, trad] = await Promise.all([
        fetchJsonGz<EnDefs>("/dict/en-defs.json.gz"),
        fetchJsonGz<ZhCedict>("/dict/zh-cedict.json.gz"),
        fetchJsonGz<EnZh>("/dict/en-zh.json.gz"),
        fetchJsonGz<TradMap>("/dict/trad-map.json.gz"),
      ]);
      return { enDefs, zh, enZh, trad };
    })();
  }
  return packsPromise;
}

/** Clear cached packs (tests / hot reload). */
export function resetDictionaryPacks(): void {
  packsPromise = null;
}

export function isChineseQuery(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}
