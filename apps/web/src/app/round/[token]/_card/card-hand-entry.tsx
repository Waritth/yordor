"use client";

import { useState } from "react";

import { Button, cx } from "~/app/_ui";

interface PlayerLite {
  id: string;
  name: string;
}

const toNum = (d: string | undefined): number => {
  const n = Number.parseInt(d ?? "", 10);
  return Number.isFinite(n) ? n : 0;
};

export function CardHandEntry({
  players,
  initial,
  title,
  saving,
  onSave,
  onClose,
  onRemove,
}: {
  players: PlayerLite[];
  initial: Record<string, number> | null;
  title: string;
  saving: boolean;
  onSave: (scores: { playerId: string; points: number }[]) => void;
  onClose: () => void;
  onRemove?: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const p of players) {
      const v = initial?.[p.id];
      d[p.id] = v === undefined || v === 0 ? "" : String(v);
    }
    return d;
  });

  const set = (id: string, v: string) => setDrafts((s) => ({ ...s, [id]: v }));
  const bump = (id: string, delta: number) =>
    set(id, String(toNum(drafts[id]) + delta));

  const sum = players.reduce((s, p) => s + toNum(drafts[p.id]), 0);
  const balanced = sum === 0;

  const save = () =>
    onSave(players.map((p) => ({ playerId: p.id, points: toNum(drafts[p.id]) })));

  const grid = players.length <= 4;

  const cell = (p: PlayerLite) => (
    <div
      key={p.id}
      className={cx(
        "flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm",
        grid && "flex-col justify-center",
      )}
    >
      <span className="max-w-full truncate text-sm font-semibold">
        {p.name || "ผู้เล่น"}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={drafts[p.id] ?? ""}
        onChange={(e) => set(p.id, e.target.value)}
        placeholder="0"
        className={cx(
          "rounded-lg border border-black/10 text-center font-bold outline-none focus:border-[#C9A227]",
          grid ? "w-24 py-1 text-3xl" : "w-20 py-1 text-xl",
        )}
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => bump(p.id, -1)}
          className="h-9 w-9 rounded-lg bg-black/5 text-lg font-bold text-black/60 active:scale-95"
        >
          −
        </button>
        <button
          onClick={() => bump(p.id, 1)}
          className="h-9 w-9 rounded-lg bg-black/5 text-lg font-bold text-black/60 active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/40"
      onClick={onClose}
    >
      <div
        className="mx-auto mt-auto w-full max-w-md space-y-4 rounded-t-2xl bg-[#F7F5EF] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#9a7d1f]">{title}</h3>
          <button onClick={onClose} className="px-2 text-black/40">
            ✕
          </button>
        </div>

        <div
          className={cx(
            grid ? "grid grid-cols-2 gap-2" : "max-h-[50vh] space-y-2 overflow-y-auto",
          )}
        >
          {players.map(cell)}
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
          <span className="text-sm text-black/50">รวม</span>
          <span
            className={cx(
              "text-lg font-extrabold",
              balanced ? "text-green-600" : "text-red-500",
            )}
          >
            {sum > 0 ? `+${sum}` : sum}
          </span>
          <span className="text-xs text-black/40">
            {balanced
              ? "✓ บันทึกได้"
              : sum > 0
                ? `เกิน ${sum}`
                : `ขาด ${-sum}`}
          </span>
          <Button
            className="ml-auto bg-[#C9A227] hover:bg-[#b08f22]"
            disabled={!balanced || saving}
            onClick={save}
          >
            {saving ? "บันทึก…" : "บันทึก"}
          </Button>
        </div>

        {onRemove && (
          <button
            onClick={onRemove}
            className="w-full py-1 text-center text-xs text-red-500"
          >
            ลบตานี้
          </button>
        )}
      </div>
    </div>
  );
}
