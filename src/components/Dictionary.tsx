import { useState } from "react";
import type { FormEvent } from "react";
import { isChinese, lookupEnglish, DictionaryResult } from "../api/dictionary";
import { translate } from "../api/translate";
import { addVocab } from "../storage/vocab";

type Props = {
  onSaved?: () => void;
};

export default function Dictionary({ onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setResult(null);
    setLoading(true);

    try {
      const q = query.trim();
      if (!q) throw new Error("Enter a word or phrase.");

      if (isChinese(q)) {
        const tr = await translate(q, "zh-CN|en");
        let dict: DictionaryResult | null = null;
        try {
          dict = await lookupEnglish(tr.translated.split(/\s+/)[0] || tr.translated);
        } catch {
          // Chinese query: translation is enough if dictionary miss
        }
        setResult({
          word: q,
          phonetic: dict?.phonetic ?? null,
          audioUrl: dict?.audioUrl ?? null,
          senses: dict?.senses ?? [
            {
              partOfSpeech: "translation",
              definitions: [tr.translated],
              synonyms: [],
            },
          ],
          zhMeaning: q,
          source: dict ? "dictionaryapi" : "translate-only",
        });
      } else {
        const dict = await lookupEnglish(q);
        let zh: string | null = null;
        try {
          const tr = await translate(dict.word, "en|zh-CN");
          zh = tr.translated;
        } catch {
          zh = null;
        }
        setResult({ ...dict, zhMeaning: zh });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  function saveCard() {
    if (!result) return;
    const front = result.word;
    const back =
      result.zhMeaning ||
      result.senses[0]?.definitions[0] ||
      "(no definition)";
    addVocab(front, back, result.phonetic || undefined);
    setSavedMsg(`Saved “${front}” to Practice.`);
    onSaved?.();
  }

  return (
    <section className="panel">
      <h2>Dictionary</h2>
      <p className="hint">
        Look up English words (definitions + phonetic + 中文) or Chinese
        (English meaning).
      </p>

      <form className="search-row" onSubmit={onSubmit}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. serendipity / 偶然"
          autoFocus
        />
        <button type="submit" disabled={loading}>
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>

      {error && <div className="banner error">{error}</div>}
      {savedMsg && <div className="banner ok">{savedMsg}</div>}

      {result && (
        <article className="card result">
          <header className="result-head">
            <div>
              <h3>{result.word}</h3>
              {result.phonetic && (
                <span className="phonetic">{result.phonetic}</span>
              )}
            </div>
            <button type="button" className="secondary" onClick={saveCard}>
              + Save to Practice
            </button>
          </header>

          {result.zhMeaning && (
            <p className="zh-meaning">
              <span className="label">中文</span> {result.zhMeaning}
            </p>
          )}

          {result.senses.map((sense, i) => (
            <div key={i} className="sense">
              <span className="pos">{sense.partOfSpeech}</span>
              <ol>
                {sense.definitions.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ol>
              {sense.synonyms.length > 0 && (
                <p className="synonyms">
                  Synonyms: {sense.synonyms.join(", ")}
                </p>
              )}
            </div>
          ))}

          {result.source === "translate-only" && (
            <p className="hint small">
              No Free Dictionary entry — showing MyMemory translation.
            </p>
          )}
        </article>
      )}
    </section>
  );
}
