"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card, cx } from "~/app/_ui";
import { addRecent, getRecent, parseToken, type RecentRound } from "~/lib/recent";
import { api } from "~/trpc/react";

const TEAM_GAME = "Best 1 Best 2";
const CARD_GAME = "ไพ่สามกอง";

const LOCKED_GAMES = [
  { icon: "⚔️", label: "แมตช์", sub: "ตัวต่อตัว · นับหลุม/สกอร์รวม" },
  { icon: "🏌️", label: "สโตรก", sub: "เดี่ยว · นับสกอร์รวม net/gross" },
  { icon: "🪙", label: "บ๊วยจ่ายหัว", sub: "รายหลุม · บ๊วยจ่ายทุกหัว" },
];

function todayName() {
  return new Date().toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Home() {
  const router = useRouter();
  const [recent, setRecent] = useState<RecentRound[]>([]);
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [link, setLink] = useState("");
  const [locked, setLocked] = useState<string | null>(null);

  useEffect(() => setRecent(getRecent()), []);

  const create = api.round.create.useMutation({
    onSuccess: (r, vars) => {
      const isCard = vars.gameType === "CARD3";
      addRecent({
        token: r.accessToken,
        name: vars.name ?? todayName(),
        holeCount: isCard ? 0 : (vars.holeCount ?? 18),
        ts: Date.now(),
        game: isCard ? CARD_GAME : TEAM_GAME,
      });
      router.push(`/round/${r.accessToken}`);
    },
  });

  const playTeam = () =>
    create.mutate({ mode: "TEAM", name: todayName(), holeCount });
  const playCard = () =>
    create.mutate({ gameType: "CARD3", name: todayName() });

  const open = () => {
    const token = parseToken(link);
    if (token) router.push(`/round/${token}`);
  };

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#F7F5EF] px-4 py-8">
      <div className="space-y-6">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold text-[#1B5E20]">⛳ YorDor</h1>
          <p className="mt-1 text-black/50">นับแต้มกอล์ฟ หลายโหมด</p>
        </header>

        {/* game picker */}
        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-black/50">เลือกเกม</p>

          {/* Team — playable */}
          <Card className="space-y-3 border-2 border-[#1B5E20]/20">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⛳</span>
              <div className="flex-1">
                <h3 className="font-bold text-[#1B5E20]">{TEAM_GAME}</h3>
                <p className="text-xs text-black/50">
                  แบ่งทีม · Best 1/Best 2 · ตีคู่ round-robin
                </p>
              </div>
              <span className="rounded-full bg-[#1B5E20]/10 px-2 py-0.5 text-[10px] font-bold text-[#1B5E20]">
                เล่นได้
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-black/50">จำนวนหลุม</span>
              {([9, 18] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setHoleCount(n)}
                  className={cx(
                    "rounded-lg px-3 py-1 text-sm font-semibold",
                    holeCount === n
                      ? "bg-[#1B5E20] text-white"
                      : "bg-black/5 text-black/60",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>

            <Button
              className="w-full"
              disabled={create.isPending}
              onClick={playTeam}
            >
              {create.isPending ? "กำลังสร้าง…" : "เล่น →"}
            </Button>
          </Card>

          {/* Card3 — playable */}
          <Card className="space-y-3 border-2 border-[#C9A227]/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🃏</span>
              <div className="flex-1">
                <h3 className="font-bold text-[#9a7d1f]">{CARD_GAME}</h3>
                <p className="text-xs text-black/50">
                  นับแต้มรายตา · กรอกมือ · รวมทุกตา = 0
                </p>
              </div>
              <span className="rounded-full bg-[#C9A227]/15 px-2 py-0.5 text-[10px] font-bold text-[#9a7d1f]">
                เล่นได้
              </span>
            </div>
            <Button
              className="w-full bg-[#C9A227] hover:bg-[#b08f22]"
              disabled={create.isPending}
              onClick={playCard}
            >
              {create.isPending ? "กำลังสร้าง…" : "เล่น →"}
            </Button>
          </Card>

          {/* Locked modes */}
          {LOCKED_GAMES.map((g) => (
            <button
              key={g.label}
              onClick={() => setLocked(g.label)}
              className="w-full text-left"
            >
              <Card className="flex items-center gap-3 opacity-70">
                <span className="text-2xl grayscale">{g.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-black/60">{g.label}</h3>
                  <p className="text-xs text-black/40">{g.sub}</p>
                </div>
                <span className="rounded-full bg-[#C9A227]/15 px-2 py-0.5 text-[10px] font-bold text-[#9a7d1f]">
                  เร็วๆ นี้
                </span>
              </Card>
            </button>
          ))}
        </div>

        {/* open from link */}
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-black/70">เปิดรอบจากลิงก์</p>
          <div className="flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && open()}
              placeholder="วางลิงก์/โค้ดรอบ…"
              className="flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#1B5E20]"
            />
            <Button variant="ghost" onClick={open}>
              เปิด
            </Button>
          </div>
        </Card>

        {/* recent */}
        {recent.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-sm font-semibold text-black/50">
              รอบล่าสุดในเครื่องนี้
            </p>
            {recent.map((r) => (
              <Link
                key={r.token}
                href={`/round/${r.token}`}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {r.name || "รอบไม่มีชื่อ"}
                </span>
                <span className="ml-2 shrink-0 text-xs text-black/40">
                  {r.holeCount > 0
                    ? `${r.game ?? "รอบ"} · ${r.holeCount} หลุม`
                    : (r.game ?? "รอบ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* "coming soon" sheet */}
      {locked && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
          onClick={() => setLocked(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-black/10" />
            <h3 className="text-lg font-bold text-[#1B5E20]">🚧 กำลังพัฒนา</h3>
            <p className="text-sm text-black/60">
              โหมด “{locked}” เร็วๆ นี้ — ตอนนี้เล่น {TEAM_GAME} ได้ก่อน
            </p>
            <Button className="w-full" onClick={() => setLocked(null)}>
              เข้าใจแล้ว
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
