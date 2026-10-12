import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Grade,
  type VocabCard,
  listVocab,
  previewNextInterval,
  removeVocab,
  clearVocab,
  reviewCard,
} from "../storage/vocab";
import {
  buildSessionQueue,
  classifyCard,
  computeDeckStats,
  formatDue,
  formatInterval,
} from "../storage/srs";

type Props = {
  refreshKey: number;
  onDeckChange?: () => void;
};

type QueueMode = "due" | "learning" | "ahead" | "empty";

export default function Practice({ refreshKey, onDeckChange }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [sessionGood, setSessionGood] = useState(0);
  const [sessionHard, setSessionHard] = useState(0);
  const [sessionAgain, setSessionAgain] = useState(0);
  const [deckTick, setDeckTick] = useState(0);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [queueMode, setQueueMode] = useState<QueueMode>("empty");
  const [lastHint, setLastHint] = useState<string | null>(null);
  const [queueEpoch, setQueueEpoch] = useState(0);

  const allCards = useMemo(
    () => listVocab(),
    [refreshKey, deckTick],
  );
  const stats = useMemo(() => computeDeckStats(allCards), [allCards]);
  const byId = useMemo(() => {
    const m = new Map<string, VocabCard>();
    for (const c of allCards) m.set(c.id, c);
    return m;
  }, [allCards]);

  const rebuildQueue = useCallback(() => {
    const cards = listVocab();
    const { queue, mode } = buildSessionQueue(cards);
    setQueueIds(queue.map((c) => c.id));
    setQueueMode(mode);
    setFlipped(false);
    setQueueEpoch((e) => e + 1);
  }, []);

  // Rebuild when deck changes from outside (save / clear / tab refresh)
  useEffect(() => {
    rebuildQueue();
  }, [refreshKey, deckTick, rebuildQueue]);

  const current: VocabCard | null =
    queueIds.length > 0 ? (byId.get(queueIds[0]) ?? null) : null;

  // Drop stale head if card was deleted
  useEffect(() => {
    if (queueIds.length === 0) return;
    if (!byId.has(queueIds[0])) {
      setQueueIds((ids) => ids.filter((id) => byId.has(id)));
    }
  }, [byId, queueIds]);

  function notifyDeck() {
    setDeckTick((t) => t + 1);
    onDeckChange?.();
  }

  function onGrade(grade: Grade) {
    if (!current) return;
    const hint = previewNextInterval(current, grade);
    reviewCard(current.id, grade);
    if (grade === "again") setSessionAgain((n) => n + 1);
    else if (grade === "hard") setSessionHard((n) => n + 1);
    else setSessionGood((n) => n + 1);
    setLastHint(`Scheduled · next review ${hint}`);
    setFlipped(false);
    // Bump deckTick → effect rebuilds queue from updated dues
    notifyDeck();
  }

  function skip() {
    if (queueIds.length <= 1) return;
    setFlipped(false);
    setQueueIds((ids) => [...ids.slice(1), ids[0]]);
  }

  function onDelete() {
    if (!current) return;
    removeVocab(current.id);
    setFlipped(false);
    setQueueIds((ids) => ids.filter((id) => id !== current.id));
    notifyDeck();
  }

  function onClear() {
    if (!confirm("Clear all saved vocabulary?")) return;
    clearVocab();
    setQueueIds([]);
    setQueueMode("empty");
    setFlipped(false);
    setSessionGood(0);
    setSessionHard(0);
    setSessionAgain(0);
    setLastHint(null);
    notifyDeck();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!current) return;

      if (e.key === " " || e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        skip();
      } else if (e.key === "1" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        onGrade("again");
      } else if (e.key === "2" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        onGrade("hard");
      } else if (e.key === "3" || e.key === "g" || e.key === "G") {
        e.preventDefault();
        onGrade("good");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Re-bind when current card or queue head changes
  }, [current, queueIds, queueEpoch]);

  const modeBanner =
    queueMode === "due"
      ? "Due for review"
      : queueMode === "learning"
        ? "No cards due — practicing new / learning"
        : queueMode === "ahead"
          ? "All caught up — studying ahead"
          : null;

  const remaining = queueIds.length;
  const showCard = current && byId.has(current.id);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Practice</h2>
          <p className="hint">
            Spaced repetition (SM-2-like). Save words from Dictionary or
            Translate, then review due cards here.
          </p>
        </div>
      </header>

      <div className="stats-row srs-stats">
        <div className="stat-pill dueish" title="Due right now">
          <span className="stat-label">Due</span>
          <strong>{stats.dueNow}</strong>
        </div>
        <div className="stat-pill" title="Due by end of today">
          <span className="stat-label">Today</span>
          <strong>{stats.dueToday}</strong>
        </div>
        <div className="stat-pill warnish" title="New + learning">
          <span className="stat-label">Learning</span>
          <strong>{stats.newCount + stats.learning}</strong>
        </div>
        <div className="stat-pill okish" title="Interval ≥ 21 days, reps ≥ 3">
          <span className="stat-label">Mastered</span>
          <strong>{stats.mastered}</strong>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Deck</span>
          <strong>{stats.total}</strong>
        </div>
        {allCards.length > 0 && (
          <button type="button" className="btn-ghost-danger" onClick={onClear}>
            Clear deck
          </button>
        )}
      </div>

      {allCards.length === 0 ? (
        <div className="state-block empty">
          <div className="empty-icon" aria-hidden>
            🃏
          </div>
          <strong>Your deck is empty</strong>
          <p>
            Save words from Dictionary or Translate, then review them with
            Again / Hard / Good scheduling.
          </p>
        </div>
      ) : !showCard ? (
        <div className="state-block empty">
          <div className="empty-icon" aria-hidden>
            ✓
          </div>
          <strong>Session clear</strong>
          <p>
            Nothing left in this queue.{" "}
            {stats.dueNow === 0
              ? "Come back when cards are due, or save more words."
              : "Rebuild to continue."}
          </p>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={rebuildQueue}
          >
            Rebuild queue
          </button>
        </div>
      ) : (
        <>
          {modeBanner && (
            <div className={`session-banner mode-${queueMode}`}>
              <span>{modeBanner}</span>
              <span className="session-remain">
                {remaining} left
                <span className="dot">·</span>
                session A {sessionAgain} / H {sessionHard} / G {sessionGood}
              </span>
            </div>
          )}

          {lastHint && (
            <div className="banner ok srs-hint" role="status">
              {lastHint}
            </div>
          )}

          <div
            className={`flashcard ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            aria-label={flipped ? "Card back" : "Card front"}
          >
            <div className="flash-face">
              <div className="flash-meta">
                <span className="label">{flipped ? "Back" : "Front"}</span>
                <span className="srs-chip">
                  {classifyCard(current)}
                  <span className="dot">·</span>
                  due {formatDue(current.due)}
                </span>
              </div>
              <p className="flash-text">
                {flipped ? current.back : current.front}
              </p>
              {!flipped && current.note && (
                <p className="phonetic">{current.note}</p>
              )}
              <p className="hint small">
                Click · Space / F to flip · 1 Again · 2 Hard · 3 Good
              </p>
            </div>
          </div>

          <div className="grade-actions">
            <button
              type="button"
              className="btn-dont"
              onClick={() => onGrade("again")}
              title={`Again — next in ${previewNextInterval(current, "again")}`}
            >
              <span className="grade-key">1</span>
              Again
              <span className="grade-sub">
                {previewNextInterval(current, "again")}
              </span>
            </button>
            <button
              type="button"
              className="btn-hard"
              onClick={() => onGrade("hard")}
              title={`Hard — next in ${previewNextInterval(current, "hard")}`}
            >
              <span className="grade-key">2</span>
              Hard
              <span className="grade-sub">
                {previewNextInterval(current, "hard")}
              </span>
            </button>
            <button
              type="button"
              className="btn-know"
              onClick={() => onGrade("good")}
              title={`Good — next in ${previewNextInterval(current, "good")}`}
            >
              <span className="grade-key">3</span>
              Good
              <span className="grade-sub">
                {previewNextInterval(current, "good")}
              </span>
            </button>
          </div>

          <div className="practice-secondary">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={skip}
              disabled={queueIds.length < 2}
            >
              Skip →
            </button>
          </div>

          <p className="hint small center meta-line">
            EF {current.ease.toFixed(1)}
            <span className="dot">·</span>
            interval {formatInterval(current.interval)}
            <span className="dot">·</span>
            reps {current.reps} / lapses {current.lapses}
            <span className="dot">·</span>
            <button type="button" className="linkish" onClick={onDelete}>
              Remove card
            </button>
          </p>
        </>
      )}

      {allCards.length > 0 && (
        <details className="deck-list">
          <summary>All saved words ({allCards.length})</summary>
          <ul>
            {allCards.map((c) => (
              <li key={c.id}>
                <strong>{c.front}</strong>
                <span className="deck-sep">—</span>
                {c.back}
                <span className="deck-srs">
                  {classifyCard(c)} · {formatDue(c.due)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
