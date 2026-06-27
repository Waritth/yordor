"use client";

import Link from "next/link";
import { useState } from "react";

import { cx } from "~/app/_ui";

import type { RoundData } from "../round-flow";
import { CardResult } from "./card-result";
import { CardSetup } from "./card-setup";
import { CardSheet } from "./card-sheet";

const STEPS = [
  { key: "setup", label: "ตั้งวง" },
  { key: "play", label: "ลงแต้ม" },
  { key: "result", label: "ผล" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

export function CardFlow({
  token,
  round,
  syncing,
}: {
  token: string;
  round: RoundData;
  syncing: boolean;
}) {
  const [step, setStep] = useState<StepKey>("setup");

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#F7F5EF] px-4 pb-16 pt-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="shrink-0 text-sm text-black/40">
          🃏 YorDor
        </Link>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-[#9a7d1f]">
            {round.name || "ไพ่สามกอง"}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-black/40">
            <span
              className={cx(
                "h-2 w-2 rounded-full",
                syncing ? "animate-pulse bg-amber-400" : "bg-green-500",
              )}
            />
            {syncing ? "ซิงก์…" : "ซิงก์แล้ว"}
          </span>
        </span>
      </div>

      <nav className="mb-5 flex gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className={cx(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold transition",
              step === s.key
                ? "bg-[#C9A227] text-white"
                : "bg-black/5 text-black/50",
            )}
          >
            <span className="opacity-60">{i + 1}</span> {s.label}
          </button>
        ))}
      </nav>

      {step === "setup" && (
        <CardSetup token={token} round={round} onNext={() => setStep("play")} />
      )}
      {step === "play" && (
        <CardSheet
          token={token}
          round={round}
          onResult={() => setStep("result")}
        />
      )}
      {step === "result" && (
        <CardResult
          token={token}
          round={round}
          onBack={() => setStep("play")}
        />
      )}
    </main>
  );
}
