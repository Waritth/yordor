// Which players already have recorded points — they can't be removed (rename instead),
// and blank-named players without points are pruned when play starts.

interface Lite {
  players: { id: string; name: string }[];
  scores?: { playerId: string }[];
  cardHands?: { scores: { playerId: string; points: number }[] }[];
}

/** Golf: any score row. Card: any non-zero points (a 0-only column carries nothing). */
export function playersWithPoints(round: Lite): Set<string> {
  const ids = new Set<string>();
  for (const s of round.scores ?? []) ids.add(s.playerId);
  for (const h of round.cardHands ?? [])
    for (const s of h.scores) if (s.points !== 0) ids.add(s.playerId);
  return ids;
}

/** Players to show in play/result: named, or carrying points. */
export function activePlayers<P extends { id: string; name: string }>(
  round: Omit<Lite, "players"> & { players: P[] },
): P[] {
  const pts = playersWithPoints(round);
  return round.players.filter((p) => p.name.trim() !== "" || pts.has(p.id));
}

export const isBlankPrunable = (round: Lite) => {
  const pts = playersWithPoints(round);
  return round.players.some((p) => p.name.trim() === "" && !pts.has(p.id));
};
