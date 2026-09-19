"use client";

import { cx } from "~/app/_ui";
import { GAME_LABEL, type GroupGameResult } from "~/lib/group-input";

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const tone = (n: number) =>
  n > 0 ? "text-green-600" : n < 0 ? "text-red-500" : "text-black/40";

/** วิธีคิดของ 1 วง × 1 เกม ในหลุมเดียว: net ของแต่ละคน + ใครจ่ายใคร + ยอดหลุมนี้ */
export function GroupHoleBreakdown({
  game,
  holeIndex,
  nameOf,
}: {
  game: GroupGameResult;
  holeIndex: number;
  nameOf: (id: string) => string;
}) {
  const log = game.holeLog[holeIndex];
  if (!log) return null;

  const holeNet: Record<string, number> = {};
  for (const t of log.transfers) {
    holeNet[t.to] = (holeNet[t.to] ?? 0) + t.pts;
    holeNet[t.from] = (holeNet[t.from] ?? 0) - t.pts;
  }
  const entered = game.playerIds.filter((id) => log.nets[id] != null);
  const best = Math.min(...entered.map((id) => log.nets[id]!));
  const worst = Math.max(...entered.map((id) => log.nets[id]!));

  return (
    <div className="space-y-1.5 text-[11px]">
      {/* nets this hole */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-black/50">
        {game.playerIds.map((id) => {
          const n = log.nets[id];
          const mark =
            game.game === "highlow" && n != null && best !== worst
              ? n === best
                ? " 👑"
                : n === worst
                  ? " 🐢"
                  : ""
              : "";
          return (
            <span key={id}>
              {nameOf(id)}{" "}
              <b className="text-black/70">{n == null ? "–" : `net ${n}`}</b>
              {mark}
            </span>
          );
        })}
      </div>

      {/* transfers */}
      {log.transfers.length === 0 ? (
        <p className="text-black/30">
          {entered.length < 2 ? "ยังกรอกไม่ครบ" : "เสมอ — ไม่มีการจ่าย"}
        </p>
      ) : (
        <div className="rounded-lg bg-black/[0.03] p-2 text-black/60">
          {log.transfers.map((t, i) => (
            <p key={i}>
              {nameOf(t.from)} จ่าย {nameOf(t.to)}{" "}
              <b className="text-[#1B5E20]">{t.pts}</b>
              {t.bonus ? ` · ${t.bonus}` : ""}
              {log.turbo && t.pts > 1 && !t.bonus ? " · ⚡" : ""}
            </p>
          ))}
        </div>
      )}

      {/* hole sum per player */}
      {log.transfers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-black/40">รวมหลุมนี้</span>
          {game.playerIds
            .filter((id) => (holeNet[id] ?? 0) !== 0)
            .map((id) => (
              <span key={id}>
                {nameOf(id)} <b className={tone(holeNet[id] ?? 0)}>{fmt(holeNet[id] ?? 0)}</b>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

/** Header line for a group game: name · game · cumulative totals of its members. */
export function GroupGameHeader({
  game,
  nameOf,
}: {
  game: GroupGameResult;
  nameOf: (id: string) => string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-bold text-[#9a7d1f]">
        {game.groupName} · {GAME_LABEL[game.game]}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {game.playerIds.map((id) => (
          <span key={id} className="font-semibold">
            {nameOf(id)}{" "}
            <span className={cx(tone(game.totals[id] ?? 0))}>
              {fmt(game.totals[id] ?? 0)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
