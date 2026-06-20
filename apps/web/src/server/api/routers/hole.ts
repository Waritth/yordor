import { z } from "zod";

import {
  createTRPCRouter,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

export const holeRouter = createTRPCRouter({
  setPar: roundWriteProcedure
    .input(
      z.object({
        holeId: z.string(),
        par: z.union([z.literal(3), z.literal(4), z.literal(5)]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.hole.update({
        where: { id: input.holeId },
        data: { par: input.par },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  setTurbo: roundWriteProcedure
    .input(
      z.object({
        holeId: z.string(),
        turboOn: z.boolean().optional(),
        turboAllowed: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.hole.update({
        where: { id: input.holeId },
        data: {
          ...(input.turboOn !== undefined ? { turboOn: input.turboOn } : {}),
          ...(input.turboAllowed !== undefined
            ? { turboAllowed: input.turboAllowed }
            : {}),
        },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),
});
