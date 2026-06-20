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
      if (input.cells.length === 0) return { ok: true as const };
      // Rewrite all addressed cells atomically in 2 statements (delete-then-create)
      // — avoids per-cell round-trips that blow the interactive-tx timeout on a
      // remote proxy. last-write-wins per (playerId, holeId).
      const pairs = input.cells.map((c) => ({
        playerId: c.playerId,
        holeId: c.holeId,
      }));
      const inserts = input.cells
        .filter((c) => c.strokes !== null)
        .map((c) => ({
          roundId: ctx.round.id,
          playerId: c.playerId,
          holeId: c.holeId,
          strokes: c.strokes!,
        }));
      await ctx.db.$transaction([
        ctx.db.score.deleteMany({ where: { OR: pairs } }),
        ctx.db.score.createMany({ data: inserts }),
      ]);
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),
});
