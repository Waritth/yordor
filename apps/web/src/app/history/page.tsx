"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, Card, cx } from "~/app/_ui";
import { api } from "~/trpc/react";

const PIN_KEY = "yordor:history-pin";

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const tone = (n: number) =>
  n > 0 ? "text-green-600" : n < 0 ? "text-red-500" : "text-black/40";
const day = (d: Date) =>
  new Date(d).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

export default function HistoryPage() {
  const [pin, setPin] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"golf" | "card">("golf");

  // remembered on this device only
  useEffect(() => {
    try {
      setPin(window.localStorage.getItem(PIN_KEY));
    } catch {
      setPin(null);
    }
  }, []);

  const q = api.history.list.useQuery(
    { pin: pin ?? "" },
    { enabled: !!pin, retry: false, staleTime: 30_000 },
  );

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    try {
      window.localStorage.setItem(PIN_KEY, v);
    } catch {}
    setPin(v);
  };
  const forget = () => {
    try {
      window.localStorage.removeItem(PIN_KEY);
    } catch {}
    setPin(null);
    setDraft("");
  };

  const locked = !pin || q.error?.data?.code === "UNAUTHORIZED";

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#F7F5EF] px-4 pb-16 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-black/40">
          ← YorDor
        </Link>
        <span className="text-sm font-semibold text-[#1B5E20]">📜 ประวัติ</span>
      </div>

      {locked ? (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-black/70">ใส่ PIN ของก๊วน</p>
          {q.error?.data?.code === "UNAUTHORIZED" && (
            <p className="text-xs text-red-500">PIN ไม่ถูกต้อง</p>
          )}
          <div className="flex gap-2">
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="PIN"
              className="flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#1B5E20]"
            />
            <Button onClick={submit}>เปิด</Button>
          </div>
          <p className="text-[11px] text-black/40">จำไว้ในเครื่องนี้ ไม่ต้องใส่ซ้ำ</p>
        </Card>
      ) : q.error ? (
        <Card>
          <p className="text-sm text-red-500">{q.error.message}</p>
        </Card>
      ) : !q.data ? (
        <p className="py-10 text-center text-sm text-black/40">กำลังโหลด…</p>
      ) : (
        <div className="space-y-4">
          <nav className="flex gap-1">
            {(
              [
                ["golf", `⛳ กอล์ฟ (${q.data.golf.length})`],
                ["card", `🃏 ไพ่สามกอง (${q.data.card.length})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cx(
                  "flex-1 rounded-lg py-2 text-sm font-semibold",
                  tab === k
                    ? k === "golf"
                      ? "bg-[#1B5E20] text-white"
                      : "bg-[#C9A227] text-white"
                    : "bg-black/5 text-black/50",
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "golf" && (
            <div className="space-y-2">
              {q.data.golf.length === 0 && (
                <p className="text-center text-sm text-black/40">ยังไม่มีรอบกอล์ฟ</p>
              )}
              {q.data.golf.map((g) => (
                <Link key={g.token} href={`/round/${g.token}`} className="block">
                  <Card className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-bold text-[#1B5E20]">
                        {g.name || day(g.createdAt)}
                      </span>
                      <span
                        className={cx(
                          "shrink-0 text-xs",
                          g.holesPlayed < g.holeCount ? "text-[#9a7d1f]" : "text-black/40",
                        )}
                      >
                        {g.holesPlayed}/{g.holeCount} หลุม · Best 1
                        {g.bestN >= 2 ? "-2" : ""}
                        {g.bestN >= 3 ? "-3" : ""}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {g.teams.map((t) => (
                        <div key={t.name} className="flex items-center gap-2 text-sm">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="font-medium">{t.name}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-black/40">
                            {t.members.join(", ")}
                          </span>
                          <span className={cx("font-bold tabular-nums", tone(t.total))}>
                            {fmt(t.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {g.runners.length > 0 && (
                      <p className="text-xs text-black/40">🏃 วิ่ง: {g.runners.join(", ")}</p>
                    )}
                    {g.groups.length > 0 && (
                      <p className="text-xs text-black/50">
                        วงส่วนตัว:{" "}
                        {g.groups.map((p, i) => (
                          <span key={p.name}>
                            {i > 0 && " · "}
                            {p.name} <b className={tone(p.total)}>{fmt(p.total)}</b>
                          </span>
                        ))}
                      </p>
                    )}
                    <p className="text-[11px] text-black/30">{day(g.createdAt)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {tab === "card" && (
            <div className="space-y-3">
              {q.data.cardBoard.length > 0 && (
                <Card className="space-y-1">
                  <p className="text-xs font-semibold text-black/40">สะสมทุกรอบ</p>
                  {q.data.cardBoard.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-black/30">#{i + 1}</span>
                      <span className="flex-1 font-medium">{p.name}</span>
                      <span className="text-xs text-black/30">{p.rounds} รอบ</span>
                      <span className={cx("w-14 text-right font-bold tabular-nums", tone(p.total))}>
                        {fmt(p.total)}
                      </span>
                    </div>
                  ))}
                </Card>
              )}
              {q.data.card.map((c) => (
                <Link key={c.token} href={`/round/${c.token}`} className="block">
                  <Card className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-bold text-[#9a7d1f]">
                        {c.name || day(c.createdAt)}
                      </span>
                      <span className="shrink-0 text-xs text-black/40">{c.hands} ตา</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                      {c.players.map((p) => (
                        <span key={p.name}>
                          {p.name} <b className={tone(p.total)}>{fmt(p.total)}</b>
                        </span>
                      ))}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <button onClick={forget} className="w-full py-2 text-xs text-black/30">
            ลืม PIN ในเครื่องนี้
          </button>
        </div>
      )}
    </main>
  );
}
