import { useEffect, useMemo, useState } from "react";
import {
  type VocabCard,
  listVocab,
  markKnown,
  removeVocab,
  clearVocab,
} from "../storage/vocab";

type Props = {
  refreshKey: number;
  onDeckChange?: () => void;
};

export default function Practice({ refreshKey, onDeckChange }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionKnown, setSessionKnown] = useState(0);
  const [sessionUnknown, setSessionUnknown] = useState(0);
  const [listTick, setListTick] = useState(0);

  const liveCards = useMemo(() => listVocab(), [refreshKey, listTick]);
  const safeIndex =
    liveCards.length === 0 ? 0 : Math.min(index, liveCards.length - 1);
  const current: VocabCard | null = liveCards[safeIndex] ?? null;

  function bump() {
    setListTick((t) => t + 1);
    onDeckChange?.();
  }

  function next(delta: number) {
    if (liveCards.length === 0) return;
    setFlipped(false);
    setIndex((i) => (i + delta + liveCards.length) % liveCards.length);
  }

  function onMark(known: boolean) {
    if (!current) return;
    markKnown(current.id, known);
    if (known) setSessionKnown((n) => n + 1);
    else setSessionUnknown((n) => n + 1);
    setFlipped(false);
    bump();
    if (liveCards.length > 1) {
      setIndex((i) => (i + 1) % liveCards.length);
    }
  }

  function onDelete() {
    if (!current) return;
    removeVocab(current.id);
    setFlipped(false);
    setIndex(0);
    bump();
  }

  function onClear() {
    if (!confirm("Clear all saved vocabulary?")) return;
    clearVocab();
    setIndex(0);
    setFlipped(false);
    setSessionKnown(0);
    setSessionUnknown(0);
    bump();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (liveCards.length === 0) return;

      if (e.key === " " || e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        next(1);
      } else if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        next(-1);
      } else if (e.key === "1" || e.key === "n" || e.key === "N") {
        e.preventDefault();
        onMark(false);
      } else if (e.key === "2" || e.key === "y" || e.key === "Y") {
        e.preventDefault();
        onMark(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional live handlers
  }, [liveCards, current, safeIndex]);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Practice</h2>
          <p className="hint">
            Flashcards from words you saved. Progress stays on this device.
          </p>
        </div>
      </header>

      <div className="stats-row">
        <div className="stat-pill">
          <span className="stat-label">Deck</span>
          <strong>{liveCards.length}</strong>
        </div>
        <div className="stat-pill okish">
          <span className="stat-label">Know</span>
          <strong>{sessionKnown}</strong>
        </div>
        <div className="stat-pill warnish">
          <span className="stat-label">Don’t</span>
          <strong>{sessionUnknown}</strong>
        </div>
        {liveCards.length > 0 && (
          <button type="button" className="btn-ghost-danger" onClick={onClear}>
            Clear deck
          </button>
        )}
      </div>

      {liveCards.length === 0 ? (
        <div className="state-block empty">
          <div className="empty-icon" aria-hidden>
            🃏
          </div>
          <strong>Your deck is empty</strong>
          <p>
            Save words from Dictionary or Translate, then come back here to
            flip cards and mark Know / Don’t know.
          </p>
        </div>
      ) : current ? (
        <>
          <div
            className={`flashcard ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            aria-label={flipped ? "Card back" : "Card front"}
          >
            <div className="flash-face">
              <span className="label">{flipped ? "Back" : "Front"}</span>
              <p className="flash-text">
                {flipped ? current.back : current.front}
              </p>
              {!flipped && current.note && (
                <p className="phonetic">{current.note}</p>
              )}
              <p className="hint small">
                Click · Space / F to flip · ← → navigate
              </p>
            </div>
          </div>

          <div className="practice-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => next(-1)}
            >
              ← Prev
            </button>
            <button
              type="button"
              className="btn-dont"
              onClick={() => onMark(false)}
              title="Don’t know (1 or N)"
            >
              Don’t know
            </button>
            <button
              type="button"
              className="btn-know"
              onClick={() => onMark(true)}
              title="Know (2 or Y)"
            >
              Know
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => next(1)}
            >
              Next →
            </button>
          </div>

          <p className="hint small center meta-line">
            Card {safeIndex + 1} / {liveCards.length}
            <span className="dot">·</span>
            lifetime ✓ {current.knownCount} / ✗ {current.unknownCount}
            <span className="dot">·</span>
            <button type="button" className="linkish" onClick={onDelete}>
              Remove card
            </button>
          </p>
        </>
      ) : null}

      {liveCards.length > 0 && (
        <details className="deck-list">
          <summary>All saved words ({liveCards.length})</summary>
          <ul>
            {liveCards.map((c) => (
              <li key={c.id}>
                <strong>{c.front}</strong>
                <span className="deck-sep">—</span>
                {c.back}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
