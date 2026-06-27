// ไพ่สามกอง (CARD3) — manual zero-sum scorer. See docs/CARD_3PILE_SPEC.md §3.
// No handicap/par/bonus — every hand must sum to 0; totals accumulate across hands.

/** A hand is valid only if every player's points sum to exactly 0. */
export function validHand(points: number[]): boolean {
  return points.reduce((a, b) => a + b, 0) === 0;
}

export interface Card3Hand {
  index: number;
  /** points[playerId] = points that player won (+) / lost (−) this hand */
  points: Record<string, number>;
}

export interface Card3HandLog {
  index: number;
  points: Record<string, number>;
  sum: number;
}

export interface Card3Result {
  totals: Record<string, number>;
  handLog: Card3HandLog[];
}

/** Accumulate per-player totals over all hands (spec §3). Σ totals === 0 always. */
export function computeCard3(
  playerIds: string[],
  hands: Card3Hand[],
): Card3Result {
  const totals: Record<string, number> = {};
  for (const p of playerIds) totals[p] = 0;

  const handLog: Card3HandLog[] = [];
  for (const hand of hands) {
    const points: Record<string, number> = {};
    let sum = 0;
    for (const p of playerIds) {
      const v = hand.points[p] ?? 0;
      points[p] = v;
      sum += v;
      totals[p] = (totals[p] ?? 0) + v;
    }
    handLog.push({ index: hand.index, points, sum });
  }
  return { totals, handLog };
}

export interface Card3Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Greedy "who pays whom" suggestion (spec §3 settlement). Debtors → creditors. */
export function settle(totals: Record<string, number>): Card3Transfer[] {
  const creditors = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }))
    .sort((a, b) => b.v - a.v);
  const debtors = Object.entries(totals)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }))
    .sort((a, b) => b.v - a.v);

  const transfers: Card3Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amount = Math.min(d.v, c.v);
    if (amount > 0) transfers.push({ from: d.id, to: c.id, amount });
    d.v -= amount;
    c.v -= amount;
    if (d.v === 0) i++;
    if (c.v === 0) j++;
  }
  return transfers;
}
