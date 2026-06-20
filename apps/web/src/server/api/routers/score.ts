import { z } from "zod";

import type { Prisma } from "../../../../generated/prisma";
import {
  createTRPCRouter,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

const strokes = z.number().int().min(1).max(20).nullable();

// cell-level upsert; null strokes = delete the cell (docs/04 §4)
async function setCell(
  db: Prisma.TransactionClient,
  roundId: string,
  playerId: string,
  holeId: string,
  value: number | null,
) {
  if (value === null) {
    await db.score.deleteMany({ where: { playerId, holeId } });
    return;
  }
  await db.score.upsert({
    where: { playerId_holeId: { playerId, holeId } },
    create: { roundId, playerId, holeId, strokes: value },
    update: { strokes: value },
  });
}

export const scoreRouter = createTRPCRouter({
  set: roundWriteProcedure
    .input(
      z.object({ playerId: z.string(), holeId: z.string(), strokes }),
    )
    .mutation(async ({ ctx, input }) => {
      await setCell(
        ctx.db,
        ctx.round.id,
        input.playerId,
        input.holeId,
        input.strokes,
      );
      await touchRound(ctx.db, ctx.round.id);
      const updated = await ctx.db.round.findUnique({
        where: { id: ctx.round.id },
        select: { updatedAt: true },
      });
      return { ok: true as const, updatedAt: updated!.updatedAt };
    }),

  setMany: roundWriteProcedure
    .input(
      z.object({
        cells: z.array(
          z.object({ playerId: z.string(), holeId: z.string(), strokes }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async (tx) => {
        for (const c of input.cells) {
          await setCell(tx, ctx.round.id, c.playerId, c.holeId, c.strokes);
        }
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),
});
