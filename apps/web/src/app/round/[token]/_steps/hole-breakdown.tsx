"use client";

import { cx } from "~/app/_ui";

interface BdGame {
  rank: number;
  teamA: string;
  teamB: string;
  winner: string | null;
  netA: number | null;
  netB: number | null;
  nameA: string | null;
  nameB: string | null;
  grossA: number | null;
  grossB: number | null;
  pts: number;
  bonus: string | null;
  bonusMult: number;
  turbo: boolean;
}
export interface BdDetail {
  par: number;
  turbo: boolean;
  games: BdGame[];
}
interface TeamMeta {
  id: string;
  name: string;
  color: string;
}

const fmt = (n: number | null) => (n == null ? "–" : n);

export function HoleBreakdown({
  detail,
  teams,
}: {
  detail: BdDetail;
  teams: TeamMeta[];
}) {
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  const colorOf = (id: string) =>
    teams.find((t) => t.id === id)?.color ?? "#1B5E20";

  const best1 = detail.games.filter((g) => g.rank === 0);
  const best2 = detail.games.filter((g) => g.rank === 1);

  const side = (
    teamId: string,
    player: string | null,
    net: number | null,
    gross: number | null,
    win: boolean,
    align: "left" | "right",
  ) => (
    <span
      className={cx(
        "flex flex-col",
        align === "right" ? "items-end text-right" : "items-start",
      )}
    >
      <span
        className={cx("truncate", win ? "font-bold" : "text-black/50")}
        style={win ? { color: colorOf(teamId) } : undefined}
      >
        {nameOf(teamId)}
        {player ? ` · ${player}` : ""}
      </span>
      <span className="text-black/40">
        net <b className="text-black/70">{fmt(net)}</b>
        {gross != null ? ` · ตี ${gross}` : ""}
      </span>
    </span>
  );

  const renderGame = (g: BdGame, i: number) => {
    const aWin = g.winner === g.teamA;
    const bWin = g.winner === g.teamB;
    const verdict =
      g.winner == null
        ? g.netA != null && g.netB != null
          ? "เสมอ"
          : "—"
        : aWin
          ? "ชนะ ›"
          : "‹ ชนะ";
    return (
      <div key={i} className="rounded-lg bg-black/[0.03] p-2">
        <div className="flex items-start justify-between gap-2 text-[11px]">
          {side(g.teamA, g.nameA, g.netA, g.grossA, aWin, "left")}
          <span className="shrink-0 px-1 pt-0.5 text-black/40">{verdict}</span>
          {side(g.teamB, g.nameB, g.netB, g.grossB, bWin, "right")}
        </div>
        {g.pts > 0 && g.winner && (
          <div className="mt-1 text-right text-[11px] text-black/50">
            {g.bonus ? `${g.bonus} ×${g.bonusMult} · ` : ""}
            {g.turbo ? "⚡ · " : ""}
            {nameOf(g.winner === g.teamA ? g.teamB : g.teamA)} จ่าย{" "}
            <b className="text-[#1B5E20]">{g.pts}</b>
          </div>
        )}
      </div>
    );
  };

  const sumByTeam = (games: BdGame[]) => {
    const acc: Record<string, number> = {};
    for (const t of teams) acc[t.id] = 0;
    for (const g of games) {
      if (!g.winner) continue;
      const loser = g.winner === g.teamA ? g.teamB : g.teamA;
      acc[g.winner] = (acc[g.winner] ?? 0) + g.pts;
      acc[loser] = (acc[loser] ?? 0) - g.pts;
    }
    return acc;
  };

  const renderSum = (games: BdGame[], label: string, strong = false) => {
    const acc = sumByTeam(games);
    const active = teams.filter((t) => (acc[t.id] ?? 0) !== 0);
    return (
      <div
        className={cx(
          "flex flex-wrap items-center gap-x-3 gap-y-1",
          strong ? "border-t border-black/10 pt-1.5" : "",
        )}
      >
        <span
          className={cx(
            "text-[11px]",
            strong ? "font-bold text-black/70" : "text-black/40",
          )}
        >
          รวม {label}
        </span>
        {active.length === 0 ? (
          <span className="text-[11px] text-black/30">ไม่มีการจ่าย</span>
        ) : (
          active.map((t) => (
            <span key={t.id} className="text-[11px]">
              <span className="font-semibold" style={{ color: t.color }}>
                {t.name}
              </span>{" "}
              <b
                className={cx(
                  (acc[t.id] ?? 0) > 0 ? "text-green-600" : "text-red-500",
                )}
              >
                {(acc[t.id] ?? 0) > 0 ? "+" : ""}
                {acc[t.id]}
              </b>
            </span>
          ))
        )}
      </div>
    );
  };

  const group = (
    label: string,
    sub: string,
    games: BdGame[],
    emptyText: string,
  ) => (
    <div className="space-y-1.5">
      <div className="text-[11px] font-bold tracking-wide text-black/50">
        {label} <span className="font-normal text-black/30">· {sub}</span>
      </div>
      {games.length ? (
        games.map(renderGame)
      ) : (
        <div className="text-[11px] text-black/30">{emptyText}</div>
      )}
      {games.length > 0 && renderSum(games, label === "BEST 1" ? "Best 1" : "Best 2")}
    </div>
  );

  return (
    <div className="space-y-3">
      {group("BEST 1", "ต่ำสุดแต่ละทีม", best1, "ยังไม่มีข้อมูล")}
      {group("BEST 2", "ต่ำอันดับ 2", best2, "ไม่มีคู่เทียบ (คนไม่พอ)")}
      {detail.turbo && (
        <div className="rounded-md bg-[#C9A227]/10 px-2 py-1 text-[11px] text-[#9a7d1f]">
          ⚡ TURBO ×2 — point หลุมนี้คูณสอง
        </div>
      )}
      {renderSum(detail.games, "หลุมนี้", true)}
    </div>
  );
}
