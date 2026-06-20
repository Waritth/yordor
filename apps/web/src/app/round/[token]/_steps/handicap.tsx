"use client";

import { Button, Card, Section } from "~/app/_ui";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";

type Player = RoundData["players"][number];

export function HandicapStep({
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
  const setHcp = api.player.setHandicap.useMutation({
    onSuccess: () => utils.round.get.invalidate({ token }),
  });

  const commit = (p: Player, par: 3 | 4 | 5, raw: string) => {
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

  return (
    <div className="space-y-6">
      <Section
        title="02 แต้มต่อ (Handicap)"
        subtitle="net = สกอร์จริง − แต้มต่อ · ต่อเยอะ = ได้เปรียบ"
      >
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40">
                <th className="pb-2">ผู้เล่น</th>
                <th className="pb-2 text-center">Par3</th>
                <th className="pb-2 text-center">Par4</th>
                <th className="pb-2 text-center">Par5</th>
              </tr>
            </thead>
            <tbody>
              {round.players.map((p) => (
                <tr key={p.id} className="border-t border-black/5">
                  <td className="py-1.5 pr-2 font-medium">{p.name}</td>
                  {([3, 4, 5] as const).map((par) => (
                    <td key={par} className="py-1.5 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        defaultValue={p[`hcpPar${par}`]}
                        onBlur={(e) => commit(p, par, e.target.value)}
                        className="w-14 rounded-lg border border-black/10 px-2 py-1 text-center outline-none focus:border-[#1B5E20]"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="px-1 text-xs text-black/40">ใส่ทศนิยมได้ เช่น 0.5</p>
      </Section>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← กลับ
        </Button>
        <Button className="flex-1" onClick={onNext}>
          ทีม →
        </Button>
      </div>
    </div>
  );
}
