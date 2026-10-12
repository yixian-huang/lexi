import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  isChinese,
  lookupEnglish,
  type DictionaryResult,
} from "../api/dictionary";
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
  const [savedOk, setSavedOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setSavedOk(false);
    setResult(null);
    setLoading(true);

    try {
      const q = query.trim();
      if (!q) throw new Error("Enter a word or phrase to look up.");

      if (isChinese(q)) {
        const tr = await translate(q, "zh-CN|en");
        let dict: DictionaryResult | null = null;
        try {
          dict = await lookupEnglish(
            tr.translated.split(/\s+/)[0] || tr.translated,
          );
        } catch {
          /* translation-only fallback */
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

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (query) {
        setQuery("");
        setError(null);
        setResult(null);
        setSavedMsg(null);
      } else {
        inputRef.current?.blur();
      }
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
    setSavedMsg(`Saved “${front}” — open Practice to review.`);
    setSavedOk(true);
    onSaved?.();
  }

  const showEmpty = !loading && !error && !result;

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Dictionary</h2>
          <p className="hint">
            English definitions + phonetic + 中文, or Chinese → English meaning.
          </p>
        </div>
      </header>

      <form className="search-row" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="Try serendipity or 偶然"
          autoFocus
          aria-label="Word or phrase"
          disabled={loading}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !query.trim()}
        >
          {loading ? (
            <>
              <span className="spinner" aria-hidden />
              Looking up…
            </>
          ) : (
            "Look up"
          )}
        </button>
      </form>
      <p className="kbd-hint">Enter to look up · Esc clears</p>

      {loading && (
        <div className="state-block loading" role="status">
          <span className="spinner lg" aria-hidden />
          <div>
            <strong>Looking up…</strong>
            <p>Fetching dictionary and translation.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="banner error" role="alert">
          <strong>Couldn’t look that up</strong>
          <p>{error}</p>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setError(null);
              inputRef.current?.focus();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {savedMsg && (
        <div className={`banner ${savedOk ? "ok" : "muted"}`} role="status">
          {savedMsg}
        </div>
      )}

      {showEmpty && (
        <div className="state-block empty">
          <div className="empty-icon" aria-hidden>
            📖
          </div>
          <strong>Search a word to get started</strong>
          <p>
            You’ll see definitions, pronunciation, and a Chinese gloss. Save
            anything useful to Practice.
          </p>
        </div>
      )}

      {result && !loading && (
        <article className="card result">
          <header className="result-head">
            <div>
              <h3>{result.word}</h3>
              {result.phonetic && (
                <span className="phonetic">{result.phonetic}</span>
              )}
            </div>
            <button
              type="button"
              className="btn-accent"
              onClick={saveCard}
              disabled={savedOk}
            >
              {savedOk ? "Saved ✓" : "Save to Practice"}
            </button>
          </header>

          {result.zhMeaning && (
            <p className="zh-meaning">
              <span className="label">中文</span>
              <span className="zh-text">{result.zhMeaning}</span>
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
