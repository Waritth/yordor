"use client";

import { Button, Card, Section, cx } from "~/app/_ui";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";

export function TeamsStep({
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
  const assign = api.team.assign.useMutation({ onSuccess: invalidate });
  const unassign = api.team.unassign.useMutation({ onSuccess: invalidate });

  const bet = round.bets.find((b) => b.mode === "TEAM");
  const teams = bet?.teams ?? [];
  const memberOf = new Map<string, string | null>();
  for (const bp of bet?.players ?? []) memberOf.set(bp.playerId, bp.teamId);

  const counts = teams.map(
    (t) => round.players.filter((p) => memberOf.get(p.id) === t.id).length,
  );
  const ready = counts.every((c) => c >= 1) && counts.length >= 2;

  return (
    <div className="space-y-6">
      <Section
        title="03 จัดทีม"
        subtitle="แตะทีมเพื่อย้ายผู้เล่น · Best 2 · Bonus + Turbo เปิด"
      >
        <div className="space-y-2">
          {round.players.map((p) => {
            const current = memberOf.get(p.id) ?? null;
            return (
              <Card key={p.id} className="flex items-center gap-2 py-2.5">
                <span className="flex-1 truncate text-sm font-medium">
                  {p.name}
                </span>
                {teams.map((t) => {
                  const active = current === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() =>
                        active
                          ? unassign.mutate({ token, playerId: p.id })
                          : assign.mutate({
                              token,
                              playerId: p.id,
                              teamId: t.id,
                            })
                      }
                      className={cx(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        active ? "text-white" : "bg-black/5 text-black/50",
                      )}
                      style={active ? { backgroundColor: t.color } : undefined}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3 px-1 text-xs text-black/50">
          {teams.map((t, i) => (
            <span key={t.id}>
              <span
                className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
                style={{ backgroundColor: t.color }}
              />
              {t.name}: {counts[i]} คน
            </span>
          ))}
        </div>
      </Section>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← กลับ
        </Button>
        <Button className="flex-1" disabled={!ready} onClick={onNext}>
          เริ่มเล่น →
        </Button>
      </div>
    </div>
  );
}
