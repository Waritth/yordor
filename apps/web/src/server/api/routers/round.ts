import { observable } from "@trpc/server/observable";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  roundProcedure,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";
import { roundEvents } from "~/server/events";

/** Empty player slots seeded per team on create (ready to type — no extra clicks). */
export const SLOTS_PER_TEAM = 2;

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
        // Only TEAM is playable in v1; other modes are picked but locked in UI.
        mode: z.literal("TEAM").default("TEAM"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const round = await ctx.db.round.create({
        data: {
          name: input.name,
          holeCount: input.holeCount,
          holes: {
            createMany: {
              data: Array.from({ length: input.holeCount }, (_, index) => ({
                index,
                par: 4,
              })),
            },
          },
          bets: {
            create: {
              mode: "TEAM",
              name: "ทีม",
              order: 0,
              config: { bestN: 2, bonus: true, useTurbo: true },
              teams: {
                // nested create (not createMany) so we get the team ids back
                create: [
                  { name: "ทีม A", color: "#1B5E20", order: 0 },
                  { name: "ทีม B", color: "#C9A227", order: 1 },
                ],
              },
            },
          },
        },
        include: { bets: { include: { teams: { orderBy: { order: "asc" } } } } },
      });

      // Pre-seed empty player slots in each team (ready to type, no extra clicks).
      const bet = round.bets[0]!;
      const seeds = [];
      let order = 0;
      for (const t of bet.teams) {
        for (let k = 0; k < SLOTS_PER_TEAM; k++) {
          seeds.push(
            ctx.db.betPlayer.create({
              data: {
                bet: { connect: { id: bet.id } },
                team: { connect: { id: t.id } },
                player: {
                  create: {
                    round: { connect: { id: round.id } },
                    name: "",
                    order: order++,
                  },
                },
              },
            }),
          );
        }
      }
      await ctx.db.$transaction(seeds);

      return { id: round.id, accessToken: round.accessToken };
    }),

  // Live changes over SSE (docs/04 §6). Polling is the fallback (client side).
  live: roundProcedure.subscription(({ ctx }) =>
    observable<{ updatedAt: Date }>((emit) => {
      return roundEvents.subscribe(ctx.round.id, (updatedAt) =>
        emit.next({ updatedAt }),
      );
    }),
  ),

  get: roundProcedure.query(async ({ ctx }) => {
    const round = await ctx.db.round.findUnique({
      where: { id: ctx.round.id },
      relationLoadStrategy: "join",
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
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  setStatus: roundProcedure
    .input(z.object({ status: z.enum(["SETUP", "PLAYING", "FINISHED"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.round.update({
        where: { id: ctx.round.id },
        data: { status: input.status },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  delete: roundWriteProcedure.mutation(async ({ ctx }) => {
    await ctx.db.round.delete({ where: { id: ctx.round.id } });
    return { ok: true as const };
  }),
});
