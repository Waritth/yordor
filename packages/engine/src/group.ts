// วงส่วนตัว (Group side games) — see docs/RUNNER_GROUPS_SPEC.md §4.
// Players passed in already carry the group's handicap (override or main).

import { bonusLabel, bonusMult } from "./bonus";
import { net, scoreAt } from "./net";
import { turboMult } from "./turbo";
import type { Hole, Par, Player, Scores } from "./types";

export interface GameOpts {
  bonus: boolean;
  turbo: boolean;
}

export interface GroupTransfer {
  from: string;
  to: string;
  pts: number;
  bonus: string | null;
}

export interface GroupHoleLog {
  holeIndex: number;
  par: Par;
  turbo: boolean;
  /** net per player on this hole (null = not entered) */
  nets: Record<string, number | null>;
  transfers: GroupTransfer[];
}

export interface GroupResult {
  totals: Record<string, number>;
  matrix: Record<string, Record<string, number>>;
  holeLog: GroupHoleLog[];
}

interface Entry {
  id: string;
  net: number;
  gross: number;
}

function init(players: Player[]): Pick<GroupResult, "totals" | "matrix"> {
  const totals: Record<string, number> = {};
  const matrix: Record<string, Record<string, number>> = {};
  for (const p of players) {
    totals[p.id] = 0;
    matrix[p.id] = {};
  }
  for (const a of players)
    for (const b of players) if (a.id !== b.id) matrix[a.id]![b.id] = 0;
  return { totals, matrix };
}

function entriesAt(
  players: Player[],
  hole: Hole,
  scores: Scores,
  hIdx: number,
): { entries: Entry[]; nets: Record<string, number | null> } {
  const entries: Entry[] = [];
  const nets: Record<string, number | null> = {};
  for (const p of players) {
    const s = scoreAt(scores, p.id, hIdx);
    const n = net(s, p, hole.par);
    nets[p.id] = n;
    if (n !== null && s !== null) entries.push({ id: p.id, net: n, gross: s });
  }
  return { entries, nets };
}

function pay(
  r: Pick<GroupResult, "totals" | "matrix">,
  from: string,
  to: string,
  pts: number,
) {
  r.matrix[from]![to]! += pts;
  r.totals[to]! += pts;
  r.totals[from]! -= pts;
}

/** Match: every pair in the group, hole-by-hole, lower net wins 1 pt (× bonus × turbo if on). */
export function computeGroupMatch(
  players: Player[],
  holes: Hole[],
  scores: Scores,
  opts: GameOpts,
): GroupResult {
  const r = init(players);
  const holeLog: GroupHoleLog[] = [];

  holes.forEach((hole, hIdx) => {
    const { entries, nets } = entriesAt(players, hole, scores, hIdx);
    const mult = opts.turbo ? turboMult(hole) : 1;
    const transfers: GroupTransfer[] = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]!;
        const b = entries[j]!;
        if (a.net === b.net) continue;
        const [w, l] = a.net < b.net ? [a, b] : [b, a];
        const pts = (opts.bonus ? bonusMult(w.gross, hole.par) : 1) * mult;
        pay(r, l.id, w.id, pts);
        transfers.push({
          from: l.id,
          to: w.id,
          pts,
          bonus: opts.bonus ? bonusLabel(w.gross, hole.par) : null,
        });
      }
    }
    holeLog.push({ holeIndex: hIdx, par: hole.par, turbo: hole.turbo, nets, transfers });
  });

  return { ...r, holeLog };
}

/** บ๊วยจ่ายหัว: every worst-net player pays every best-net player (docs/02 §7). */
export function computeHighLow(
  players: Player[],
  holes: Hole[],
  scores: Scores,
  opts: GameOpts,
): GroupResult {
  const r = init(players);
  const holeLog: GroupHoleLog[] = [];

  holes.forEach((hole, hIdx) => {
    const { entries, nets } = entriesAt(players, hole, scores, hIdx);
    const mult = opts.turbo ? turboMult(hole) : 1;
    const transfers: GroupTransfer[] = [];

    if (entries.length >= 2) {
      const best = Math.min(...entries.map((e) => e.net));
      const worst = Math.max(...entries.map((e) => e.net));
      if (best !== worst) {
        const heads = entries.filter((e) => e.net === best);
        const tails = entries.filter((e) => e.net === worst);
        for (const tail of tails) {
          for (const head of heads) {
            const pts =
              (opts.bonus ? bonusMult(head.gross, hole.par) : 1) * mult;
            pay(r, tail.id, head.id, pts);
            transfers.push({
              from: tail.id,
              to: head.id,
              pts,
              bonus: opts.bonus ? bonusLabel(head.gross, hole.par) : null,
            });
          }
        }
      }
    }
    holeLog.push({ holeIndex: hIdx, par: hole.par, turbo: hole.turbo, nets, transfers });
  });

  return { ...r, holeLog };
}
