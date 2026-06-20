// Maps round data (Prisma shape — also matches round.get client output structurally)
// into @yordor/engine inputs. Pure: usable on both server (result.get) and client (live preview).

import type { Hole, Player, Scores, Team } from "@yordor/engine";
import type { Par } from "@yordor/engine";

export interface RoundHole {
  id: string;
  index: number;
  par: number;
  turboOn: boolean;
}
export interface RoundPlayer {
  id: string;
  name: string;
  hcpPar3: number;
  hcpPar4: number;
  hcpPar5: number;
}
export interface RoundScore {
  playerId: string;
  holeId: string;
  strokes: number;
}
export interface RoundBetPlayer {
  playerId: string;
  teamId: string | null;
}
export interface RoundTeam {
  id: string;
  name: string;
  color: string;
  order: number;
}
export interface RoundBet {
  id: string;
  mode: string;
  name: string;
  teams: RoundTeam[];
  players: RoundBetPlayer[];
}
export interface RoundForEngine {
  holes: RoundHole[];
  players: RoundPlayer[];
  scores: RoundScore[];
  bets: RoundBet[];
}

function toEnginePlayer(p: RoundPlayer): Player {
  return {
    id: p.id,
    name: p.name,
    handicap: { 3: p.hcpPar3, 4: p.hcpPar4, 5: p.hcpPar5 },
  };
}

/** Build computeTeam() inputs for a single TEAM bet within a round. */
export function buildTeamInput(
  round: RoundForEngine,
  bet: RoundBet,
): { teams: Team[]; holes: Hole[]; scores: Scores } {
  const sortedHoles = [...round.holes].sort((a, b) => a.index - b.index);
  const pos = new Map<string, number>(); // holeId → array position
  sortedHoles.forEach((h, i) => pos.set(h.id, i));

  const holes: Hole[] = sortedHoles.map((h) => ({
    par: h.par as Par,
    turbo: h.turboOn,
    index: h.index,
  }));

  const scores: Record<string, (number | null)[]> = {};
  for (const s of round.scores) {
    const i = pos.get(s.holeId);
    if (i === undefined) continue;
    (scores[s.playerId] ??= new Array<number | null>(holes.length).fill(null))[i] =
      s.strokes;
  }

  const memberOf = new Map<string, string | null>();
  for (const bp of bet.players) memberOf.set(bp.playerId, bp.teamId);

  const playerById = new Map(round.players.map((p) => [p.id, p]));

  const teams: Team[] = [...bet.teams]
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      id: t.id,
      name: t.name,
      players: round.players
        .filter((p) => memberOf.get(p.id) === t.id)
        .map((p) => toEnginePlayer(playerById.get(p.id)!)),
    }));

  return { teams, holes, scores };
}

export function teamBets(round: RoundForEngine): RoundBet[] {
  return round.bets.filter((b) => b.mode === "TEAM");
}
