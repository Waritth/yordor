"use client";

import { validateSchedule, type RunnerSegment } from "@yordor/engine";
import { useState } from "react";

import { Card, Section, cx } from "~/app/_ui";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";

type Player = RoundData["players"][number];
type TeamLite = { id: string; name: string; color: string };

/** ตัววิ่ง (RUNNER) + คนไม่เล่นก๊วนใหญ่ (OFF) — docs/RUNNER_GROUPS_SPEC §1–2 */
export function RunnersCard({
  token,
  round,
  teams,
}: {
  token: string;
  round: RoundData;
  teams: TeamLite[];
}) {
  const utils = api.useUtils();
  const invalidate = () => {
    void utils.round.get.invalidate({ token });
    void utils.result.get.invalidate({ token });
  };
  const add = api.player.add.useMutation({ onSuccess: invalidate });
  const remove = api.player.remove.useMutation({ onSuccess: invalidate });
  const rename = api.player.rename.useMutation({ onSuccess: invalidate });
  const setHcp = api.player.setHandicap.useMutation({ onSuccess: invalidate });
  const setRole = api.player.setMainRole.useMutation({ onSuccess: invalidate });

  const extras = round.players.filter((p) => p.mainRole !== "MEMBER");

  const commitHcp = (p: Player, par: 3 | 4 | 5, raw: string) => {
    const v = Number.parseFloat(raw);
    const value = Number.isFinite(v) && v >= 0 ? v : 0;
    if (p[`hcpPar${par}`] === value) return;
    setHcp.mutate({
      token,
      playerId: p.id,
      hcpPar3: p.hcpPar3,
      hcpPar4: p.hcpPar4,
      hcpPar5: p.hcpPar5,
      [`hcpPar${par}`]: value,
    });
  };

  return (
    <Section
      title="ตัววิ่ง · ไม่เล่นก๊วนใหญ่"
      subtitle="ตัววิ่ง = อยู่ทีมตามช่วงหลุม · ปิดวิ่ง = เล่นแค่วงส่วนตัว"
    >
      <div className="space-y-2">
        {extras.map((p) => {
          const running = p.mainRole === "RUNNER";
          return (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={p.name}
                  placeholder="ชื่อผู้เล่น"
                  onBlur={(e) =>
                    e.target.value !== p.name &&
                    rename.mutate({ token, playerId: p.id, name: e.target.value })
                  }
                  className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#1B5E20]"
                />
                <button
                  onClick={() =>
                    setRole.mutate({
                      token,
                      playerId: p.id,
                      role: running ? "OFF" : "RUNNER",
                    })
                  }
                  className={cx(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                    running ? "bg-[#1B5E20] text-white" : "bg-black/5 text-black/50",
                  )}
                >
                  🏃 วิ่ง {running ? "เปิด" : "ปิด"}
                </button>
                <button
                  onClick={() => remove.mutate({ token, playerId: p.id })}
                  className="px-1 text-black/30 hover:text-red-500"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-black/40">ต่อ</span>
                {([3, 4, 5] as const).map((par) => (
                  <label key={par} className="flex items-center gap-0.5 text-xs text-black/40">
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

              {running ? (
                <ScheduleEditor
                  key={JSON.stringify(
                    round.runnerSegments.filter((s) => s.playerId === p.id),
                  )}
                  token={token}
                  playerId={p.id}
                  holeCount={round.holeCount}
                  teams={teams}
                  segments={round.runnerSegments
                    .filter((s) => s.playerId === p.id)
                    .map((s) => ({
                      teamId: s.teamId,
                      fromHole: s.fromHole,
                      toHole: s.toHole,
                    }))}
                  onSaved={invalidate}
                />
              ) : (
                <p className="text-xs text-black/40">
                  ไม่เล่นก๊วนใหญ่ — ยังกรอกสกอร์และเข้าวงส่วนตัวได้
                </p>
              )}
            </Card>
          );
        })}

        <div className="flex gap-2">
          <button
            onClick={() => add.mutate({ token, name: "", mainRole: "RUNNER" })}
            className="flex-1 rounded-xl border border-dashed border-black/15 py-2 text-xs font-semibold text-[#1B5E20] hover:bg-black/[0.03]"
          >
            + ตัววิ่ง
          </button>
          <button
            onClick={() => add.mutate({ token, name: "", mainRole: "OFF" })}
            className="flex-1 rounded-xl border border-dashed border-black/15 py-2 text-xs font-semibold text-black/50 hover:bg-black/[0.03]"
          >
            + คนเล่นแค่วงส่วนตัว
          </button>
        </div>
      </div>
    </Section>
  );
}

function ScheduleEditor({
  token,
  playerId,
  holeCount,
  teams,
  segments,
  onSaved,
}: {
  token: string;
  playerId: string;
  holeCount: number;
  teams: TeamLite[];
  segments: RunnerSegment[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<RunnerSegment[]>(segments);
  const [error, setError] = useState<string | null>(null);

  const save = api.runner.setSchedule.useMutation({
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });
  const auto = api.runner.autoSchedule.useMutation({ onSuccess: onSaved });

  // edit locally; persist as soon as the schedule is valid
  const apply = (next: RunnerSegment[]) => {
    setDraft(next);
    const err = validateSchedule(next, holeCount);
    setError(err);
    if (!err) save.mutate({ token, playerId, segments: next });
  };
  const patch = (i: number, part: Partial<RunnerSegment>) =>
    apply(draft.map((s, k) => (k === i ? { ...s, ...part } : s)));

  const num = (raw: string, fallback: number) => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const nextFrom = Math.min(
    holeCount,
    draft.reduce((m, s) => Math.max(m, s.toHole), 0) + 1,
  );

  return (
    <div className="space-y-1.5 rounded-xl bg-black/[0.03] p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-black/50">ตารางวิ่ง</span>
        <button
          onClick={() => auto.mutate({ token, playerId })}
          className="text-xs text-[#1B5E20]"
        >
          จัดอัตโนมัติ
        </button>
      </div>

      {draft.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-black/50">
          หลุม
          <input
            type="number"
            min={1}
            max={holeCount}
            defaultValue={s.fromHole}
            onBlur={(e) => patch(i, { fromHole: num(e.target.value, s.fromHole) })}
            className="w-11 rounded-md border border-black/10 bg-white px-1 py-1 text-center text-black outline-none"
          />
          –
          <input
            type="number"
            min={1}
            max={holeCount}
            defaultValue={s.toHole}
            onBlur={(e) => patch(i, { toHole: num(e.target.value, s.toHole) })}
            className="w-11 rounded-md border border-black/10 bg-white px-1 py-1 text-center text-black outline-none"
          />
          →
          <select
            value={s.teamId}
            onChange={(e) => patch(i, { teamId: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-1 py-1 text-black outline-none"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => apply(draft.filter((_, k) => k !== i))}
            className="px-1 text-black/30 hover:text-red-500"
          >
            ✕
          </button>
        </div>
      ))}

      {draft.length === 0 && (
        <p className="text-xs text-black/40">ยังไม่มีช่วงวิ่ง — หลุมที่ไม่มีช่วงจะไม่ถูกนับ</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={() =>
          teams[0] &&
          apply([...draft, { teamId: teams[0].id, fromHole: nextFrom, toHole: holeCount }])
        }
        className="text-xs font-semibold text-[#1B5E20]"
      >
        + เพิ่มช่วง
      </button>
    </div>
  );
}
