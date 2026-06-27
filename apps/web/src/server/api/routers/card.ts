import { computeCard3, settle } from "@yordor/engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  roundProcedure,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

const scoresSchema = z
  .array(z.object({ playerId: z.string(), points: z.number().int() }))
  .min(2);

// Server-side zero-sum block — last line of defense (docs/CARD §3, §5).
function assertZeroSum(scores: { points: number }[]) {
  const sum = scores.reduce((s, x) => s + x.points, 0);
  if (sum !== 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `ผลรวมแต้มต้องเป็น 0 (ตอนนี้ ${sum > 0 ? "+" : ""}${sum})`,
    });
  }
}

export const cardRouter = createTRPCRouter({
  addHand: roundWriteProcedure
    .input(z.object({ scores: scoresSchema }))
    .mutation(async ({ ctx, input }) => {
      assertZeroSum(input.scores);
      const last = await ctx.db.cardHand.findFirst({
        where: { roundId: ctx.round.id },
        orderBy: { index: "desc" },
        select: { index: true },
      });
      await ctx.db.cardHand.create({
        data: {
          roundId: ctx.round.id,
          index: (last?.index ?? 0) + 1,
          scores: {
            createMany: {
              data: input.scores.map((s) => ({
                roundId: ctx.round.id,
                playerId: s.playerId,
                points: s.points,
              })),
            },
          },
        },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  updateHand: roundWriteProcedure
    .input(z.object({ handId: z.string(), scores: scoresSchema }))
    .mutation(async ({ ctx, input }) => {
      assertZeroSum(input.scores);
      const hand = await ctx.db.cardHand.findUnique({
        where: { id: input.handId },
        select: { roundId: true },
      });
      if (!hand || hand.roundId !== ctx.round.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบตานี้" });
      }
      await ctx.db.$transaction([
        ctx.db.cardScore.deleteMany({ where: { handId: input.handId } }),
        ctx.db.cardScore.createMany({
          data: input.scores.map((s) => ({
            roundId: ctx.round.id,
            handId: input.handId,
            playerId: s.playerId,
            points: s.points,
          })),
        }),
      ]);
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  removeHand: roundWriteProcedure
    .input(z.object({ handId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const hand = await ctx.db.cardHand.findUnique({
        where: { id: input.handId },
        select: { roundId: true },
      });
      if (!hand || hand.roundId !== ctx.round.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบตานี้" });
      }
      await ctx.db.cardHand.delete({ where: { id: input.handId } });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  getResult: roundProcedure.query(async ({ ctx }) => {
    const round = await ctx.db.round.findUnique({
      where: { id: ctx.round.id },
      relationLoadStrategy: "join",
      include: {
        players: { orderBy: { order: "asc" } },
        cardHands: { orderBy: { index: "asc" }, include: { scores: true } },
      },
    });
    if (!round) return { totals: {}, handLog: [], transfers: [] };

    const playerIds = round.players.map((p) => p.id);
    const hands = round.cardHands.map((h) => ({
      index: h.index,
      points: Object.fromEntries(h.scores.map((s) => [s.playerId, s.points])),
    }));
    const { totals, handLog } = computeCard3(playerIds, hands);
    return { totals, handLog, transfers: settle(totals) };
  }),
});
