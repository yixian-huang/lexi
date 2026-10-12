import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { lookup, type DictionaryEntry } from "../dictionary";
import { addVocab } from "../storage/vocab";

type Props = {
  onSaved?: () => void;
};

export default function Dictionary({ onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState<DictionaryEntry | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotFound(false);
    setSavedMsg(null);
    setSavedOk(false);
    setResult(null);
    setLoading(true);

    try {
      const q = query.trim();
      if (!q) {
        setError("Enter a word or phrase to look up.");
        return;
      }

      const entry = await lookup(q);
      if (!entry) {
        setNotFound(true);
        return;
      }
      setResult(entry);
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
        setNotFound(false);
        setResult(null);
        setSavedMsg(null);
      } else {
        inputRef.current?.blur();
      }
    }
  }

  function saveCard() {
    if (!result) return;
    const front = result.headword;
    const back =
      result.language === "en"
        ? result.glossesZh[0] ||
          result.senses[0]?.definitions[0] ||
          "(no gloss)"
        : result.glossesEn[0] ||
          result.senses[0]?.definitions[0] ||
          "(no gloss)";
    addVocab(front, back, result.phonetic || undefined);
    setSavedMsg(`Saved “${front}” — open Practice to review.`);
    setSavedOk(true);
    onSaved?.();
  }

  const showIdle = !loading && !error && !notFound && !result;

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Dictionary</h2>
          <p className="hint">
            Offline · Open English Wordnet + ECDICT (EN→ZH) + CC-CEDICT
            (ZH→EN). No network for lookup.
          </p>
        </div>
      </header>

      <form className="search-row" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="Try serendipity or 你好"
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
      <p className="kbd-hint">Enter to look up · Esc clears · local packs</p>

      {loading && (
        <div className="state-block loading" role="status">
          <span className="spinner lg" aria-hidden />
          <div>
            <strong>Looking up…</strong>
            <p>Searching on-device Wordnet / ECDICT / CEDICT packs.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="banner error" role="alert">
          <strong>Dictionary data error</strong>
          <p>{error}</p>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setError(null);
              inputRef.current?.focus();
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {savedMsg && (
        <div className={`banner ${savedOk ? "ok" : "muted"}`} role="status">
          {savedMsg}
        </div>
      )}

      {showIdle && (
        <div className="state-block empty">
          <div className="empty-icon" aria-hidden>
            📖
          </div>
          <strong>Search a word to get started</strong>
          <p>
            English senses from Open English Wordnet 2025, learner Chinese
            glosses from ECDICT, and Chinese entries from CC-CEDICT — all on
            device (~10&nbsp;MB).
          </p>
        </div>
      )}

      {notFound && !loading && (
        <div className="state-block empty" role="status">
          <div className="empty-icon" aria-hidden>
            ∅
          </div>
          <strong>Not in the local dictionary</strong>
          <p>
            No entry for “{query.trim()}”. Try another spelling, or use{" "}
            <em>Translate</em> for free-form sentences (online). Rebuild with{" "}
            <code>npm run dict:build</code> /{" "}
            <code>npm run dict:build:full</code> for a larger ECDICT pack.
          </p>
        </div>
      )}

      {result && !loading && (
        <article className="card result">
          <header className="result-head">
            <div>
              <h3>{result.headword}</h3>
              {result.phonetic && (
                <span className="phonetic">/{result.phonetic}/</span>
              )}
              {result.traditional && (
                <span className="phonetic"> · trad. {result.traditional}</span>
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

          {result.language === "en" && result.glossesZh.length > 0 && (
            <div className="zh-meaning">
              <span className="label">中文 · ECDICT</span>
              <span className="zh-text">{result.glossesZh.join(" · ")}</span>
            </div>
          )}

          {result.language === "zh" && result.glossesEn.length > 0 && (
            <div className="zh-meaning">
              <span className="label">English · CEDICT</span>
              <span className="zh-text">{result.glossesEn.join(" · ")}</span>
            </div>
          )}

          {result.senses.map((sense, i) => (
            <div key={i} className="sense">
              <span className="pos">{sense.partOfSpeech}</span>
              <ol>
                {sense.definitions.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ol>
            </div>
          ))}

          <p className="hint small">
            {result.language === "en"
              ? "Senses: Open English Wordnet 2025 · Gloss: ECDICT (MIT)"
              : "Source: CC-CEDICT (CC BY-SA 4.0)"}
          </p>
        </article>
      )}
    </section>
  );
}
