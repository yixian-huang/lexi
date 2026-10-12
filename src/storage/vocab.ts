export type VocabCard = {
  id: string;
  front: string;
  back: string;
  note?: string;
  createdAt: number;
  knownCount: number;
  unknownCount: number;
};

const STORAGE_KEY = "lexi-vocab-v1";

function readAll(): VocabCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VocabCard[];
    return Array.isArray(parsed) ? parsed : [];
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

  const card: VocabCard = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    front: front.trim(),
    back: back.trim(),
    note: note?.trim() || undefined,
    createdAt: Date.now(),
    knownCount: 0,
    unknownCount: 0,
  };
  cards.push(card);
  writeAll(cards);
  return card;
}

export function removeVocab(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function markKnown(id: string, known: boolean): VocabCard | null {
  const cards = readAll();
  const card = cards.find((c) => c.id === id);
  if (!card) return null;
  if (known) card.knownCount += 1;
  else card.unknownCount += 1;
  writeAll(cards);
  return card;
}

export function clearVocab(): void {
  writeAll([]);
}
