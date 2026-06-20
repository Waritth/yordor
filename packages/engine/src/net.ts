import type { Par, Player, Scores } from "./types";

/**
 * Net score = gross − handicap[par].
 * ⚠️ Prototype used `+` (golf-team-mode.jsx:18) — spec §1 mandates `−`:
 * "ต่อ" ช่วยคนตีอ่อน → หัก handicap ออก → net ต่ำลง = ได้เปรียบ.
 * Returns null (⊘) when strokes is null/undefined. net can be fractional.
 */
export function net(
  strokes: number | null | undefined,
  player: Player,
  par: Par,
): number | null {
  if (strokes == null) return null;
  return strokes - player.handicap[par];
}

/** Read scores[playerId][holeIndex] safely → number | null. */
export function scoreAt(
  scores: Scores,
  playerId: string,
  holeIdx: number,
): number | null {
  const arr = scores[playerId];
  if (!arr) return null;
  return arr[holeIdx] ?? null;
}
