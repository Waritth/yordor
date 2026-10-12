"use client";

import { computeTeam, net as engineNet, type Par } from "@yordor/engine";
import { useEffect, useState } from "react";

import { Card, Section, cx } from "~/app/_ui";
import { GAME_LABEL, computeGroups } from "~/lib/group-input";
import { activePlayers } from "~/lib/player-data";
import {
  betBestN,
  betNoHcpPairs,
  buildTeamInput,
  teamBets,
} from "~/lib/team-input";

import type { RoundData } from "../round-flow";

type Player = RoundData["players"][number];

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const tone = (n: number) =>
  n > 0 ? "text-green-600" : n < 0 ? "text-red-500" : "text-black/40";

/** Scorecard cell style relative to par (birdie/eagle/bogey+). */
const cellTone = (gross: number, par: number) => {
  const d = gross - par;
  if (d <= -2) return "bg-[#C9A227] text-white font-bold rounded-full";
  if (d === -1) return "bg-green-600 text-white font-bold rounded-full";
  if (d === 0) return "text-black/80";
  if (d === 1) return "text-black/50";
  return "text-red-500";
};

/**
 * สกอร์รายคน — live scorecard for everyone + a per-player breakdown
 * (who they were compared with in the team game, side-game payments).
 * Read-only: safe to leave open on any phone as "หลักฐาน".
 */
