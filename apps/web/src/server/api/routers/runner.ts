import { defaultRunnerSchedule, validateSchedule } from "@yordor/engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Prisma } from "../../../../generated/prisma";
import {
  createTRPCRouter,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

type Db = Prisma.TransactionClient;

async function roundTeams(db: Db, roundId: string) {
  const bet = await db.bet.findFirst({
    where: { roundId, mode: "TEAM" },
    orderBy: { order: "asc" },
    select: { teams: { orderBy: { order: "asc" }, select: { id: true } } },
  });
  return bet?.teams.map((t) => t.id) ?? [];
}

/** Replace a runner's schedule with the default split (docs/RUNNER_GROUPS_SPEC §2). */
export async function writeDefaultSchedule(
  db: Db,
  round: { id: string; holeCount: number },
  playerId: string,
) {
  const teamIds = await roundTeams(db, round.id);
  // k-th runner (by player order) starts rotating from team k
  const runners = await db.player.findMany({
    where: { roundId: round.id, mainRole: "RUNNER" },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const k = Math.max(0, runners.findIndex((r) => r.id === playerId));
  const segments = defaultRunnerSchedule(teamIds, round.holeCount, k);
  await db.runnerSegment.deleteMany({ where: { playerId } });
  if (segments.length > 0) {
    await db.runnerSegment.createMany({
      data: segments.map((s) => ({ roundId: round.id, playerId, ...s })),
    });
  }
}

export const runnerRouter = createTRPCRouter({
  autoSchedule: roundWriteProcedure
    .input(z.object({ playerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await writeDefaultSchedule(ctx.db, ctx.round, input.playerId);
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  setSchedule: roundWriteProcedure
    .input(
      z.object({
        playerId: z.string(),
        segments: z.array(
          z.object({
            teamId: z.string(),
            fromHole: z.number().int(),
            toHole: z.number().int(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const error = validateSchedule(input.segments, ctx.round.holeCount);
      if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });

      const teamIds = new Set(await roundTeams(ctx.db, ctx.round.id));
      if (input.segments.some((s) => !teamIds.has(s.teamId))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่พบทีม" });
      }
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        select: { roundId: true },
      });
      if (!player || player.roundId !== ctx.round.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบผู้เล่น" });
      }

      await ctx.db.$transaction([
        ctx.db.runnerSegment.deleteMany({ where: { playerId: input.playerId } }),
        ctx.db.runnerSegment.createMany({
          data: input.segments.map((s) => ({
            roundId: ctx.round.id,
            playerId: input.playerId,
            ...s,
          })),
        }),
      ]);
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),
});
