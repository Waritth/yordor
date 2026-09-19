// วงส่วนตัว — maps round data → engine group games. Pure (client preview + server result).
// See docs/RUNNER_GROUPS_SPEC.md §4.

import {
  computeGroupMatch,
  computeHighLow,
  type GameOpts,
  type GroupResult,
  type Player,
} from "@yordor/engine";

import {
  buildHolesScores,
  type RoundHole,
  type RoundPlayer,
  type RoundScore,
} from "~/lib/team-input";

export type GameConfig = GameOpts & { on: boolean };
// type aliases (not interfaces) so the config is assignable to Prisma Json
export type GroupConfig = { match: GameConfig; highlow: GameConfig };
export const DEFAULT_GROUP_CONFIG: GroupConfig = {
  match: { on: true, bonus: false, turbo: false },
  highlow: { on: false, bonus: false, turbo: false },
};

export function parseGroupConfig(raw: unknown): GroupConfig {
  const c = (raw ?? {}) as Partial<Record<keyof GroupConfig, Partial<GameConfig>>>;
  const game = (g: Partial<GameConfig> | undefined, d: GameConfig): GameConfig => ({
    on: typeof g?.on === "boolean" ? g.on : d.on,
    bonus: typeof g?.bonus === "boolean" ? g.bonus : d.bonus,
    turbo: typeof g?.turbo === "boolean" ? g.turbo : d.turbo,
  });
  return {
    match: game(c.match, DEFAULT_GROUP_CONFIG.match),
    highlow: game(c.highlow, DEFAULT_GROUP_CONFIG.highlow),
  };
}

export interface RoundGroupPlayer {
  playerId: string;
  hcpPar3: number | null;
  hcpPar4: number | null;
  hcpPar5: number | null;
}
export interface RoundGroup {
  id: string;
  name: string;
  order: number;
  config: unknown;
  players: RoundGroupPlayer[];
}
export interface RoundForGroups {
  holes: RoundHole[];
  players: RoundPlayer[];
  scores: RoundScore[];
  groups: RoundGroup[];
}

export type GameKey = "match" | "highlow";
export const GAME_LABEL: Record<GameKey, string> = {
  match: "ตัวต่อตัว",
  highlow: "บ๊วยจ่ายหัว",
};

export interface GroupGameResult extends GroupResult {
  groupId: string;
  groupName: string;
  game: GameKey;
  playerIds: string[];
}

export function computeGroups(round: RoundForGroups): {
  games: GroupGameResult[];
  playerTotals: Record<string, number>;
} {
  const { holes, scores } = buildHolesScores(round);
  const byId = new Map(round.players.map((p) => [p.id, p]));
  const games: GroupGameResult[] = [];
  const playerTotals: Record<string, number> = {};

  for (const g of [...round.groups].sort((a, b) => a.order - b.order)) {
    // keep the round's player order → deterministic
    const members: Player[] = round.players
      .map((p) => {
        const gp = g.players.find((x) => x.playerId === p.id);
        const base = byId.get(p.id);
        if (!gp || !base) return null;
        return {
          id: p.id,
          name: p.name,
          handicap: {
            3: gp.hcpPar3 ?? base.hcpPar3,
            4: gp.hcpPar4 ?? base.hcpPar4,
            5: gp.hcpPar5 ?? base.hcpPar5,
          },
        } satisfies Player;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (members.length < 2) continue;

    const cfg = parseGroupConfig(g.config);
    const run = (game: GameKey, r: GroupResult) => {
      games.push({
        ...r,
        groupId: g.id,
        groupName: g.name,
        game,
        playerIds: members.map((m) => m.id),
      });
      for (const [pid, v] of Object.entries(r.totals))
        playerTotals[pid] = (playerTotals[pid] ?? 0) + v;
    };
    if (cfg.match.on) run("match", computeGroupMatch(members, holes, scores, cfg.match));
    if (cfg.highlow.on) run("highlow", computeHighLow(members, holes, scores, cfg.highlow));
  }
  return { games, playerTotals };
}
