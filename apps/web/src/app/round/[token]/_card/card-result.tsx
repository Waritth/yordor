"use client";

import { computeCard3, settle } from "@yordor/engine";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

import { Button, Card, Section, cx } from "~/app/_ui";

import type { RoundData } from "../round-flow";

const pointsOf = (h: RoundData["cardHands"][number]) =>
  Object.fromEntries(h.scores.map((s) => [s.playerId, s.points]));

export function CardResult({
  token,
  round,
  onBack,
}: {
  token: string;
  round: RoundData;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    setShareUrl(`${window.location.origin}/round/${token}`);
  }, [token]);

  const players = round.players;
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "ผู้เล่น";

  const { totals } = computeCard3(
    players.map((p) => p.id),
    round.cardHands.map((h) => ({ index: h.index, points: pointsOf(h) })),
  );
  const transfers = settle(totals);
  const ranked = [...players].sort(
    (a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0),
  );
  const grandSum = Object.values(totals).reduce((a, b) => a + b, 0);

  const share = () => {
    if (!shareUrl) return;
    void navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-6">
      <Section title={`สรุป (${round.cardHands.length} ตา)`}>
        <Card className="space-y-1">
          {ranked.map((p, i) => {
            const v = totals[p.id] ?? 0;
            return (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-black/30">#{i + 1}</span>
                <span className="flex-1 font-medium">{p.name || "ผู้เล่น"}</span>
                <span
                  className={cx(
                    "font-bold tabular-nums",
                    v > 0
                      ? "text-green-600"
                      : v < 0
                        ? "text-red-500"
                        : "text-black/40",
                  )}
                >
                  {v > 0 ? `+${v}` : v}
                </span>
              </div>
            );
          })}
          <div className="mt-1 border-t border-black/10 pt-1 text-right text-xs text-black/40">
            Σ = {grandSum} {grandSum === 0 ? "✓" : "⚠️"}
          </div>
        </Card>
      </Section>

      {transfers.length > 0 && (
        <Section title="แนะนำเคลียร์" subtitle="ทางเลือก — จ่ายกันยังไงให้จบ">
          <Card className="space-y-1 text-sm">
            {transfers.map((t, i) => (
              <p key={i}>
                <span className="font-semibold">{nameOf(t.from)}</span> จ่าย{" "}
                <span className="font-semibold">{nameOf(t.to)}</span>{" "}
                <b className="text-[#9a7d1f]">{t.amount}</b>
              </p>
            ))}
          </Card>
        </Section>
      )}

      <Card className="flex flex-col items-center gap-3 text-center">
        <div>
          <p className="text-sm font-semibold text-black/70">แชร์รอบนี้</p>
          <p className="text-xs text-black/40">สแกน QR หรือส่งลิงก์</p>
        </div>
        {shareUrl && (
          <div className="rounded-xl bg-white p-3">
            <QRCode value={shareUrl} size={148} />
          </div>
        )}
        <Button variant="ghost" className="w-full" onClick={share}>
          {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}
        </Button>
      </Card>

      <Button variant="ghost" className="w-full" onClick={onBack}>
        ← กลับไปลงแต้ม
      </Button>
    </div>
  );
}
