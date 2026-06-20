import type { ComputeResult, Handicap, Player } from "../types";

export const H0: Handicap = { 3: 0, 4: 0, 5: 0 };

export const pl = (id: string, hcp: Partial<Handicap> = {}): Player => ({
  id,
  handicap: { 3: 0, 4: 0, 5: 0, ...hcp },
});

export const sum = (t: Record<string, number>): number =>
  Object.values(t).reduce((a, b) => a + b, 0);

/** matrix[from][to] with a 0 default (avoids noUncheckedIndexedAccess noise). */
export const m = (r: ComputeResult, from: string, to: string): number =>
  r.matrix[from]?.[to] ?? 0;
