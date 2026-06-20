"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card, cx } from "~/app/_ui";
import { addRecent, getRecent, parseToken, type RecentRound } from "~/lib/recent";
import { api } from "~/trpc/react";

export default function Home() {
  const router = useRouter();
  const [recent, setRecent] = useState<RecentRound[]>([]);
  const [name, setName] = useState("");
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [link, setLink] = useState("");

  useEffect(() => setRecent(getRecent()), []);

  const create = api.round.create.useMutation({
    onSuccess: (r, vars) => {
      addRecent({
        token: r.accessToken,
        name: vars.name ?? "รอบใหม่",
        holeCount: vars.holeCount ?? 18,
        ts: Date.now(),
      });
      router.push(`/round/${r.accessToken}`);
    },
  });

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

        <Card className="space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อรอบ (เช่น ก๊วนวันอาทิตย์)"
            className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#1B5E20]"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-black/60">จำนวนหลุม</span>
            {([9, 18] as const).map((n) => (
              <button
                key={n}
                onClick={() => setHoleCount(n)}
                className={cx(
                  "rounded-lg px-4 py-1.5 text-sm font-semibold",
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
            onClick={() => create.mutate({ name, holeCount })}
          >
            {create.isPending ? "กำลังสร้าง…" : "+ สร้างรอบใหม่"}
          </Button>
        </Card>

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
                <span className="font-medium">{r.name || "รอบไม่มีชื่อ"}</span>
                <span className="text-black/40">{r.holeCount} หลุม</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
