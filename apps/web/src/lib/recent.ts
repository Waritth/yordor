// localStorage list of recently opened rounds (docs/05 §2).

export interface RecentRound {
  token: string;
  name: string;
  holeCount: number;
  ts: number;
  game?: string; // e.g. "Best 1 Best 2"
}

const KEY = "yordor:recent";

export function getRecent(): RecentRound[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentRound[]) : [];
  } catch {
    return [];
  }
}

export function addRecent(r: RecentRound): void {
  if (typeof window === "undefined") return;
  const list = getRecent().filter((x) => x.token !== r.token);
  list.unshift(r);
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)));
}

/** Accepts a full URL, a /round/<token> path, or a bare token. */
export function parseToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const parts = cleaned.split("/");
  return parts[parts.length - 1] ?? "";
}
