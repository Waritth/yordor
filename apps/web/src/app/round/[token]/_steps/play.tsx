"use client";

import { computeTeam, net as engineNet } from "@yordor/engine";
import type { Par } from "@yordor/engine";
import { useState } from "react";

import { Button, Card, cx } from "~/app/_ui";
import { buildTeamInput, teamBets } from "~/lib/team-input";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";
import { HoleBreakdown } from "./hole-breakdown";

export function PlayStep({
  token,
  round,
  onResult,
}: {
  token: string;
  round: RoundData;
  onResult: () => void;
}) {
  const utils = api.useUtils();
  const invalidate = () => {
    void utils.round.get.invalidate({ token });
    void utils.result.get.invalidate({ token });
  };
  // Optimistic: update the round cache immediately so net/preview react instantly.
  const setScore = api.score.set.useMutation({
    onMutate: async (vars) => {
      await utils.round.get.cancel({ token });
      const prev = utils.round.get.getData({ token });
      utils.round.get.setData({ token }, (old) => {
        if (!old) return old;
        const scores = old.scores.filter(
          (s) => !(s.playerId === vars.playerId && s.holeId === vars.holeId),
        );
        if (vars.strokes !== null) {
          scores.push({
            id: "optimistic",
            roundId: old.id,
            playerId: vars.playerId,
            holeId: vars.holeId,
            strokes: vars.strokes,
          });
        }
        return { ...old, scores };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.round.get.setData({ token }, ctx.prev);
    },
    onSettled: invalidate,
  });
  const setPar = api.hole.setPar.useMutation({ onSuccess: invalidate });
  const setTurbo = api.hole.setTurbo.useMutation({ onSuccess: invalidate });

  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);

  const holes = round.holes;
  const hole = holes[idx];
  if (!hole) return null;
  const par = hole.par as Par;

  // score lookup for current hole
  const scoreOf = (playerId: string): number | null => {
    const s = round.scores.find(
      (x) => x.playerId === playerId && x.holeId === hole.id,
    );
    return s?.strokes ?? null;
  };

  // live preview (client-side engine — same package as server result.get)
  const bet = teamBets(round)[0];
  const preview = bet
    ? computeTeam(...inputTuple(round, bet))
    : null;
  const holeDetail = preview?.holeLog[idx];

  const commitScore = (playerId: string, raw: string) => {
    const trimmed = raw.trim();
    const strokes = trimmed === "" ? null : Number.parseInt(trimmed, 10);
    if (strokes !== null && (!Number.isInteger(strokes) || strokes < 1 || strokes > 20))
      return;
    if (strokes === scoreOf(playerId)) return;
    setScore.mutate({ token, playerId, holeId: hole.id, strokes });
  };

  return (
    <div className="space-y-5">
      {/* hole nav */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            disabled={idx === 0}
            onClick={() => setIdx((i) => i - 1)}
            className="rounded-lg bg-black/5 px-3 py-1.5 text-lg disabled:opacity-30"
          >
            ‹
          </button>
          <span className="text-lg font-bold text-[#1B5E20]">
            หลุม {idx + 1}
            <span className="text-sm font-normal text-black/40">
              {" "}
              / {holes.length}
            </span>
          </span>
          <button
            disabled={idx === holes.length - 1}
            onClick={() => setIdx((i) => i + 1)}
            className="rounded-lg bg-black/5 px-3 py-1.5 text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-black/50">Par</span>
          {([3, 4, 5] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPar.mutate({ token, holeId: hole.id, par: p })}
              className={cx(
                "rounded-lg px-3 py-1 text-sm font-semibold",
                par === p ? "bg-[#1B5E20] text-white" : "bg-black/5 text-black/50",
              )}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() =>
              setTurbo.mutate({
                token,
                holeId: hole.id,
                turboOn: !hole.turboOn,
                turboAllowed: true,
              })
            }
            className={cx(
              "ml-auto rounded-lg px-3 py-1 text-sm font-semibold",
              hole.turboOn
                ? "bg-[#C9A227] text-white"
                : "bg-black/5 text-black/50",
            )}
          >
            ⚡ Turbo {hole.turboOn ? "เปิด" : "ปิด"}
          </button>
        </div>
      </Card>

      {/* score entry */}
      <Card className="space-y-1">
        {round.players.map((p) => {
          const gross = scoreOf(p.id);
          const n =
            gross === null
              ? null
              : engineNet(
                  gross,
                  { id: p.id, handicap: { 3: p.hcpPar3, 4: p.hcpPar4, 5: p.hcpPar5 } },
                  par,
                );
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 border-b border-black/5 py-1.5 last:border-0"
            >
              <span className="flex-1 truncate text-sm font-medium">
                {p.name}
              </span>
              <span className="w-16 text-right text-xs text-black/40">
                {n === null ? "—" : `net ${n}`}
              </span>
              <input
                key={`${hole.id}-${p.id}-${gross ?? ""}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                defaultValue={gross ?? ""}
                onBlur={(e) => commitScore(p.id, e.target.value)}
                className="w-16 rounded-lg border border-black/10 px-2 py-1.5 text-center outline-none focus:border-[#1B5E20]"
              />
            </div>
          );
        })}
      </Card>

      {/* live totals */}
      {preview && bet && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-black/40">
              สดทุกหลุม
            </span>
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-xs text-[#1B5E20]"
            >
              {open ? "ซ่อน" : "วิธีคิดหลุมนี้ ▾"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {bet.teams.map((t) => (
              <span key={t.id} className="text-sm font-semibold">
                <span
                  className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: t.color }}
                />
                {t.name}{" "}
                <span
                  className={cx(
                    (preview.totals[t.id] ?? 0) > 0
                      ? "text-green-600"
                      : (preview.totals[t.id] ?? 0) < 0
                        ? "text-red-500"
                        : "text-black/40",
                  )}
                >
                  {fmt(preview.totals[t.id] ?? 0)}
                </span>
              </span>
            ))}
          </div>
          {open && holeDetail && (
            <div className="border-t border-black/5 pt-2">
              <HoleBreakdown detail={holeDetail} teams={bet.teams} />
            </div>
          )}
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          disabled={idx === holes.length - 1}
          onClick={() => setIdx((i) => Math.min(holes.length - 1, i + 1))}
        >
          หลุมถัดไป →
        </Button>
        <Button className="flex-1" onClick={onResult}>
          ☰ ดูผลรวม
        </Button>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

// computeTeam(teams, holes, scores) spread from the adapter
function inputTuple(
  round: Parameters<typeof buildTeamInput>[0],
  bet: Parameters<typeof buildTeamInput>[1],
) {
  const { teams, holes, scores } = buildTeamInput(round, bet);
  return [teams, holes, scores] as const;
}
