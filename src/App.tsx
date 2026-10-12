import { useState } from "react";
import Dictionary from "./components/Dictionary";
import Translate from "./components/Translate";
import Practice from "./components/Practice";
import "./App.css";

type Tab = "dictionary" | "translate" | "practice";

function App() {
  const [tab, setTab] = useState<Tab>("dictionary");
  const [vocabTick, setVocabTick] = useState(0);

  function bumpVocab() {
    setVocabTick((t) => t + 1);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo-mark">L</span>
          <div>
            <h1>Lexi</h1>
            <p>English ↔ 中文 tutor</p>
          </div>
        </div>
        <nav className="tabs" aria-label="Main">
          {(
            [
              ["dictionary", "Dictionary"],
              ["translate", "Translate"],
              ["practice", "Practice"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "tab active" : "tab"}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {tab === "dictionary" && <Dictionary onSaved={bumpVocab} />}
        {tab === "translate" && <Translate onSaved={bumpVocab} />}
        {tab === "practice" && <Practice refreshKey={vocabTick} />}
      </main>

      <footer className="footer">
        Free APIs · offline-safe errors · vocab in localStorage
      </footer>
    </div>
  );
}

export default App;
