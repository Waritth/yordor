import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  roundProcedure,
  roundWriteProcedure,
} from "~/server/api/trpc";

/** Full round payload shared by round.get (and consumed by the engine adapter). */
const roundInclude = {
  holes: { orderBy: { index: "asc" } },
  players: { orderBy: { order: "asc" } },
  scores: true,
  bets: {
    orderBy: { order: "asc" },
    include: {
      teams: { orderBy: { order: "asc" } },
      players: true, // BetPlayer rows
    },
  },
} as const;

export const roundRouter = createTRPCRouter({
  // Create round + default holes + one TEAM bet with teams A/B (P4 generalizes).
  create: publicProcedure
    .input(
      z.object({
        name: z.string().default(""),
        holeCount: z.union([z.literal(9), z.literal(18)]).default(18),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const round = await ctx.db.round.create({
        data: {
          name: input.name,
          holeCount: input.holeCount,
          holes: {
            create: Array.from({ length: input.holeCount }, (_, index) => ({
              index,
              par: 4,
            })),
          },
          bets: {
            create: {
              mode: "TEAM",
              name: "ทีม",
              order: 0,
              config: { bestN: 2, bonus: true, useTurbo: true },
              teams: {
                create: [
                  { name: "ทีม A", color: "#1B5E20", order: 0 },
                  { name: "ทีม B", color: "#C9A227", order: 1 },
                ],
              },
            },
          },
        },
        select: { id: true, accessToken: true },
      });
      return round;
    }),

  get: roundProcedure.query(async ({ ctx }) => {
    const round = await ctx.db.round.findUnique({
      where: { id: ctx.round.id },
      include: roundInclude,
    });
    // ctx.round exists (middleware), so this is non-null.
    return round!;
  }),

  updateMeta: roundWriteProcedure
    .input(z.object({ name: z.string().max(80) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.round.update({
        where: { id: ctx.round.id },
        data: { name: input.name },
      });
      return { ok: true as const };
    }),

  setStatus: roundProcedure
    .input(z.object({ status: z.enum(["SETUP", "PLAYING", "FINISHED"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.round.update({
        where: { id: ctx.round.id },
        data: { status: input.status },
      });
      return { ok: true as const };
    }),

  delete: roundWriteProcedure.mutation(async ({ ctx }) => {
    await ctx.db.round.delete({ where: { id: ctx.round.id } });
    return { ok: true as const };
  }),
});
