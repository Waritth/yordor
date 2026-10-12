import { timingSafeEqual } from "node:crypto";

import { computeTeam } from "@yordor/engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { computeGroups } from "~/lib/group-input";
import {
  betBestN,
  betNoHcpPairs,
  buildTeamInput,
  teamBets,
} from "~/lib/team-input";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

function pinOk(pin: string): boolean {
  const expected = env.HISTORY_PIN;
  if (!expected) return false;
  const a = Buffer.from(pin);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const sumBy = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

/**
 * ประวัติทุกรอบ (กอล์ฟ / ไพ่ แยกกัน) — guarded by HISTORY_PIN because the list
 * exposes every round's link (a link = edit rights; there are no accounts).
 */
export const historyRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ pin: z.string().max(100) }))
    .query(async ({ ctx, input }) => {
      if (!env.HISTORY_PIN) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "ยังไม่ได้ตั้ง HISTORY_PIN บนเซิร์ฟเวอร์",
        });
      }
      if (!pinOk(input.pin)) {
        await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
        throw new TRPCError({ code: "UNAUTHORIZED", message: "PIN ไม่ถูกต้อง" });
      }

      const rounds = await ctx.db.round.findMany({
        orderBy: { createdAt: "desc" },
        relationLoadStrategy: "join",
        include: {
          holes: { orderBy: { index: "asc" } },
          players: { orderBy: { order: "asc" } },
          scores: true,
          bets: {
            orderBy: { order: "asc" },
            include: { teams: { orderBy: { order: "asc" } }, players: true },
          },
          runnerSegments: true,
          groups: { orderBy: { order: "asc" }, include: { players: true } },
          cardHands: { include: { scores: true } },
        },
      });

      const golf = [];
      const card = [];
      const cardBoard: Record<string, { total: number; rounds: number }> = {};

      for (const r of rounds) {
        const nameOf = (id: string) => r.players.find((p) => p.id === id)?.name.trim() || "ไม่มีชื่อ";

        if (r.gameType === "GOLF") {
          if (r.scores.length === 0) continue;
          const bet = teamBets(r)[0];
          let teams: { name: string; color: string; members: string[]; total: number }[] = [];
          if (bet) {
            const input = buildTeamInput(r, bet);
            const res = computeTeam(input.teams, input.holes, input.scores, {
              bestN: betBestN(bet),
              noHcpPairs: betNoHcpPairs(bet),
            });
            teams = bet.teams
              .map((t) => ({
                name: t.name,
                color: t.color,
                members: bet.players
                  .filter((bp) => bp.teamId === t.id)
                  .map((bp) => nameOf(bp.playerId))
                  .filter((n) => n !== "ไม่มีชื่อ"),
                total: res.totals[t.id] ?? 0,
              }))
              .sort((a, b) => b.total - a.total);
          }
          const { playerTotals } = computeGroups(r);
          golf.push({
            token: r.accessToken,
            name: r.name,
            createdAt: r.createdAt,
            holesPlayed: new Set(r.scores.map((s) => s.holeId)).size,
            holeCount: r.holeCount,
            bestN: bet ? betBestN(bet) : 2,
            teams,
            runners: r.players.filter((p) => p.mainRole === "RUNNER").map((p) => p.name),
            groups: Object.entries(playerTotals)
              .map(([id, total]) => ({ name: nameOf(id), total }))
              .sort((a, b) => b.total - a.total),
          });
        } else {
          const points = r.cardHands.flatMap((h) => h.scores);
          if (points.length === 0) continue;
          const players = r.players
            .map((p) => ({
              name: nameOf(p.id),
              total: sumBy(points.filter((s) => s.playerId === p.id), (s) => s.points),
              played: points.some((s) => s.playerId === p.id && s.points !== 0),
            }))
            .filter((p) => p.played)
            .sort((a, b) => b.total - a.total);
          for (const p of players) {
            const e = (cardBoard[p.name] ??= { total: 0, rounds: 0 });
            e.total += p.total;
            e.rounds += 1;
          }
          card.push({
            token: r.accessToken,
            name: r.name,
            createdAt: r.createdAt,
            hands: r.cardHands.length,
            players: players.map(({ name, total }) => ({ name, total })),
          });
        }
      }

      return {
        golf,
        card,
        cardBoard: Object.entries(cardBoard)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.total - a.total),
      };
    }),
});
