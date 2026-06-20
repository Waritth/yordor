import type { Par, Player, Scores } from "./types";

/**
 * Net score = gross + handicap[par].
 * The group plays with "ต่อ" ADDED to net (matches golf-team-mode.jsx:18).
 * Lower net wins, so handicap is a stroke allowance added to the player's score.
 * Returns null (⊘) when strokes is null/undefined. net can be fractional.
 */
export function net(
  strokes: number | null | undefined,
  player: Player,
  par: Par,
): number | null {
  if (strokes == null) return null;
  return strokes + player.handicap[par];
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
