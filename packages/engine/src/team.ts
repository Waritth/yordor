import { bonusLabel, bonusMult } from "./bonus";
import { net, scoreAt } from "./net";
import { turboMult } from "./turbo";
import type {
  ComputeResult,
  GameLog,
  Hole,
  HoleLog,
  Par,
  RankEntry,
  Scores,
  Team,
} from "./types";

/**
 * Rank players within a team for one hole by net ascending (spec §4.1).
 * Players with no score (net ⊘) are excluded. Sort is stable, so equal nets
 * keep input order → deterministic tie-break (spec §9).
 * [0] = Best1, [1] = Best2.
 */
export function teamRanked(
  team: Team,
  par: Par,
  scores: Scores,
  holeIdx: number,
): RankEntry[] {
  const list: RankEntry[] = [];
  for (const p of team.players) {
    const s = scoreAt(scores, p.id, holeIdx);
    const n = net(s, p, par);
    if (n !== null && s !== null) {
      list.push({ player: p, net: n, gross: s });
    }
  }
  // Array.prototype.sort is stable (Node ≥ 11) → deterministic tie-break.
  list.sort((a, b) => a.net - b.net);
  return list;
}

/**
 * Compare two nets (spec §4.2).
 * +1 = A wins, -1 = B wins, 0 = tie, null = ⊘ (missing data, not counted).
 */
export function compareNet(
  aNet: number | null,
  bNet: number | null,
): 1 | -1 | 0 | null {
  if (aNet == null || bNet == null) return null;
  if (aNet < bNet) return 1;
  if (aNet > bNet) return -1;
  return 0;
}

/**
 * Team (Best N) round-robin over all holes (spec §4.3).
 * Returns team-level totals + matrix + per-hole log.
 * matrix[from][to] = point ที่ from จ่าย to ; totals[t] = รับ − จ่าย.
 */
export function computeTeam(
  teams: Team[],
  holes: Hole[],
  scores: Scores,
): ComputeResult {
  const totals: Record<string, number> = {};
  const matrix: Record<string, Record<string, number>> = {};
  for (const t of teams) {
    totals[t.id] = 0;
    matrix[t.id] = {};
  }
  for (const a of teams) {
    for (const b of teams) {
      if (a.id !== b.id) matrix[a.id]![b.id] = 0;
    }
  }

  const holeLog: HoleLog[] = [];

  holes.forEach((hole, hIdx) => {
    const mult = turboMult(hole);
    const ranked = new Map<string, RankEntry[]>();
    for (const t of teams) {
      ranked.set(t.id, teamRanked(t, hole.par, scores, hIdx));
    }

    const games: GameLog[] = [];

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const A = teams[i]!;
        const B = teams[j]!;
        for (const rank of [0, 1]) {
          const a = ranked.get(A.id)?.[rank];
          const b = ranked.get(B.id)?.[rank];
          const aNet = a?.net ?? null;
          const bNet = b?.net ?? null;
          const r = compareNet(aNet, bNet);

          if (r == null || r === 0 || !a || !b) {
            games.push({
              rank,
              teamA: A.id,
              teamB: B.id,
              winner: null,
              netA: aNet,
              netB: bNet,
              pts: 0,
              bonus: null,
              turbo: hole.turbo,
            });
            continue;
          }

          const winnerGross = r === 1 ? a.gross : b.gross;
          const pts = 1 * bonusMult(winnerGross, hole.par) * mult;

          if (r === 1) {
            matrix[B.id]![A.id]! += pts;
            totals[A.id]! += pts;
            totals[B.id]! -= pts;
          } else {
            matrix[A.id]![B.id]! += pts;
            totals[B.id]! += pts;
            totals[A.id]! -= pts;
          }

          games.push({
            rank,
            teamA: A.id,
            teamB: B.id,
            winner: r === 1 ? A.id : B.id,
            netA: aNet,
            netB: bNet,
            pts,
            bonus: bonusLabel(winnerGross, hole.par),
            turbo: hole.turbo,
          });
        }
      }
    }

    holeLog.push({ holeIndex: hIdx, par: hole.par, turbo: hole.turbo, games });
  });

  return { totals, matrix, holeLog };
}
