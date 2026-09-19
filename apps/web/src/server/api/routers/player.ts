import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { writeDefaultSchedule } from "~/server/api/routers/runner";
import {
  createTRPCRouter,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

export const playerRouter = createTRPCRouter({
  // Optionally assign the new player straight into a team (one round-trip).
  add: roundWriteProcedure
    .input(
      z.object({
        name: z.string().max(40).default(""),
        color: z.string().default("#1B5E20"),
        teamId: z.string().optional(),
        // without a team: RUNNER (ตัววิ่ง) or OFF (ไม่เล่นก๊วนใหญ่)
        mainRole: z.enum(["RUNNER", "OFF"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const last = await ctx.db.player.findFirst({
        where: { roundId: ctx.round.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      let betId: string | undefined;
      if (input.teamId) {
        const team = await ctx.db.team.findUnique({
          where: { id: input.teamId },
          include: { bet: { select: { id: true, roundId: true } } },
        });
        if (!team || team.bet.roundId !== ctx.round.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบทีม" });
        }
        betId = team.bet.id;
      }

      const player = await ctx.db.player.create({
        data: {
          roundId: ctx.round.id,
          name: input.name,
          color: input.color,
          order: (last?.order ?? -1) + 1,
          mainRole: input.teamId ? "MEMBER" : (input.mainRole ?? "MEMBER"),
          ...(betId && input.teamId
            ? { betPlayers: { create: { betId, teamId: input.teamId } } }
            : {}),
        },
      });
      if (player.mainRole === "RUNNER") {
        await writeDefaultSchedule(ctx.db, ctx.round, player.id);
      }
      await touchRound(ctx.db, ctx.round.id);
      return player;
    }),

  // MEMBER (needs teamId) / RUNNER (ตัววิ่ง) / OFF (ไม่เล่นก๊วนใหญ่ — วงส่วนตัวยังได้)
  setMainRole: roundWriteProcedure
    .input(
      z.object({
        playerId: z.string(),
        role: z.enum(["MEMBER", "RUNNER", "OFF"]),
        teamId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        select: { roundId: true, _count: { select: { runnerSegments: true } } },
      });
      if (!player || player.roundId !== ctx.round.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบผู้เล่น" });
      }
      const bet = await ctx.db.bet.findFirst({
        where: { roundId: ctx.round.id, mode: "TEAM" },
        orderBy: { order: "asc" },
        select: { id: true, teams: { select: { id: true } } },
      });

      if (input.role === "MEMBER") {
        if (!bet || !input.teamId || !bet.teams.some((t) => t.id === input.teamId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ต้องเลือกทีม" });
        }
        await ctx.db.betPlayer.upsert({
          where: { betId_playerId: { betId: bet.id, playerId: input.playerId } },
          create: { betId: bet.id, playerId: input.playerId, teamId: input.teamId },
          update: { teamId: input.teamId },
        });
      } else if (bet) {
        await ctx.db.betPlayer.deleteMany({
          where: { betId: bet.id, playerId: input.playerId },
        });
      }

      await ctx.db.player.update({
        where: { id: input.playerId },
        data: { mainRole: input.role },
      });
      // first time running → give a default schedule (kept when toggled OFF ↔ RUNNER)
      if (input.role === "RUNNER" && player._count.runnerSegments === 0) {
        await writeDefaultSchedule(ctx.db, ctx.round, input.playerId);
      }
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  remove: roundWriteProcedure
    .input(z.object({ playerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.player.delete({ where: { id: input.playerId } });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  rename: roundWriteProcedure
    .input(z.object({ playerId: z.string(), name: z.string().max(40) }))
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