export function ScoresStep({ token, round }: { token: string; round: RoundData }) {
  const meKey = `yordor:me:${token}`;
  const players = activePlayers(round);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    try {
      setMe(window.localStorage.getItem(meKey));
    } catch {
      setMe(null);
    }
  }, [meKey]);
  const pick = (id: string) => {
    setMe(id);
    try {
      window.localStorage.setItem(meKey, id);
    } catch {}
  };

  const holes = [...round.holes].sort((a, b) => a.index - b.index);
  const grossOf = (pid: string, holeId: string) =>
    round.scores.find((s) => s.playerId === pid && s.holeId === holeId)?.strokes ?? null;
  const played = holes.filter((h) => round.scores.some((s) => s.holeId === h.id));

  // team game (same inputs as the live preview / result)
  const bet = teamBets(round)[0];
  const team = bet
    ? (() => {
        const input = buildTeamInput(round, bet);
        return computeTeam(input.teams, input.holes, input.scores, {
          bestN: betBestN(bet),
          noHcpPairs: betNoHcpPairs(bet),
        });
      })()
    : null;
  const teams = bet?.teams ?? [];
  const teamById = (id: string | null | undefined) => teams.find((t) => t.id === id);
  const memberOf = new Map((bet?.players ?? []).map((bp) => [bp.playerId, bp.teamId]));
  const teamAt = (p: Player, hole1: number) => {
    if (p.mainRole === "MEMBER") return teamById(memberOf.get(p.id));
    if (p.mainRole === "RUNNER") {
      const seg = round.runnerSegments.find(
        (s) => s.playerId === p.id && s.fromHole <= hole1 && hole1 <= s.toHole,
      );
      return teamById(seg?.teamId);
    }
    return undefined;
  };

  const groups = computeGroups(round);
  const nameOf = (id: string) => round.players.find((p) => p.id === id)?.name || "ผู้เล่น";

  const selected = players.find((p) => p.id === me) ?? null;

  // ── per-player rows for the selected player ──
  const detail = selected
    ? played.map((h) => {
        const idx = holes.indexOf(h);
        const gross = grossOf(selected.id, h.id);
        const par = h.par as Par;
        const n =
          gross === null
            ? null
            : engineNet(
                gross,
                {
                  id: selected.id,
                  handicap: { 3: selected.hcpPar3, 4: selected.hcpPar4, 5: selected.hcpPar5 },
                },
                par,
              );
        const myTeam = teamAt(selected, h.index + 1);
        const games = (team?.holeLog[idx]?.games ?? [])
          .filter((g) => g.idA === selected.id || g.idB === selected.id)
          .map((g) => {
            const mine = g.idA === selected.id;
            const myT = mine ? g.teamA : g.teamB;
            const oppT = mine ? g.teamB : g.teamA;
            const pts = g.winner == null ? 0 : g.winner === myT ? g.pts : -g.pts;
            return {
              rank: g.rank,
              opp: teamById(oppT),
              oppName: mine ? g.nameB : g.nameA,
              myVal: mine ? g.netA : g.netB,
              oppVal: mine ? g.netB : g.netA,
              hcp: g.hcp,
              pts,
              tie: g.winner == null && g.netA != null && g.netB != null,
              bonus: g.winner === myT ? g.bonus : null,
            };
          });
        const side = groups.games.flatMap((gg) =>
          (gg.holeLog[idx]?.transfers ?? [])
            .filter((t) => t.from === selected.id || t.to === selected.id)
            .map((t) => ({
              label: `${gg.groupName} · ${GAME_LABEL[gg.game]}`,
              other: nameOf(t.from === selected.id ? t.to : t.from),
              pts: t.to === selected.id ? t.pts : -t.pts,
              bonus: t.bonus,
            })),
        );
        return {
          hole: h,
          gross,
          n,
          myTeam,
          games,
          side,
          teamSum: games.reduce((s, g) => s + g.pts, 0),
          sideSum: side.reduce((s, x) => s + x.pts, 0),
        };
      })
    : [];

  const allGames = detail.flatMap((d) => d.games);
  const won = allGames.filter((g) => g.pts > 0);
  const lost = allGames.filter((g) => g.pts < 0);
  const ties = allGames.filter((g) => g.tie);
  const enteredHoles = detail.filter((d) => d.gross !== null);
  const grossTotal = enteredHoles.reduce((s, d) => s + (d.gross ?? 0), 0);
  const parTotal = enteredHoles.reduce((s, d) => s + d.hole.par, 0);

  return (
    <div className="space-y-5">
      <Section title="สกอร์รายคน" subtitle="อัปเดตสดทุกเครื่อง · แตะชื่อเพื่อดูวิธีคิดของคนนั้น">
        {/* scorecard grid */}
        <Card className="overflow-x-auto p-0">
          <table className="text-xs">
            <thead>
              <tr className="text-black/40">
                <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left font-semibold">
                  หลุม
                </th>
                {holes.map((h) => (
                  <th key={h.id} className="w-7 px-0.5 py-1.5 text-center font-semibold">
                    {h.index + 1}
                    {h.turboOn && <div className="text-[9px] leading-none text-[#C9A227]">⚡</div>}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-semibold">รวม</th>
              </tr>
              <tr className="border-b border-black/10 text-black/30">
                <td className="sticky left-0 z-10 bg-white px-2 py-1">Par</td>
                {holes.map((h) => (
                  <td key={h.id} className="text-center">
                    {h.par}
                  </td>
                ))}
                <td className="px-2 text-right">
                  {holes.reduce((s, h) => s + h.par, 0)}
                </td>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const total = holes.reduce((s, h) => s + (grossOf(p.id, h.id) ?? 0), 0);
                const parDone = holes.reduce(
                  (s, h) => s + (grossOf(p.id, h.id) !== null ? h.par : 0),
                  0,
                );
                const active = selected?.id === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => pick(p.id)}
                    className={cx(
                      "cursor-pointer border-b border-black/5",
                      active && "bg-[#1B5E20]/5",
                    )}
                  >
                    <td
                      className={cx(
                        "sticky left-0 z-10 max-w-[84px] truncate px-2 py-1.5 font-semibold",
                        active ? "bg-[#eef3ee] text-[#1B5E20]" : "bg-white",
                      )}
                    >
                      {p.mainRole === "RUNNER" ? "🏃 " : ""}
                      {p.name}
                    </td>
                    {holes.map((h) => {
                      const g = grossOf(p.id, h.id);
                      const t = p.mainRole === "RUNNER" ? teamAt(p, h.index + 1) : undefined;
                      return (
                        <td
                          key={h.id}
                          className="py-1 text-center"
                          style={t ? { boxShadow: `inset 0 -2px 0 ${t.color}` } : undefined}
                        >
                          {g === null ? (
                            <span className="text-black/15">·</span>
                          ) : (
                            <span
                              className={cx(
                                "inline-flex h-5 w-5 items-center justify-center tabular-nums",
                                cellTone(g, h.par),
                              )}
                            >
                              {g}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-2 text-right tabular-nums">
                      <b>{total || "–"}</b>
                      {total > 0 && (
                        <span className="ml-1 text-[10px] text-black/40">
                          {fmt(total - parDone)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="px-1 text-[11px] text-black/40">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-green-600 align-middle" />
          Birdie ·{" "}
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#C9A227] align-middle" />
          Eagle+ · <span className="text-red-500">แดง</span> = Double bogey+ · 🏃 เส้นใต้ = ทีมที่ตัววิ่งอยู่หลุมนั้น
        </p>
      </Section>

      {/* per-player breakdown */}
      {!selected ? (
        <Card>
          <p className="text-center text-sm text-black/50">แตะชื่อในตารางเพื่อดูวิธีคิดรายคน</p>
        </Card>
      ) : (
        <Section
          title={`การ์ดของ ${selected.name}`}
          subtitle={`ต่อ P3 ${selected.hcpPar3} · P4 ${selected.hcpPar4} · P5 ${selected.hcpPar5}`}
        >
          <Card className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-black/50">ตีรวม ({enteredHoles.length} หลุม)</span>
              <b>
                {grossTotal || "–"}
                {grossTotal > 0 && (
                  <span className="ml-1 text-xs font-normal text-black/40">
                    {fmt(grossTotal - parTotal)}
                  </span>
                )}
              </b>
            </div>
            {bet && selected.mainRole !== "OFF" && (
              <div className="flex justify-between">
                <span className="text-black/50">
                  ก๊วนใหญ่ (เกมที่เป็นตัวเทียบ) · ชนะ {won.length} แพ้ {lost.length} เสมอ{" "}
                  {ties.length}
                </span>
                <b className={tone(allGames.reduce((s, g) => s + g.pts, 0))}>
                  {fmt(allGames.reduce((s, g) => s + g.pts, 0))}
                </b>
              </div>
            )}
            {selected.id in groups.playerTotals && (
              <div className="flex justify-between">
                <span className="text-black/50">วงส่วนตัว (สุทธิ)</span>
                <b className={tone(groups.playerTotals[selected.id] ?? 0)}>
                  {fmt(groups.playerTotals[selected.id] ?? 0)}
                </b>
              </div>
            )}
            <p className="text-[11px] text-black/40">
              แต้มก๊วนใหญ่เป็นของทีม — ตัวเลขนี้คือเกมที่คนนี้ถูกนับเป็น Best ของทีม
            </p>
          </Card>

          <div className="space-y-1.5">
            {[...detail].reverse().map((d) => (
              <Card key={d.hole.id} className="space-y-1 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-black/70">หลุม {d.hole.index + 1}</span>
                  <span className="text-xs text-black/40">
                    Par {d.hole.par}
                    {d.hole.turboOn ? " · ⚡" : ""}
                  </span>
                  {d.myTeam && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: d.myTeam.color }}
                    >
                      {selected.mainRole === "RUNNER" ? "🏃 " : ""}
                      {d.myTeam.name}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-black/50">
                    {d.gross === null ? "ยังไม่กรอก" : `ตี ${d.gross} · net ${d.n}`}
                  </span>
                </div>

                {d.games.map((g, i) => (
                  <p key={i} className="text-xs text-black/60">
                    <span className="font-semibold text-black/40">B{g.rank + 1}</span> vs{" "}
                    <span style={{ color: g.opp?.color }}>{g.opp?.name}</span>
                    {g.oppName ? ` · ${g.oppName}` : ""} —{" "}
                    {g.oppVal === null ? (
                      <span className="text-black/30">ไม่มีคู่เทียบ</span>
                    ) : (
                      <>
                        {g.myVal} v {g.oppVal}
                        {!g.hcp && (
                          <span className="ml-1 rounded bg-[#C9A227]/15 px-1 text-[10px] text-[#9a7d1f]">
                            ไม่ต่อ
                          </span>
                        )}{" "}
                        {g.tie ? (
                          <span className="text-black/40">เสมอ</span>
                        ) : (
                          <b className={tone(g.pts)}>
                            {g.pts > 0 ? "ชนะ" : "แพ้"} {fmt(g.pts)}
                          </b>
                        )}
                        {g.bonus ? ` · ${g.bonus}` : ""}
                      </>
                    )}
                  </p>
                ))}
                {d.games.length === 0 && bet && selected.mainRole !== "OFF" && d.gross !== null && (
                  <p className="text-xs text-black/30">ไม่ได้เป็น Best ที่ถูกนับในหลุมนี้</p>
                )}

                {d.side.map((x, i) => (
                  <p key={`s${i}`} className="text-xs text-black/60">
                    <span className="text-[#9a7d1f]">{x.label}</span> ·{" "}
                    {x.pts > 0 ? `ได้จาก ${x.other}` : `จ่าย ${x.other}`}{" "}
                    <b className={tone(x.pts)}>{fmt(x.pts)}</b>
                    {x.bonus ? ` · ${x.bonus}` : ""}
                  </p>
                ))}

                {(d.games.length > 0 || d.side.length > 0) && (
                  <p className="text-right text-[11px] text-black/40">
                    หลุมนี้: ทีม <b className={tone(d.teamSum)}>{fmt(d.teamSum)}</b>
                    {d.side.length > 0 && (
                      <>
                        {" "}
                        · ส่วนตัว <b className={tone(d.sideSum)}>{fmt(d.sideSum)}</b>
                      </>
                    )}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
