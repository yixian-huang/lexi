import type { DictionaryEntry, DictionaryResult } from "./types";
import { isChineseQuery, loadDictionaryPacks } from "./load";

export { isChineseQuery as isChinese };

function toResult(entry: DictionaryEntry): DictionaryResult {
  const zhMeaning =
    entry.language === "en"
      ? entry.glossesZh[0] ?? null
      : entry.headword;
  return {
    ...entry,
    word: entry.headword,
    zhMeaning,
    audioUrl: null,
  };
}

/**
 * Local-first dictionary lookup.
 * Returns null when the query is not in the shipped packs (not a network error).
 */
export async function lookup(query: string): Promise<DictionaryEntry | null> {
  const q = query.trim();
  if (!q) return null;

  const { enDefs, zh, enZh, trad } = await loadDictionaryPacks();

  if (isChineseQuery(q)) {
    const key = trad[q] || q;
    const row = zh[key] || zh[q];
    if (!row || row.length < 2) return null;
    const [pinyin, ...defs] = row;
    // Also try exact traditional key if mapped row missing defs on trad form stored as simp
    return {
      query: q,
      headword: key,
      language: "zh",
      phonetic: pinyin || null,
      senses: [
        {
          partOfSpeech: "cedict",
          definitions: defs,
        },
      ],
      glossesZh: [key],
      glossesEn: defs,
      traditional: q !== key ? q : null,
      source: "local",
    };
  }

  const lemma = q.toLowerCase();
  const sensesRaw = enDefs[lemma];
  const zhGlosses = enZh[lemma] || [];

  if (!sensesRaw && zhGlosses.length === 0) {
    return null;
  }

  const senses =
    sensesRaw?.map((defs) => ({
      partOfSpeech: "def",
      definitions: defs,
    })) ??
    (zhGlosses.length
      ? [
          {
            partOfSpeech: "gloss",
            definitions: zhGlosses.map(
              ([z, p]) => `${z}${p ? ` (${p})` : ""}`,
            ),
          },
        ]
      : []);

  return {
    query: q,
    headword: lemma,
    language: "en",
    phonetic: null,
    senses,
    glossesZh: zhGlosses.map(([z]) => z),
    glossesEn: [],
    traditional: null,
    source: "local",
  };
}

/** UI helper: DictionaryEntry shaped like the old DictionaryResult. */
export async function lookupAsResult(
  query: string,
): Promise<DictionaryResult | null> {
  const entry = await lookup(query);
  return entry ? toResult(entry) : null;
}
