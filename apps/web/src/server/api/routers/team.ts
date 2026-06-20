import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { SLOTS_PER_TEAM } from "~/server/api/routers/round";
import {
  createTRPCRouter,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

const TEAM_COLORS = [
  "#1B5E20",
  "#C9A227",
  "#1565C0",
  "#6A1B9A",
  "#C62828",
  "#00838F",
];

/**
 * P2 team management + assignment for the round's single TEAM bet.
 * P4 replaces this with the generic bet.setParticipants across multiple bets.
 */
export const teamRouter = createTRPCRouter({
  create: roundWriteProcedure.mutation(async ({ ctx }) => {
    const bet = await ctx.db.bet.findFirst({
      where: { roundId: ctx.round.id, mode: "TEAM" },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const betId = bet?.id;
    if (!betId) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเดิมพันทีม" });
    const count = await ctx.db.team.count({ where: { betId } });
    const team = await ctx.db.team.create({
      data: {
        betId,
        name: `ทีม ${String.fromCharCode(65 + count)}`,
        color: TEAM_COLORS[count % TEAM_COLORS.length]!,
        order: count,
      },
    });

    // Seed empty player slots so the new team card matches the rest.
    const last = await ctx.db.player.findFirst({
      where: { roundId: ctx.round.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    let order = (last?.order ?? -1) + 1;
    await ctx.db.$transaction(
      Array.from({ length: SLOTS_PER_TEAM }, () =>
        ctx.db.betPlayer.create({
          data: {
            bet: { connect: { id: betId } },
            team: { connect: { id: team.id } },
            player: {
              create: {
                round: { connect: { id: ctx.round.id } },
                name: "",
                order: order++,
              },
            },
          },
        }),
      ),
    );

    await touchRound(ctx.db, ctx.round.id);
    return team;
  }),

  rename: roundWriteProcedure
    .input(z.object({ teamId: z.string(), name: z.string().min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.team.update({
        where: { id: input.teamId },
        data: { name: input.name },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  // Removing a team also deletes its member players (team-card model).
  remove: roundWriteProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bet = await ctx.db.bet.findFirst({
        where: { roundId: ctx.round.id, mode: "TEAM" },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      const betId = bet?.id;
      if (!betId) return { ok: true as const };
      const count = await ctx.db.team.count({ where: { betId } });
      if (count <= 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ต้องมีอย่างน้อย 2 ทีม",
        });
      }
      const members = await ctx.db.betPlayer.findMany({
        where: { betId, teamId: input.teamId },
        select: { playerId: true },
      });
      await ctx.db.$transaction([
        ctx.db.player.deleteMany({
          where: { id: { in: members.map((m) => m.playerId) } },
        }),
        ctx.db.team.delete({ where: { id: input.teamId } }),
      ]);
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

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
