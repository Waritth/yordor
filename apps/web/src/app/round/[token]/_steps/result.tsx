"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

import { Button, Card, Section, cx } from "~/app/_ui";
import { GAME_LABEL } from "~/lib/group-input";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";
import { GroupHoleBreakdown } from "./group-breakdown";
import { HoleBreakdown } from "./hole-breakdown";

export function ResultStep({
  token,
  round,
  onBack,
}: {
  token: string;
  round: RoundData;
  onBack: () => void;
}) {
  const utils = api.useUtils();
  const { data } = api.result.get.useQuery(
    { token },
    { refetchInterval: 5000 },
  );
  const setStatus = api.round.setStatus.useMutation({
    onSuccess: () => utils.round.get.invalidate({ token }),
  });

  const [copied, setCopied] = useState(false);
  const [openHole, setOpenHole] = useState<number | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    setShareUrl(`${window.location.origin}/round/${token}`);
  }, [token]);

  const share = () => {
    if (!shareUrl) return;
    void navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const teamResults = data?.teamResults ?? [];

  return (
    <div className="space-y-6">
      <Section title="05 ผลรวม" subtitle="คำนวณสดจากสกอร์ปัจจุบัน">
        {teamResults.length === 0 && (
          <Card>
            <p className="text-sm text-black/50">ยังไม่มีเดิมพันทีม</p>
          </Card>
        )}

        {teamResults.map((bet) => {
          const ranked = [...bet.teams].sort(
            (a, b) => (bet.totals[b.id] ?? 0) - (bet.totals[a.id] ?? 0),
          );
          const debts: { from: string; to: string; pts: number }[] = [];
          for (const f of bet.teams)
            for (const t of bet.teams) {
              const pts = bet.matrix[f.id]?.[t.id] ?? 0;
              if (pts > 0) debts.push({ from: f.id, to: t.id, pts });
            }
          const nameOf = (id: string) =>
            bet.teams.find((t) => t.id === id)?.name ?? id;

          return (
            <Card key={bet.betId} className="space-y-3">
              <p className="text-xs font-semibold text-black/40">
                เดิมพัน: {bet.name} ·{" "}
                {["Best 1", "Best 1-2", "Best 1-2-3"][bet.bestN - 1]}
              </p>
              <div className="space-y-1">
                {ranked.map((t, i) => {
                  const total = bet.totals[t.id] ?? 0;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-5 text-black/30">#{i + 1}</span>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="flex-1 font-medium">{t.name}</span>
                      <span
                        className={cx(
                          "font-bold",
                          total > 0
                            ? "text-green-600"
                            : total < 0
                              ? "text-red-500"
                              : "text-black/40",
                        )}
                      >
                        {total > 0 ? `+${total}` : total} point
                      </span>
                    </div>
                  );
                })}
              </div>
              {debts.length > 0 && (
                <div className="border-t border-black/5 pt-2 text-xs text-black/60">
                  {debts.map((d, i) => (
                    <p key={i}>
                      {nameOf(d.from)} จ่าย {nameOf(d.to)}{" "}
                      <span className="font-semibold">{d.pts}</span>
                    </p>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </Section>

      {/* วงส่วนตัว — player-level, kept apart from the team table */}
      {(data?.groupResults.length ?? 0) > 0 && (
        <Section title="วงส่วนตัว" subtitle="แยกต่อวงต่อเกม · ไม่ปนกับแต้มทีม">
          {data!.groupResults.map((g) => {
            const nameOf = (id: string) =>
              round.players.find((p) => p.id === id)?.name ?? "ผู้เล่น";
            const ranked = [...g.playerIds].sort(
              (a, b) => (g.totals[b] ?? 0) - (g.totals[a] ?? 0),
            );
            // net each pair so the list reads "X จ่าย Y n"
            const debts: { from: string; to: string; pts: number }[] = [];
            for (let i = 0; i < g.playerIds.length; i++)
              for (let j = i + 1; j < g.playerIds.length; j++) {
                const a = g.playerIds[i]!;
                const b = g.playerIds[j]!;
                const d = (g.matrix[a]?.[b] ?? 0) - (g.matrix[b]?.[a] ?? 0);
                if (d > 0) debts.push({ from: a, to: b, pts: d });
                if (d < 0) debts.push({ from: b, to: a, pts: -d });
              }
            return (
              <Card key={`${g.groupId}-${g.game}`} className="space-y-2">
                <p className="text-xs font-semibold text-black/40">
                  {g.groupName} · {GAME_LABEL[g.game]}
                </p>
                <div className="space-y-1">
                  {ranked.map((id, i) => {
                    const v = g.totals[id] ?? 0;
                    return (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <span className="w-5 text-black/30">#{i + 1}</span>
                        <span className="flex-1 font-medium">{nameOf(id)}</span>
                        <span
                          className={cx(
                            "font-bold tabular-nums",
                            v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : "text-black/40",
                          )}
                        >
                          {v > 0 ? `+${v}` : v}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {debts.length > 0 && (
                  <div className="border-t border-black/5 pt-2 text-xs text-black/60">
                    {debts.map((d, i) => (
                      <p key={i}>
                        {nameOf(d.from)} จ่าย {nameOf(d.to)}{" "}
                        <span className="font-semibold">{d.pts}</span>
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() =>
                    setOpenGroup((k) =>
                      k === `${g.groupId}-${g.game}` ? null : `${g.groupId}-${g.game}`,
                    )
                  }
                  className="text-xs text-[#1B5E20]"
                >
                  {openGroup === `${g.groupId}-${g.game}` ? "ซ่อนรายหลุม" : "วิธีคิดรายหลุม ▾"}
                </button>
                {openGroup === `${g.groupId}-${g.game}` && (
                  <div className="space-y-2">
                    {g.holeLog
                      .filter((h) => Object.values(h.nets).some((n) => n != null))
                      .map((h) => (
                        <div key={h.holeIndex} className="border-t border-black/5 pt-1.5">
                          <p className="text-[11px] font-semibold text-black/50">
                            หลุม {h.holeIndex + 1} · Par {h.par}
                            {h.turbo ? " · ⚡" : ""}
                          </p>
                          <GroupHoleBreakdown game={g} holeIndex={h.holeIndex} nameOf={nameOf} />
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            );
          })}

          <Card className="space-y-1">
            <p className="text-xs font-semibold text-black/40">
              รวมสุทธิต่อคน (ทุกวง)
            </p>
            {round.players
              .filter((p) => p.id in (data?.playerTotals ?? {}))
              .sort(
                (a, b) =>
                  (data!.playerTotals[b.id] ?? 0) - (data!.playerTotals[a.id] ?? 0),
              )
              .map((p) => {
                const v = data!.playerTotals[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center text-sm">
                    <span className="flex-1 font-medium">{p.name}</span>
                    <span
                      className={cx(
                        "font-bold tabular-nums",
                        v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : "text-black/40",
                      )}
                    >
                      {v > 0 ? `+${v}` : v}
                    </span>
                  </div>
                );
              })}
          </Card>
        </Section>
      )}

      {/* per-hole log — tap a hole to expand the Best1/Best2 breakdown */}
      {teamResults[0] && (
        <Section title="วิธีคิดรายหลุม" subtitle="แตะหลุมเพื่อกางดู">
          <div className="space-y-1.5">
            {teamResults[0].holeLog.map((h) => {
              const pts = h.games.reduce((s, g) => s + g.pts, 0);
              const open = openHole === h.holeIndex;
              return (
                <Card key={h.holeIndex} className="p-0">
                  <button
                    onClick={() => setOpenHole(open ? null : h.holeIndex)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold text-black/70">
                      หลุม {h.holeIndex + 1}{" "}
                      <span className="font-normal text-black/40">
                        · Par {h.par}
                        {h.turbo ? " · ⚡×2" : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-black/40">
                      <span>{pts} pt</span>
                      <span
                        className={cx(
                          "transition",
                          open ? "rotate-180" : "",
                        )}
                      >
                        ⌄
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-black/5 p-3">
                      <HoleBreakdown
                        detail={h}
                        teams={teamResults[0]!.teams}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      {/* share */}
      <Card className="flex flex-col items-center gap-3 text-center">
        <div>
          <p className="text-sm font-semibold text-black/70">แชร์รอบนี้</p>
          <p className="text-xs text-black/40">สแกน QR หรือส่งลิงก์ — ใครมีก็กรอก/ดูได้</p>
        </div>
        {shareUrl && (
          <div className="rounded-xl bg-white p-3">
            <QRCode value={shareUrl} size={148} />
          </div>
        )}
        <Button variant="ghost" className="w-full" onClick={share}>
          {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}
        </Button>
      </Card>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← แก้สกอร์
        </Button>
        {round.status === "FINISHED" ? (
          <Button
            className="flex-1"
            variant="ghost"
            onClick={() => setStatus.mutate({ token, status: "PLAYING" })}
          >
            ปลดล็อกแก้สกอร์
          </Button>
        ) : (
          <Button
            className="flex-1"
            onClick={() => setStatus.mutate({ token, status: "FINISHED" })}
          >
            จบรอบ (ล็อก)
          </Button>
        )}
      </div>
    </div>
  );
}
