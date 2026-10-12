import { useState } from "react";
import type { FormEvent } from "react";
import { translate, LangPair, TranslateResult } from "../api/translate";
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
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

  function swap() {
    setPair((p) => {
      if (p === "en|zh-CN") return "zh-CN|en";
      if (p === "zh-CN|en") return "en|zh-CN";
      return "auto";
    });
    if (result) {
      setText(result.translated);
      setResult(null);
    }
  }

  function saveCard() {
    if (!result) return;
    const enIsFront = result.langpair === "en|zh-CN";
    const front = enIsFront ? result.text : result.translated;
    const back = enIsFront ? result.translated : result.text;
    addVocab(front, back);
    setSavedMsg(`Saved “${front}” to Practice.`);
    onSaved?.();
  }

  return (
    <section className="panel">
      <h2>Translate</h2>
      <p className="hint">Bidirectional English ↔ 中文 via MyMemory (free).</p>

      <div className="lang-row">
        <label>
          Direction
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value as LangPair)}
          >
            <option value="auto">Auto-detect</option>
            <option value="en|zh-CN">English → 中文</option>
            <option value="zh-CN|en">中文 → English</option>
          </select>
        </label>
        <button type="button" className="secondary" onClick={swap}>
          Swap ↕
        </button>
      </div>

      <form className="stack" onSubmit={onSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text…"
          rows={5}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Translating…" : "Translate"}
        </button>
      </form>

      {error && <div className="banner error">{error}</div>}
      {savedMsg && <div className="banner ok">{savedMsg}</div>}

      {result && (
        <article className="card result">
          <header className="result-head">
            <div>
              <span className="label">
                {result.langpair === "en|zh-CN"
                  ? "English → 中文"
                  : "中文 → English"}
                {pair === "auto" && result.detectedLang !== "unknown"
                  ? ` (detected ${result.detectedLang})`
                  : ""}
              </span>
            </div>
            <button type="button" className="secondary" onClick={saveCard}>
              + Save to Practice
            </button>
          </header>
          <p className="source-text">{result.text}</p>
          <p className="translated-text">{result.translated}</p>
        </article>
      )}
    </section>
  );
}
