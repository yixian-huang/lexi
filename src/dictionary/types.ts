/** Local dictionary entry returned by lookup(). Designed for future sync. */
export type DictionarySense = {
  partOfSpeech: string;
  definitions: string[];
  synonyms?: string[];
};

export type DictionaryEntry = {
  /** Original query string */
  query: string;
  /** Normalized headword shown in UI */
  headword: string;
  /** Detected query language */
  language: "en" | "zh";
  /** IPA (EN) or pinyin (ZH), when available */
  phonetic: string | null;
  senses: DictionarySense[];
  /** Chinese glosses for an English query */
  glossesZh: string[];
  /** English glosses for a Chinese query */
  glossesEn: string[];
  traditional: string | null;
  /** Always local for Dictionary tab */
  source: "local";
};

/** @deprecated Use DictionaryEntry — kept for gradual UI migration */
export type DictionaryResult = DictionaryEntry & {
  word: string;
  zhMeaning: string | null;
  audioUrl: string | null;
};
