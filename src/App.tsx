import { useCallback, useEffect, useState } from "react";
import Dictionary from "./components/Dictionary";
import Translate from "./components/Translate";
import Practice from "./components/Practice";
import UpdaterBanner from "./components/UpdaterBanner";
import "./App.css";

type Tab = "dictionary" | "translate" | "practice";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "dictionary", label: "Dictionary", hint: "1" },
  { id: "translate", label: "Translate", hint: "2" },
  { id: "practice", label: "Practice", hint: "3" },
];

function App() {
  const [tab, setTab] = useState<Tab>("dictionary");
  const [vocabTick, setVocabTick] = useState(0);
  const [vocabCount, setVocabCount] = useState(0);

  const bumpVocab = useCallback(() => {
    setVocabTick((t) => t + 1);
    try {
      const raw = localStorage.getItem("lexi-vocab-v1");
      const n = raw ? (JSON.parse(raw) as unknown[]).length : 0;
      setVocabCount(Number.isFinite(n) ? n : 0);
    } catch {
      setVocabCount(0);
    }
  }, []);

  useEffect(() => {
    bumpVocab();
  }, [bumpVocab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === "1") {
          e.preventDefault();
          setTab("dictionary");
        } else if (e.key === "2") {
          e.preventDefault();
          setTab("translate");
        } else if (e.key === "3") {
          e.preventDefault();
          setTab("practice");
        }
      }
      if (e.key === "Escape") {
        const el = document.activeElement;
        if (el instanceof HTMLElement && el !== document.body) {
          el.blur();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <header className="shell-header">
        <div className="brand">
          <span className="logo-mark" aria-hidden>
            L
          </span>
          <div className="brand-text">
            <h1>Lexi</h1>
            <p>English ↔ 中文 · personal tutor</p>
          </div>
        </div>

        <nav className="tabs" aria-label="Main views" role="tablist">
          {TABS.map(({ id, label, hint }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "tab active" : "tab"}
              onClick={() => setTab(id)}
              title={`${label} (Alt+${hint})`}
            >
              <span className="tab-label">{label}</span>
              {id === "practice" && vocabCount > 0 && (
                <span className="tab-badge">{vocabCount}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <UpdaterBanner checkOnLaunch />

      <main className="content" role="tabpanel">
        {tab === "dictionary" && <Dictionary onSaved={bumpVocab} />}
        {tab === "translate" && <Translate onSaved={bumpVocab} />}
        {tab === "practice" && (
          <Practice refreshKey={vocabTick} onDeckChange={bumpVocab} />
        )}
      </main>

      <footer className="footer">
        <span>Enter to submit · Alt+1/2/3 switch tabs · Esc blur</span>
        <span className="footer-sep">·</span>
        <span>Free APIs · deck in localStorage</span>
      </footer>
    </div>
  );
}

export default App;
