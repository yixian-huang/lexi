import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  translate,
  type LangPair,
  type TranslateResult,
} from "../api/translate";
import { addVocab } from "../storage/vocab";

type Props = {
  onSaved?: () => void;
};

export default function Translate({ onSaved }: Props) {
  const [text, setText] = useState("");
  const [pair, setPair] = useState<LangPair>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  async function runTranslate() {
    setError(null);
    setSavedMsg(null);
    setSavedOk(false);
    setResult(null);
    setLoading(true);
    try {
      const r = await translate(text, pair);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runTranslate();
  }

  function onAreaKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void runTranslate();
    }
    if (e.key === "Escape") {
      if (text) {
        setText("");
        setError(null);
        setResult(null);
        setSavedMsg(null);
      } else {
        areaRef.current?.blur();
      }
    }
  }

  function swap() {
    setPair((p) => {
      if (p === "en|zh-CN") return "zh-CN|en";
      if (p === "zh-CN|en") return "en|zh-CN";
      return "auto";
    });
    if (result) {
      setText(result.translated);
      setResult(null);
      setSavedOk(false);
      setSavedMsg(null);
    }
  }

  function saveCard() {
    if (!result) return;
    const enIsFront = result.langpair === "en|zh-CN";
    const front = enIsFront ? result.text : result.translated;
    const back = enIsFront ? result.translated : result.text;
    addVocab(front, back);
    setSavedMsg(`Saved “${front}” — open Practice to review.`);
    setSavedOk(true);
    onSaved?.();
  }

  const showEmpty = !loading && !error && !result;

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Translate</h2>
          <p className="hint">Free-form sentences via MyMemory (online). Word lookup stays offline in Dictionary.</p>
        </div>
      </header>

      <div className="lang-row">
        <label className="field-label">
          Direction
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value as LangPair)}
            disabled={loading}
          >
            <option value="auto">Auto-detect</option>
            <option value="en|zh-CN">English → 中文</option>
            <option value="zh-CN|en">中文 → English</option>
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={swap}
          disabled={loading}
          title="Swap direction"
        >
          Swap ↕
        </button>
      </div>

      <form className="stack" onSubmit={onSubmit}>
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onAreaKey}
          placeholder="Type or paste a sentence…"
          rows={5}
          aria-label="Text to translate"
          disabled={loading}
        />
        <div className="action-row">
          <p className="kbd-hint">⌘/Ctrl+Enter to translate · Esc clears</p>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !text.trim()}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden />
                Translating…
              </>
            ) : (
              "Translate"
            )}
          </button>
        </div>
      </form>

      {loading && (
        <div className="state-block loading" role="status">
          <span className="spinner lg" aria-hidden />
          <div>
            <strong>Translating…</strong>
            <p>Talking to MyMemory.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="banner error" role="alert">
          <strong>Translation failed</strong>
          <p>{error}</p>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setError(null);
              areaRef.current?.focus();
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
            ⇄
          </div>
          <strong>Paste text to translate</strong>
          <p>
            Auto-detect picks EN or 中文. Save short phrases to your Practice
            deck.
          </p>
        </div>
      )}

      {result && !loading && (
        <article className="card result">
          <header className="result-head">
            <div>
              <span className="label">
                {result.langpair === "en|zh-CN"
                  ? "English → 中文"
                  : "中文 → English"}
                {pair === "auto" && result.detectedLang !== "unknown"
                  ? ` · detected ${result.detectedLang}`
                  : ""}
              </span>
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
          <p className="source-text">{result.text}</p>
          <p className="translated-text">{result.translated}</p>
        </article>
      )}
    </section>
  );
}
