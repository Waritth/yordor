import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

/**
 * P2 team assignment for the round's single TEAM bet.
 * P4 replaces this with the generic bet.setParticipants across multiple bets.
 */
export const teamRouter = createTRPCRouter({
  assign: roundWriteProcedure
    .input(z.object({ playerId: z.string(), teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { id: input.teamId },
        include: { bet: { select: { id: true, roundId: true } } },
      });
      if (!team || team.bet.roundId !== ctx.round.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบทีม" });
      }
      await ctx.db.betPlayer.upsert({
        where: {
          betId_playerId: { betId: team.bet.id, playerId: input.playerId },
        },
        create: {
          betId: team.bet.id,
          playerId: input.playerId,
          teamId: team.id,
        },
        update: { teamId: team.id },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  unassign: roundWriteProcedure
    .input(z.object({ playerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bet = await ctx.db.bet.findFirst({
        where: { roundId: ctx.round.id, mode: "TEAM" },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (bet) {
        await ctx.db.betPlayer.deleteMany({
          where: { betId: bet.id, playerId: input.playerId },
        });
      }
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),
});
