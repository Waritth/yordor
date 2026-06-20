"use client";

import { Button, Card, Section, cx } from "~/app/_ui";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";

type Player = RoundData["players"][number];

export function SetupStep({
  token,
  round,
  onNext,
}: {
  token: string;
  round: RoundData;
  onNext: () => void;
}) {
  const utils = api.useUtils();
  const invalidate = () => utils.round.get.invalidate({ token });

  const updateMeta = api.round.updateMeta.useMutation({ onSuccess: invalidate });
  const addPlayer = api.player.add.useMutation({ onSuccess: invalidate });
  const removePlayer = api.player.remove.useMutation({ onSuccess: invalidate });
  const renamePlayer = api.player.rename.useMutation({ onSuccess: invalidate });
  const setHcp = api.player.setHandicap.useMutation({ onSuccess: invalidate });
  const addTeam = api.team.create.useMutation({ onSuccess: invalidate });
  const removeTeam = api.team.remove.useMutation({ onSuccess: invalidate });
  const renameTeam = api.team.rename.useMutation({ onSuccess: invalidate });

  const bet = round.bets.find((b) => b.mode === "TEAM");
  const teams = bet?.teams ?? [];
  const memberOf = new Map<string, string | null>();
  for (const bp of bet?.players ?? []) memberOf.set(bp.playerId, bp.teamId);
  const playersOf = (teamId: string) =>
    round.players.filter((p) => memberOf.get(p.id) === teamId);

  const commitHcp = (p: Player, par: 3 | 4 | 5, raw: string) => {
    const v = Number.parseFloat(raw);
    const value = Number.isFinite(v) && v >= 0 ? v : 0;
    const next = {
      hcpPar3: p.hcpPar3,
      hcpPar4: p.hcpPar4,
      hcpPar5: p.hcpPar5,
      [`hcpPar${par}`]: value,
    };
    if (
      next.hcpPar3 === p.hcpPar3 &&
      next.hcpPar4 === p.hcpPar4 &&
      next.hcpPar5 === p.hcpPar5
    )
      return;
    setHcp.mutate({ token, playerId: p.id, ...next });
  };

  const ready =
    teams.length >= 2 &&
    teams.every((t) => {
      const ps = playersOf(t.id);
      return ps.length >= 1 && ps.every((p) => p.name.trim() !== "");
    });

  return (
    <div className="space-y-6">
      <Section title="01 ตั้งค่าเกม" subtitle={`${round.holeCount} หลุม`}>
        <Card>
          <label className="mb-1 block text-xs font-semibold text-black/50">
            ชื่อรอบ
          </label>
          <input
            defaultValue={round.name}
            onBlur={(e) =>
              e.target.value !== round.name &&
              updateMeta.mutate({ token, name: e.target.value })
            }
            placeholder="ชื่อรอบ"
            className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#1B5E20]"
          />
        </Card>
      </Section>

      <Section
        title="ทีม · ผู้เล่น · แต้มต่อ"
        subtitle="net = สกอร์จริง − แต้มต่อ · ต่อเยอะ = ได้เปรียบ"
      >
        <div className="space-y-3">
          {teams.map((t) => {
            const ps = playersOf(t.id);
            return (
              <Card key={t.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <input
                    defaultValue={t.name}
                    onBlur={(e) =>
                      e.target.value.trim() &&
                      e.target.value !== t.name &&
                      renameTeam.mutate({
                        token,
                        teamId: t.id,
                        name: e.target.value.trim(),
                      })
                    }
                    className="flex-1 rounded-lg px-1 py-0.5 text-sm font-bold text-[#1B5E20] outline-none focus:bg-black/5"
                  />
                  {teams.length > 2 && (
                    <button
                      onClick={() => removeTeam.mutate({ token, teamId: t.id })}
                      className="px-1 text-xs text-black/30 hover:text-red-500"
                    >
                      ลบทีม
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {ps.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl bg-black/[0.03] p-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          defaultValue={p.name}
                          placeholder="ชื่อผู้เล่น"
                          onBlur={(e) =>
                            e.target.value !== p.name &&
                            renamePlayer.mutate({
                              token,
                              playerId: p.id,
                              name: e.target.value,
                            })
                          }
                          className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#1B5E20]"
                        />
                        <button
                          onClick={() =>
                            removePlayer.mutate({ token, playerId: p.id })
                          }
                          className="px-1.5 text-black/30 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-xs text-black/40">ต่อ</span>
                        {([3, 4, 5] as const).map((par) => (
                          <label
                            key={par}
                            className="flex items-center gap-0.5 text-xs text-black/40"
                          >
                            P{par}
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              defaultValue={p[`hcpPar${par}`] || ""}
                              placeholder="0"
                              onBlur={(e) => commitHcp(p, par, e.target.value)}
                              className="w-11 rounded-md border border-black/10 bg-white px-1 py-1 text-center text-black outline-none focus:border-[#1B5E20]"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      addPlayer.mutate({ token, name: "", teamId: t.id })
                    }
                    className="w-full rounded-lg border border-dashed border-black/15 py-1.5 text-xs font-semibold text-[#1B5E20] hover:bg-black/[0.03]"
                  >
                    + เพิ่มผู้เล่น
                  </button>
                </div>
              </Card>
            );
          })}

          {teams.length < 6 && (
            <button
              onClick={() => addTeam.mutate({ token })}
              className="w-full rounded-2xl border border-dashed border-black/15 py-3 text-sm font-semibold text-black/50 hover:bg-black/[0.03]"
            >
              + เพิ่มทีม
            </button>
          )}
        </div>
      </Section>

      <div className="space-y-1">
        <Button className="w-full" disabled={!ready} onClick={onNext}>
          เริ่มเล่น →
        </Button>
        {!ready && (
          <p className="text-center text-xs text-black/40">
            ต้องมี ≥2 ทีม · ทุกทีมมีผู้เล่น · กรอกชื่อให้ครบ
          </p>
        )}
      </div>
    </div>
  );
}
