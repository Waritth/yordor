"use client";

import { useState } from "react";

import { Button, Card, Section } from "~/app/_ui";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";

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

  const [newName, setNewName] = useState("");

  const updateMeta = api.round.updateMeta.useMutation({ onSuccess: invalidate });
  const add = api.player.add.useMutation({
    onSuccess: () => {
      setNewName("");
      void invalidate();
    },
  });
  const remove = api.player.remove.useMutation({ onSuccess: invalidate });
  const rename = api.player.rename.useMutation({ onSuccess: invalidate });

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
        title="ผู้เล่นในรอบ"
        subtitle="ทีม/คู่ ไปจัดในสเตป “ทีม”"
      >
        <div className="space-y-2">
          {round.players.map((p, i) => (
            <Card key={p.id} className="flex items-center gap-2 py-2.5">
              <span className="w-5 text-black/30">{i + 1}.</span>
              <input
                defaultValue={p.name}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== p.name &&
                  rename.mutate({
                    token,
                    playerId: p.id,
                    name: e.target.value.trim(),
                  })
                }
                className="flex-1 rounded-lg px-2 py-1 text-sm outline-none focus:bg-black/5"
              />
              <button
                onClick={() => remove.mutate({ token, playerId: p.id })}
                className="px-2 text-black/30 hover:text-red-500"
              >
                ✕
              </button>
            </Card>
          ))}
          {round.players.length === 0 && (
            <p className="px-1 text-sm text-black/40">ยังไม่มีผู้เล่น</p>
          )}
        </div>

        <Card className="mt-2 flex gap-2 py-2.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              newName.trim() &&
              add.mutate({ token, name: newName.trim() })
            }
            placeholder="ชื่อผู้เล่น"
            className="flex-1 rounded-lg px-2 py-1 text-sm outline-none focus:bg-black/5"
          />
          <Button
            variant="ghost"
            disabled={!newName.trim() || add.isPending}
            onClick={() => add.mutate({ token, name: newName.trim() })}
          >
            + เพิ่ม
          </Button>
        </Card>
      </Section>

      <Button
        className="w-full"
        disabled={round.players.length < 2}
        onClick={onNext}
      >
        แต้มต่อ →
      </Button>
    </div>
  );
}
