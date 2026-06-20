import { z } from "zod";

import {
  createTRPCRouter,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

export const playerRouter = createTRPCRouter({
  add: roundWriteProcedure
    .input(
      z.object({
        name: z.string().min(1).max(40),
        color: z.string().default("#1B5E20"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const last = await ctx.db.player.findFirst({
        where: { roundId: ctx.round.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const player = await ctx.db.player.create({
        data: {
          roundId: ctx.round.id,
          name: input.name,
          color: input.color,
          order: (last?.order ?? -1) + 1,
        },
      });
      await touchRound(ctx.db, ctx.round.id);
      return player;
    }),

  remove: roundWriteProcedure
    .input(z.object({ playerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.player.delete({ where: { id: input.playerId } });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  rename: roundWriteProcedure
    .input(z.object({ playerId: z.string(), name: z.string().min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.player.update({
        where: { id: input.playerId },
        data: { name: input.name },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  setColor: roundWriteProcedure
    .input(z.object({ playerId: z.string(), color: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.player.update({
        where: { id: input.playerId },
        data: { color: input.color },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  setHandicap: roundWriteProcedure
    .input(
      z.object({
        playerId: z.string(),
        hcpPar3: z.number().min(0).max(54),
        hcpPar4: z.number().min(0).max(54),
        hcpPar5: z.number().min(0).max(54),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.player.update({
        where: { id: input.playerId },
        data: {
          hcpPar3: input.hcpPar3,
          hcpPar4: input.hcpPar4,
          hcpPar5: input.hcpPar5,
        },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),
});
