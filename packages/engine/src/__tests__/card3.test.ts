import { describe, expect, it } from "vitest";

import { computeCard3, settle, validHand } from "../index";
import type { Card3Hand } from "../index";

const sum = (t: Record<string, number>) =>
  Object.values(t).reduce((a, b) => a + b, 0);

describe("CARD3 §7 golden", () => {
  it("C1 — single valid hand (3 players)", () => {
    expect(validHand([30, -10, -20])).toBe(true);
    const hands: Card3Hand[] = [
      { index: 1, points: { a: 30, b: -10, c: -20 } },
    ];
    const r = computeCard3(["a", "b", "c"], hands);
    expect(r.totals).toEqual({ a: 30, b: -10, c: -20 });
    expect(sum(r.totals)).toBe(0);
    expect(r.handLog[0]!.sum).toBe(0);
  });

  it("C2 — non-zero sum is invalid (reject)", () => {
    expect(validHand([30, -10, -10])).toBe(false); // sum +10
  });

  it("C3 — accumulate across hands", () => {
    const hands: Card3Hand[] = [
      { index: 1, points: { a: 50, b: -50 } },
      { index: 2, points: { a: -20, b: 20 } },
    ];
    const r = computeCard3(["a", "b"], hands);
    expect(r.totals).toEqual({ a: 30, b: -30 });
    expect(sum(r.totals)).toBe(0);
  });

  it("C4 — 4 players, multiple winners/losers", () => {
    expect(validHand([60, 20, -30, -50])).toBe(true);
    const r = computeCard3(
      ["a", "b", "c", "d"],
      [{ index: 1, points: { a: 60, b: 20, c: -30, d: -50 } }],
    );
    expect(r.totals).toEqual({ a: 60, b: 20, c: -30, d: -50 });
    expect(sum(r.totals)).toBe(0);
  });

  it("C5 — edit a hand → totals update, stays Σ=0", () => {
    const before = computeCard3(
      ["a", "b"],
      [{ index: 1, points: { a: 50, b: -50 } }],
    );
    expect(before.totals).toEqual({ a: 50, b: -50 });
    const after = computeCard3(
      ["a", "b"],
      [{ index: 1, points: { a: 40, b: -40 } }],
    );
    expect(after.totals).toEqual({ a: 40, b: -40 });
    expect(sum(after.totals)).toBe(0);
  });

  it("invariant — remove a hand reduces totals, stays Σ=0", () => {
    const hands: Card3Hand[] = [
      { index: 1, points: { a: 50, b: -50 } },
      { index: 2, points: { a: -20, b: 20 } },
    ];
    const removed = computeCard3(["a", "b"], hands.slice(0, 1));
    expect(removed.totals).toEqual({ a: 50, b: -50 });
    expect(sum(removed.totals)).toBe(0);
  });

  it("missing cell treated as 0", () => {
    const r = computeCard3(
      ["a", "b", "c"],
      [{ index: 1, points: { a: 10, b: -10 } }], // c omitted
    );
    expect(r.totals).toEqual({ a: 10, b: -10, c: 0 });
  });

  it("settle — greedy debtor→creditor", () => {
    const transfers = settle({ a: 120, b: -80, c: -40 });
    expect(transfers).toEqual([
      { from: "b", to: "a", amount: 80 },
      { from: "c", to: "a", amount: 40 },
    ]);
  });
});
