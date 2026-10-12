import {
  applyGrade,
  defaultSrs,
  type Grade,
  type SrsSnapshot,
} from "./srs";

export type VocabCard = {
  id: string;
  front: string;
  back: string;
  note?: string;
  createdAt: number;
  knownCount: number;
  unknownCount: number;
  /** SRS: days until next review */
  interval: number;
  /** SRS: ease factor (SM-2-like), default 2.5 */
  ease: number;
  /** SRS: next due time (epoch ms) */
  due: number;
  /** SRS: successful review streak count */
  reps: number;
  /** SRS: times failed back to learning */
  lapses: number;
};

const STORAGE_KEY = "lexi-vocab-v1";

type RawCard = Partial<VocabCard> & {
  id: string;
  front: string;
  back: string;
};

function migrate(raw: RawCard): VocabCard {
  const base = defaultSrs(raw.createdAt ?? Date.now());
  return {
    id: raw.id,
    front: raw.front,
    back: raw.back,
    note: raw.note,
    createdAt: raw.createdAt ?? Date.now(),
    knownCount: raw.knownCount ?? 0,
    unknownCount: raw.unknownCount ?? 0,
    interval: typeof raw.interval === "number" ? raw.interval : base.interval,
    ease: typeof raw.ease === "number" ? raw.ease : base.ease,
    due: typeof raw.due === "number" ? raw.due : base.due,
    reps: typeof raw.reps === "number" ? raw.reps : base.reps,
    lapses: typeof raw.lapses === "number" ? raw.lapses : base.lapses,
  };
}

function readAll(): VocabCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RawCard[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrate);
  } catch {
    return [];
  }
}

function writeAll(cards: VocabCard[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function listVocab(): VocabCard[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getVocab(id: string): VocabCard | null {
  return readAll().find((c) => c.id === id) ?? null;
}

export function addVocab(
  front: string,
  back: string,
  note?: string,
): VocabCard {
  const cards = readAll();
  const existing = cards.find(
    (c) =>
      c.front.toLowerCase() === front.trim().toLowerCase() &&
      c.back === back.trim(),
  );
  if (existing) return existing;

  const now = Date.now();
  const srs = defaultSrs(now);
  const card: VocabCard = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    front: front.trim(),
    back: back.trim(),
    note: note?.trim() || undefined,
    createdAt: now,
    knownCount: 0,
    unknownCount: 0,
    ...srs,
  };
  cards.push(card);
  writeAll(cards);
  return card;
}

export function removeVocab(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

/** @deprecated Prefer reviewCard with Again/Hard/Good grades. */
export function markKnown(id: string, known: boolean): VocabCard | null {
  return reviewCard(id, known ? "good" : "again");
}

export function reviewCard(id: string, grade: Grade): VocabCard | null {
  const cards = readAll();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx < 0) return null;

  const card = cards[idx];
  const snap: SrsSnapshot = {
    interval: card.interval,
    ease: card.ease,
    due: card.due,
    reps: card.reps,
    lapses: card.lapses,
  };
  const next = applyGrade(snap, grade);
  const updated: VocabCard = {
    ...card,
    interval: next.interval,
    ease: next.ease,
    due: next.due,
    reps: next.reps,
    lapses: next.lapses,
    knownCount:
      grade === "again" ? card.knownCount : card.knownCount + 1,
    unknownCount:
      grade === "again" ? card.unknownCount + 1 : card.unknownCount,
  };
  cards[idx] = updated;
  writeAll(cards);
  return updated;
}

export function previewNextInterval(
  card: VocabCard,
  grade: Grade,
): string {
  return applyGrade(
    {
      interval: card.interval,
      ease: card.ease,
      due: card.due,
      reps: card.reps,
      lapses: card.lapses,
    },
    grade,
  ).nextIntervalLabel;
}

export function clearVocab(): void {
  writeAll([]);
}

export type { Grade };
