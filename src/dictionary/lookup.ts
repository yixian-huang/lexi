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
  const oewn = enDefs[lemma];
  const ecdict = enZh[lemma];

  if (!oewn && !ecdict) {
    return null;
  }

  const senses =
    oewn?.s?.map(([pos, def]) => ({
      partOfSpeech: pos,
      definitions: [def],
    })) ?? [];

  // If OEWN missing but ECDICT has English definition-like content, surface translation as sense
  if (senses.length === 0 && ecdict?.t) {
    senses.push({
      partOfSpeech: ecdict.pos || "gloss",
      definitions: ecdict.t.split(/\n+/).map((s) => s.trim()).filter(Boolean),
    });
  }

  const glossesZh: string[] = [];
  if (ecdict?.t) {
    // Prefer first line / semicolon chunks as short gloss chips
    const flat = ecdict.t.replace(/\n+/g, "；");
    for (const part of flat.split(/[;；]/)) {
      const p = part.trim();
      if (p) glossesZh.push(p);
      if (glossesZh.length >= 6) break;
    }
  }

  const phonetic = oewn?.p || ecdict?.p || null;

  return {
    query: q,
    headword: lemma,
    language: "en",
    phonetic,
    senses,
    glossesZh,
    glossesEn: [],
    traditional: null,
    source: "local",
  };
}

export async function lookupAsResult(
  query: string,
): Promise<DictionaryResult | null> {
  const entry = await lookup(query);
  return entry ? toResult(entry) : null;
}
