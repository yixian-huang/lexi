/**
 * Compatibility re-export. Prefer `import { lookup } from "../dictionary"`.
 * Dictionary tab is local-only — Free Dictionary API is not used.
 */
export type { DictionaryEntry, DictionarySense, DictionaryResult } from "../dictionary/types";
export { isChinese, lookup, lookupAsResult } from "../dictionary";
