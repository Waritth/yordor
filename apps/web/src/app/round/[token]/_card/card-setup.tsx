"use client";

import { useState } from "react";

import { Button, Card, Section } from "~/app/_ui";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";

export function CardSetup({
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
  const add = api.player.add.useMutation({
    onSuccess: () => {
      setNewName("");
      void invalidate();
    },
  });
  const remove = api.player.remove.useMutation({ onSuccess: invalidate });
  const rename = api.player.rename.useMutation({ onSuccess: invalidate });

  const ready =
    round.players.length >= 2 &&
    round.players.every((p) => p.name.trim() !== "");

  return (
    <div className="space-y-6">
      <Section title="ตั้งวง" subtitle="ใส่รายชื่อผู้เล่น (2 คนขึ้นไป)">
        <div className="space-y-2">
          {round.players.map((p, i) => (
            <Card key={p.id} className="flex items-center gap-2 py-2.5">
              <span className="w-5 text-black/30">{i + 1}.</span>
              <input
                defaultValue={p.name}
                placeholder="ชื่อผู้เล่น"
                onBlur={(e) =>
                  e.target.value !== p.name &&
                  rename.mutate({
                    token,
                    playerId: p.id,
                    name: e.target.value,
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

      <div className="space-y-1">
        <Button
          className="w-full bg-[#C9A227] hover:bg-[#b08f22]"
          disabled={!ready}
          onClick={onNext}
        >
          ลงแต้ม →
        </Button>
        {!ready && (
          <p className="text-center text-xs text-black/40">
            ต้องมีผู้เล่น ≥2 คน · กรอกชื่อให้ครบ (ลบช่องที่ไม่ใช้)
          </p>
        )}
      </div>
    </div>
  );
}
