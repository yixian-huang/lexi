/** Minimal SM-2-like scheduling for Lexi Practice. */

export type Grade = "again" | "hard" | "good";

export type SrsState = "new" | "learning" | "review" | "mastered";

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;
const AGAIN_MS = 10 * 60 * 1000; // 10 minutes
const HARD_FIRST_MS = 12 * 60 * 60 * 1000; // 12 hours

export type SrsSnapshot = {
  interval: number; // days
  ease: number;
  due: number; // epoch ms
  reps: number;
  lapses: number;
};

export function defaultSrs(now = Date.now()): SrsSnapshot {
  return {
    interval: 0,
    ease: DEFAULT_EASE,
    due: now,
    reps: 0,
    lapses: 0,
  };
}

export function classifyCard(
  card: SrsSnapshot,
  now = Date.now(),
): SrsState {
  if (card.reps === 0 && card.interval === 0) return "new";
  if (card.interval >= 21 && card.reps >= 3) return "mastered";
  if (card.interval < 1 || card.reps < 2) return "learning";
  if (card.due > now) return "review";
  return "review";
}

export function isDue(card: SrsSnapshot, now = Date.now()): boolean {
  return card.due <= now;
}

export function endOfLocalDay(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function isDueToday(card: SrsSnapshot, now = Date.now()): boolean {
  return card.due <= endOfLocalDay(now);
}

/** Apply a grade and return updated SRS fields + human interval hint. */
export function applyGrade(
  card: SrsSnapshot,
  grade: Grade,
  now = Date.now(),
): SrsSnapshot & { nextIntervalLabel: string } {
  let { interval, ease, reps, lapses } = card;
  let due: number;

  if (grade === "again") {
    lapses += 1;
    reps = 0;
    ease = Math.max(MIN_EASE, round1(ease - 0.2));
    interval = 0;
    due = now + AGAIN_MS;
    return {
      interval,
      ease,
      due,
      reps,
      lapses,
      nextIntervalLabel: "10 min",
    };
  }

  if (grade === "hard") {
    ease = Math.max(MIN_EASE, round1(ease - 0.15));
    if (reps === 0) {
      reps = 1;
      interval = 0.5;
      due = now + HARD_FIRST_MS;
      return {
        interval,
        ease,
        due,
        reps,
        lapses,
        nextIntervalLabel: "12 h",
      };
    }
    interval = Math.max(1, round1(interval * 1.2));
    reps += 1;
    due = now + Math.round(interval * DAY_MS);
    return {
      interval,
      ease,
      due,
      reps,
      lapses,
      nextIntervalLabel: formatInterval(interval),
    };
  }

  // good
  if (reps === 0) {
    interval = 1;
  } else if (reps === 1) {
    interval = 3;
  } else {
    interval = Math.max(1, round1(interval * ease));
  }
  reps += 1;
  ease = round1(ease + 0.05);
  due = now + Math.round(interval * DAY_MS);

  return {
    interval,
    ease,
    due,
    reps,
    lapses,
    nextIntervalLabel: formatInterval(interval),
  };
}

export function formatInterval(days: number): string {
  if (days <= 0) return "soon";
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `${hours} h`;
  }
  if (days < 1.05) return "1 day";
  if (days < 30) return `${Math.round(days)} days`;
  const months = days / 30;
  if (months < 12) return `${round1(months)} mo`;
  return `${round1(days / 365)} yr`;
}

export function formatDue(due: number, now = Date.now()): string {
  const delta = due - now;
  if (delta <= 0) return "due now";
  if (delta < 60 * 60 * 1000) {
    const m = Math.max(1, Math.round(delta / 60000));
    return `in ${m} min`;
  }
  if (delta < DAY_MS) {
    const h = Math.max(1, Math.round(delta / (60 * 60 * 1000)));
    return `in ${h} h`;
  }
  const days = Math.round(delta / DAY_MS);
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type DeckStats = {
  total: number;
  dueNow: number;
  dueToday: number;
  newCount: number;
  learning: number;
  review: number;
  mastered: number;
};

export function computeDeckStats(
  cards: SrsSnapshot[],
  now = Date.now(),
): DeckStats {
  const stats: DeckStats = {
    total: cards.length,
    dueNow: 0,
    dueToday: 0,
    newCount: 0,
    learning: 0,
    review: 0,
    mastered: 0,
  };
  for (const c of cards) {
    const state = classifyCard(c, now);
    if (state === "new") stats.newCount += 1;
    else if (state === "learning") stats.learning += 1;
    else if (state === "mastered") stats.mastered += 1;
    else stats.review += 1;
    if (isDue(c, now)) stats.dueNow += 1;
    if (isDueToday(c, now)) stats.dueToday += 1;
  }
  return stats;
}

/**
 * Session queue: due cards first (oldest due first).
 * If none due, return new/learning cards (then soonest upcoming reviews).
 */
export function buildSessionQueue<T extends SrsSnapshot & { id: string }>(
  cards: T[],
  now = Date.now(),
): { queue: T[]; mode: "due" | "learning" | "ahead" | "empty" } {
  if (cards.length === 0) return { queue: [], mode: "empty" };

  const due = cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => a.due - b.due);
  if (due.length > 0) return { queue: due, mode: "due" };

  const learningOrNew = cards
    .filter((c) => {
      const s = classifyCard(c, now);
      return s === "new" || s === "learning";
    })
    .sort((a, b) => a.due - b.due || a.reps - b.reps);
  if (learningOrNew.length > 0) {
    return { queue: learningOrNew, mode: "learning" };
  }

  // Everything scheduled for later — study ahead (soonest due first)
  const ahead = [...cards].sort((a, b) => a.due - b.due);
  return { queue: ahead, mode: "ahead" };
}
