import { useMemo, useState } from "react";
import {
  VocabCard,
  listVocab,
  markKnown,
  removeVocab,
  clearVocab,
} from "../storage/vocab";

type Props = {
  refreshKey: number;
};

export default function Practice({ refreshKey }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionKnown, setSessionKnown] = useState(0);
  const [sessionUnknown, setSessionUnknown] = useState(0);
  const [listTick, setListTick] = useState(0);

  const liveCards = useMemo(() => listVocab(), [refreshKey, listTick]);
  const safeIndex =
    liveCards.length === 0 ? 0 : Math.min(index, liveCards.length - 1);
  const current: VocabCard | null = liveCards[safeIndex] ?? null;

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
    setListTick((t) => t + 1);
    setFlipped(false);
    if (liveCards.length > 1) {
      setIndex((i) => (i + 1) % liveCards.length);
    }
  }

  function onDelete() {
    if (!current) return;
    removeVocab(current.id);
    setFlipped(false);
    setListTick((t) => t + 1);
    setIndex(0);
  }

  function onClear() {
    if (!confirm("Clear all saved vocabulary?")) return;
    clearVocab();
    setIndex(0);
    setFlipped(false);
    setSessionKnown(0);
    setSessionUnknown(0);
    setListTick((t) => t + 1);
  }

  return (
    <section className="panel">
      <h2>Practice</h2>
      <p className="hint">
        Flashcards from words you saved. Progress is stored in this browser
        (localStorage).
      </p>

      <div className="stats-row">
        <span>
          Deck: <strong>{liveCards.length}</strong>
        </span>
        <span>
          Session ✓ <strong>{sessionKnown}</strong> / ✗{" "}
          <strong>{sessionUnknown}</strong>
        </span>
        {liveCards.length > 0 && (
          <button type="button" className="danger ghost" onClick={onClear}>
            Clear deck
          </button>
        )}
      </div>

      {liveCards.length === 0 ? (
        <div className="banner muted">
          No cards yet. Save words from Dictionary or Translate.
        </div>
      ) : current ? (
        <>
          <div
            className={`flashcard ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setFlipped((f) => !f);
              }
            }}
          >
            <div className="flash-face">
              <span className="label">{flipped ? "Back" : "Front"}</span>
              <p className="flash-text">
                {flipped ? current.back : current.front}
              </p>
              {!flipped && current.note && (
                <p className="phonetic">{current.note}</p>
              )}
              <p className="hint small">Click or press Space to flip</p>
            </div>
          </div>

          <div className="practice-actions">
            <button type="button" className="secondary" onClick={() => next(-1)}>
              ← Prev
            </button>
            <button type="button" className="danger" onClick={() => onMark(false)}>
              Don&apos;t know
            </button>
            <button type="button" onClick={() => onMark(true)}>
              Know
            </button>
            <button type="button" className="secondary" onClick={() => next(1)}>
              Next →
            </button>
          </div>

          <p className="hint small center">
            Card {safeIndex + 1} / {liveCards.length} · lifetime ✓{" "}
            {current.knownCount} / ✗ {current.unknownCount}
            {" · "}
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
                <strong>{c.front}</strong> — {c.back}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
