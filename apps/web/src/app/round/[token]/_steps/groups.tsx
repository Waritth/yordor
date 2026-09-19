"use client";

import { Button, Card, Section, cx } from "~/app/_ui";
import {
  GAME_LABEL,
  parseGroupConfig,
  type GameKey,
  type GroupConfig,
} from "~/lib/group-input";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";

type Group = RoundData["groups"][number];
type GP = Group["players"][number];

/** สเตป "วง" — side-game groups on the same scores (docs/RUNNER_GROUPS_SPEC §4). */
export function GroupsStep({
  token,
  round,
  onBack,
  onNext,
}: {
  token: string;
  round: RoundData;
  onBack: () => void;
  onNext: () => void;
}) {
  const utils = api.useUtils();
  const invalidate = () => {
    void utils.round.get.invalidate({ token });
    void utils.result.get.invalidate({ token });
  };
  const create = api.group.create.useMutation({ onSuccess: invalidate });
  const update = api.group.update.useMutation({ onSuccess: invalidate });
  const remove = api.group.remove.useMutation({ onSuccess: invalidate });
  const setPlayers = api.group.setPlayers.useMutation({ onSuccess: invalidate });

  const roster = (g: Group, next: GP[] | Omit<GP, "id" | "groupId">[]) =>
    setPlayers.mutate({
      token,
      groupId: g.id,
      players: next.map((p) => ({
        playerId: p.playerId,
        hcpPar3: p.hcpPar3,
        hcpPar4: p.hcpPar4,
        hcpPar5: p.hcpPar5,
      })),
    });

  const toggleMember = (g: Group, playerId: string) => {
    const has = g.players.some((p) => p.playerId === playerId);
    roster(
      g,
      has
        ? g.players.filter((p) => p.playerId !== playerId)
        : [...g.players, { playerId, hcpPar3: null, hcpPar4: null, hcpPar5: null }],
    );
  };

  const setOverride = (g: Group, playerId: string, par: 3 | 4 | 5, raw: string) => {
    const v = Number.parseFloat(raw);
    const value = raw.trim() === "" || !Number.isFinite(v) || v < 0 ? null : v;
    const cur = g.players.find((p) => p.playerId === playerId);
    if (!cur || cur[`hcpPar${par}`] === value) return;
    roster(
      g,
      g.players.map((p) =>
        p.playerId === playerId ? { ...p, [`hcpPar${par}`]: value } : p,
      ),
    );
  };

  const setGame = (g: Group, game: GameKey, part: Partial<GroupConfig[GameKey]>) => {
    const cfg = parseGroupConfig(g.config);
    update.mutate({
      token,
      groupId: g.id,
      config: { ...cfg, [game]: { ...cfg[game], ...part } },
    });
  };

  const incomplete = round.groups.some((g) => g.players.length < 2);

  return (
    <div className="space-y-6">
      <Section
        title="02 วงส่วนตัว"
        subtitle="เล่นซ้อนบนสกอร์ชุดเดียวกัน · 1 คนอยู่ได้หลายวง · ไม่มีก็ข้ามได้"
      >
        <div className="space-y-3">
          {round.groups.map((g) => {
            const cfg = parseGroupConfig(g.config);
            const members = round.players.filter((p) =>
              g.players.some((gp) => gp.playerId === p.id),
            );
            return (
              <Card key={g.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={g.name}
                    onBlur={(e) =>
                      e.target.value !== g.name &&
                      update.mutate({ token, groupId: g.id, name: e.target.value })
                    }
                    className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-sm font-bold text-[#1B5E20] outline-none focus:bg-black/5"
                  />
                  <button
                    onClick={() => remove.mutate({ token, groupId: g.id })}
                    className="px-1 text-xs text-black/30 hover:text-red-500"
                  >
                    ลบวง
                  </button>
                </div>

                {/* members */}
                <div className="flex flex-wrap gap-1.5">
                  {round.players.map((p) => {
                    const on = g.players.some((gp) => gp.playerId === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleMember(g, p.id)}
                        className={cx(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          on ? "bg-[#1B5E20] text-white" : "bg-black/5 text-black/50",
                        )}
                      >
                        {p.name || "ไม่มีชื่อ"}
                      </button>
                    );
                  })}
                </div>
                {g.players.length < 2 && (
                  <p className="text-xs text-red-500">เลือกผู้เล่นอย่างน้อย 2 คน</p>
                )}

                {/* games */}
                {(["match", "highlow"] as const).map((game) => (
                  <div key={game} className="flex items-center gap-1.5">
                    <button
                      onClick={() => setGame(g, game, { on: !cfg[game].on })}
                      className={cx(
                        "flex-1 rounded-lg px-3 py-1.5 text-left text-xs font-semibold",
                        cfg[game].on
                          ? "bg-[#C9A227] text-white"
                          : "bg-black/5 text-black/50",
                      )}
                    >
                      {cfg[game].on ? "☑" : "☐"} {GAME_LABEL[game]}
                      <span className="font-normal opacity-80">
                        {game === "match" ? " · นับหลุม เจอกันทุกคู่" : " · รายหลุม"}
                      </span>
                    </button>
                    {(["bonus", "turbo"] as const).map((k) => (
                      <button
                        key={k}
                        disabled={!cfg[game].on}
                        onClick={() => setGame(g, game, { [k]: !cfg[game][k] })}
                        className={cx(
                          "rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-30",
                          cfg[game][k]
                            ? "bg-[#1B5E20] text-white"
                            : "bg-black/5 text-black/50",
                        )}
                      >
                        {k === "bonus" ? "Bonus" : "⚡Turbo"}
                      </button>
                    ))}
                  </div>
                ))}

                {/* per-group handicap override */}
                {members.length > 0 && (
                  <div className="rounded-xl bg-black/[0.03] p-2">
                    <p className="mb-1 text-xs text-black/40">
                      ต่อของวงนี้ (ว่าง = ใช้ต่อชุดหลัก)
                    </p>
                    {members.map((p) => {
                      const gp = g.players.find((x) => x.playerId === p.id)!;
                      return (
                        <div key={p.id} className="flex items-center gap-1.5 py-0.5">
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {p.name || "ไม่มีชื่อ"}
                          </span>
                          {([3, 4, 5] as const).map((par) => (
                            <label key={par} className="flex items-center gap-0.5 text-xs text-black/40">
                              P{par}
                              <input
                                key={`${gp.id}-${par}-${gp[`hcpPar${par}`] ?? ""}`}
                                type="number"
                                step="0.5"
                                min="0"
                                defaultValue={gp[`hcpPar${par}`] ?? ""}
                                placeholder={String(p[`hcpPar${par}`])}
                                onBlur={(e) => setOverride(g, p.id, par, e.target.value)}
                                className="w-11 rounded-md border border-black/10 bg-white px-1 py-1 text-center text-black outline-none focus:border-[#1B5E20]"
                              />
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          <button
            onClick={() => create.mutate({ token })}
            className="w-full rounded-2xl border border-dashed border-black/15 py-3 text-sm font-semibold text-black/50 hover:bg-black/[0.03]"
          >
            + เพิ่มวง
          </button>
        </div>
      </Section>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← กลับ
        </Button>
        <Button className="flex-1" disabled={incomplete} onClick={onNext}>
          เริ่มเล่น →
        </Button>
      </div>
    </div>
  );
}
