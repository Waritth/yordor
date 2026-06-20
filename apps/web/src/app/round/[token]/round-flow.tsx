"use client";

import Link from "next/link";
import { useState } from "react";

import { cx } from "~/app/_ui";
import { api, type RouterOutputs } from "~/trpc/react";

import { PlayStep } from "./_steps/play";
import { ResultStep } from "./_steps/result";
import { SetupStep } from "./_steps/setup";

export type RoundData = NonNullable<RouterOutputs["round"]["get"]>;

const STEPS = [
  { key: "setup", label: "ตั้งค่า" },
  { key: "play", label: "เล่น" },
  { key: "result", label: "ผล" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export function RoundFlow({ token }: { token: string }) {
  const { data: round, isLoading } = api.round.get.useQuery({ token });
  const [step, setStep] = useState<StepKey>("setup");

  if (isLoading) {
    return <Centered>กำลังโหลด…</Centered>;
  }
  if (!round) {
    return (
      <Centered>
        <div className="space-y-3 text-center">
          <p className="text-black/60">ไม่พบรอบนี้ (ลิงก์ผิดหรือถูกลบ)</p>
          <Link href="/" className="text-[#1B5E20] underline">
            ← กลับหน้าแรก
          </Link>
        </div>
      </Centered>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#F7F5EF] px-4 pb-16 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-black/40">
          ⛳ YorDor
        </Link>
        <span className="truncate text-sm font-semibold text-[#1B5E20]">
          {round.name || "รอบไม่มีชื่อ"}
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
                ? "bg-[#1B5E20] text-white"
                : "bg-black/5 text-black/50",
            )}
          >
            <span className="opacity-60">{i + 1}</span> {s.label}
          </button>
        ))}
      </nav>

      {step === "setup" && (
        <SetupStep token={token} round={round} onNext={() => setStep("play")} />
      )}
      {step === "play" && (
        <PlayStep
          token={token}
          round={round}
          onResult={() => setStep("result")}
        />
      )}
      {step === "result" && (
        <ResultStep
          token={token}
          round={round}
          onBack={() => setStep("play")}
        />
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5EF] px-4 text-black/60">
      {children}
    </main>
  );
}
