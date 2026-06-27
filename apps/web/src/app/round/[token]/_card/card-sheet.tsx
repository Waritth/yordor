"use client";

import { computeCard3 } from "@yordor/engine";
import { useState } from "react";

import { Button, Card, Section, cx } from "~/app/_ui";
import { api } from "~/trpc/react";

import type { RoundData } from "../round-flow";
import { CardHandEntry } from "./card-hand-entry";

type Editing = { handId: string | null } | null;

const pointsOf = (
  hand: RoundData["cardHands"][number],
): Record<string, number> =>
  Object.fromEntries(hand.scores.map((s) => [s.playerId, s.points]));

export function CardSheet({
  token,
  round,
  onResult,
}: {
  token: string;
  round: RoundData;
  onResult: () => void;
}) {
  const utils = api.useUtils();
  const invalidate = () => utils.round.get.invalidate({ token });

  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);
  const afterWrite = () => {
    close();
    void invalidate();
  };

  const addHand = api.card.addHand.useMutation({ onSuccess: afterWrite });
  const updateHand = api.card.updateHand.useMutation({ onSuccess: afterWrite });
  const removeHand = api.card.removeHand.useMutation({ onSuccess: afterWrite });

  const players = round.players;
  const hands = round.cardHands;
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  const { totals } = computeCard3(
    players.map((p) => p.id),
    hands.map((h) => ({ index: h.index, points: pointsOf(h) })),
  );

  const editingHand =
    editing?.handId != null
      ? hands.find((h) => h.id === editing.handId)
      : undefined;

  return (
    <div className="space-y-5">
      <Section title="ลงแต้มรายตา" subtitle="แต่ละตาผลรวมต้องเป็น 0">
        <Button
          className="w-full bg-[#C9A227] hover:bg-[#b08f22]"
          onClick={() => setEditing({ handId: null })}
        >
          + ลงตาใหม่
        </Button>

        {hands.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-black/40">
              ยังไม่มีตา — กด “ลงตาใหม่”
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs text-black/40">
                  <th className="px-2 py-2 text-left">ตา</th>
                  {players.map((p) => (
                    <th key={p.id} className="px-2 py-2 text-right">
                      <span className="block max-w-[64px] truncate">
                        {p.name || "—"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hands.map((h) => {
                  const pts = pointsOf(h);
                  const dark = Math.floor((h.index - 1) / 13) % 2 === 1;
                  const setEnd = h.index % 13 === 0;
                  return (
                    <tr
                      key={h.id}
                      onClick={() => setEditing({ handId: h.id })}
                      className={cx(
                        "cursor-pointer",
                        dark ? "bg-black/[0.04]" : "bg-transparent",
                        setEnd ? "border-b-2 border-black/15" : "border-b border-black/5",
                      )}
                    >
                      <td className="px-2 py-1.5 text-left font-semibold text-black/50">
                        {h.index}
                      </td>
                      {players.map((p) => {
                        const v = pts[p.id] ?? 0;
                        return (
                          <td
                            key={p.id}
                            className={cx(
                              "px-2 py-1.5 text-right tabular-nums",
                              v > 0
                                ? "text-green-700"
                                : v < 0
                                  ? "text-red-600"
                                  : "text-black/30",
                            )}
                          >
                            {v === 0 ? "0" : fmt(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0">
                <tr className="border-t-2 border-black/20 bg-[#F7F5EF] font-bold">
                  <td className="px-2 py-2 text-left text-black/60">รวม</td>
                  {players.map((p) => {
                    const v = totals[p.id] ?? 0;
                    return (
                      <td
                        key={p.id}
                        className={cx(
                          "px-2 py-2 text-right tabular-nums",
                          v > 0
                            ? "text-green-700"
                            : v < 0
                              ? "text-red-600"
                              : "text-black/40",
                        )}
                      >
                        {fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </Card>
        )}
      </Section>

      <Button variant="ghost" className="w-full" onClick={onResult}>
        ☰ ดูผลรวม
      </Button>

      {editing && (
        <CardHandEntry
          players={players.map((p) => ({ id: p.id, name: p.name }))}
          initial={editingHand ? pointsOf(editingHand) : null}
          title={
            editingHand ? `แก้ตาที่ ${editingHand.index}` : `ลงตาที่ ${hands.length + 1}`
          }
          saving={addHand.isPending || updateHand.isPending}
          onClose={close}
          onSave={(scores) =>
            editing.handId
              ? updateHand.mutate({ token, handId: editing.handId, scores })
              : addHand.mutate({ token, scores })
          }
          onRemove={
            editing.handId
              ? () => removeHand.mutate({ token, handId: editing.handId! })
              : undefined
          }
        />
      )}
    </div>
  );
}
