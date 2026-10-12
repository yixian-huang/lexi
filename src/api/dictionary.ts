export type DictionarySense = {
  partOfSpeech: string;
  definitions: string[];
  synonyms: string[];
};

export type DictionaryResult = {
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  senses: DictionarySense[];
  zhMeaning: string | null;
  source: "dictionaryapi" | "translate-only";
};

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export { isChinese };

export async function lookupEnglish(word: string): Promise<DictionaryResult> {
  const q = word.trim();
  if (!q) throw new Error("Enter a word to look up.");

  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  if (res.status === 404) {
    throw new Error(`No dictionary entry found for “${q}”.`);
  }
  if (!res.ok) {
    throw new Error(`Dictionary API error (${res.status}). Try again later.`);
  }

  const data = (await res.json()) as Array<{
    word: string;
    phonetic?: string;
    phonetics?: Array<{ text?: string; audio?: string }>;
    meanings?: Array<{
      partOfSpeech?: string;
      definitions?: Array<{ definition?: string; synonyms?: string[] }>;
      synonyms?: string[];
    }>;
  }>;

  const entry = data[0];
  if (!entry) throw new Error(`No dictionary entry found for “${q}”.`);

  const phonetic =
    entry.phonetic ||
    entry.phonetics?.find((p) => p.text)?.text ||
    null;
  const audioUrl =
    entry.phonetics?.find((p) => p.audio)?.audio || null;

  const senses: DictionarySense[] = (entry.meanings || []).map((m) => ({
    partOfSpeech: m.partOfSpeech || "unknown",
    definitions: (m.definitions || [])
      .map((d) => d.definition || "")
      .filter(Boolean)
      .slice(0, 4),
    synonyms: [
      ...(m.synonyms || []),
      ...(m.definitions || []).flatMap((d) => d.synonyms || []),
    ].slice(0, 8),
  }));

  return {
    word: entry.word || q,
    phonetic,
    audioUrl,
    senses,
    zhMeaning: null,
    source: "dictionaryapi",
  };
}
