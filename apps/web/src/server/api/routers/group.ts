import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Prisma } from "../../../../generated/prisma";
import { DEFAULT_GROUP_CONFIG } from "~/lib/group-input";
import {
  createTRPCRouter,
  roundWriteProcedure,
  touchRound,
} from "~/server/api/trpc";

const game = z.object({ on: z.boolean(), bonus: z.boolean(), turbo: z.boolean() });
const configSchema = z.object({ match: game, highlow: game });
const hcp = z.number().min(0).max(54).nullable();

export const groupRouter = createTRPCRouter({
  create: roundWriteProcedure.mutation(async ({ ctx }) => {
    const count = await ctx.db.group.count({ where: { roundId: ctx.round.id } });
    const group = await ctx.db.group.create({
      data: {
        roundId: ctx.round.id,
        name: `วง ${count + 1}`,
        order: count,
        config: DEFAULT_GROUP_CONFIG as unknown as Prisma.InputJsonObject,
      },
    });
    await touchRound(ctx.db, ctx.round.id);
    return group;
  }),

  update: roundWriteProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string().max(40).optional(),
        config: configSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.db.group.updateMany({
        where: { id: input.groupId, roundId: ctx.round.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.config ? { config: input.config } : {}),
        },
      });
      if (res.count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบวง" });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  remove: roundWriteProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.group.deleteMany({
        where: { id: input.groupId, roundId: ctx.round.id },
      });
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),

  // Replace the group's roster (+ per-group handicap override; null = use main).
  setPlayers: roundWriteProcedure
    .input(
      z.object({
        groupId: z.string(),
        players: z.array(
          z.object({
            playerId: z.string(),
            hcpPar3: hcp.default(null),
            hcpPar4: hcp.default(null),
            hcpPar5: hcp.default(null),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.group.findFirst({
        where: { id: input.groupId, roundId: ctx.round.id },
        select: { id: true },
      });
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบวง" });

      const valid = await ctx.db.player.count({
        where: {
          roundId: ctx.round.id,
          id: { in: input.players.map((p) => p.playerId) },
        },
      });
      if (valid !== new Set(input.players.map((p) => p.playerId)).size) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ผู้เล่นไม่ถูกต้อง" });
      }

      await ctx.db.$transaction([
        ctx.db.groupPlayer.deleteMany({ where: { groupId: group.id } }),
        ctx.db.groupPlayer.createMany({
          data: input.players.map((p) => ({ groupId: group.id, ...p })),
        }),
      ]);
      await touchRound(ctx.db, ctx.round.id);
      return { ok: true as const };
    }),
});
