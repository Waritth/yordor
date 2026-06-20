import { computeTeam } from "@yordor/engine";

import { buildTeamInput, teamBets } from "~/lib/team-input";
import { createTRPCRouter, roundProcedure } from "~/server/api/trpc";

const roundInclude = {
  holes: { orderBy: { index: "asc" } },
  players: { orderBy: { order: "asc" } },
  scores: true,
  bets: {
    orderBy: { order: "asc" },
    include: {
      teams: { orderBy: { order: "asc" } },
      players: true,
    },
  },
} as const;

export const resultRouter = createTRPCRouter({
  // Live engine computation (not persisted). P2: TEAM bets only.
  get: roundProcedure.query(async ({ ctx }) => {
    const round = await ctx.db.round.findUnique({
      where: { id: ctx.round.id },
      include: roundInclude,
    });
    if (!round) return { teamResults: [] };

    const teamResults = teamBets(round).map((bet) => {
      const input = buildTeamInput(round, bet);
      const r = computeTeam(input.teams, input.holes, input.scores);
      return {
        betId: bet.id,
        name: bet.name,
        teams: bet.teams.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
        })),
        totals: r.totals,
        matrix: r.matrix,
        holeLog: r.holeLog,
      };
    });

    return { teamResults };
  }),
});
