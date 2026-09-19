import { describe, expect, it } from "vitest";

import {
  computeGroupMatch,
  computeHighLow,
  computeTeam,
  defaultRunnerSchedule,
  validateSchedule,
} from "../index";
import type { Hole, Scores, Team } from "../index";
import { m, pl, sum } from "./helpers";

const P4: Hole = { par: 4, turbo: false };
const OFF = { bonus: false, turbo: false };

describe("R — runner (ตัววิ่ง) golden", () => {
  const a1 = pl("a1"), a2 = pl("a2"), b1 = pl("b1"), b2 = pl("b2");
  const r = pl("r");
  const scores: Scores = {
    a1: [4, 4], a2: [5, 5], b1: [4, 4], b2: [5, 5], r: [3, 3],
  };
  const teams = (runA: [number, number] | null, runB: [number, number] | null): Team[] => [
    { id: "A", players: [a1, a2], runners: runA ? [{ player: r, fromHole: runA[0], toHole: runA[1] }] : [] },
    { id: "B", players: [b1, b2], runners: runB ? [{ player: r, fromHole: runB[0], toHole: runB[1] }] : [] },
  ];

  it("R1 runner swaps teams → each side +3, net 0", () => {
    const res = computeTeam(teams([1, 1], [2, 2]), [P4, P4], scores);
    expect(res.totals).toEqual({ A: 0, B: 0 });
    expect(m(res, "B", "A")).toBe(3);
    expect(m(res, "A", "B")).toBe(3);
  });

  it("R2 hole without a segment → runner not counted", () => {
    const res = computeTeam(teams([1, 1], null), [P4, P4], scores);
    expect(res.totals).toEqual({ A: 3, B: -3 });
  });

  it("R3 two runners on the same team", () => {
    const r2 = pl("r2");
    const t: Team[] = [
      {
        id: "A", players: [a1, a2],
        runners: [
          { player: r, fromHole: 1, toHole: 1 },
          { player: r2, fromHole: 1, toHole: 1 },
        ],
      },
      { id: "B", players: [b1, b2] },
    ];
    const res = computeTeam(t, [P4], { ...scores, r2: [3] });
    expect(res.totals).toEqual({ A: 4, B: -4 });
  });

  it("R4 disabled runner (no runner entries) → ignored", () => {
    const res = computeTeam(teams(null, null), [P4, P4], scores);
    expect(res.totals).toEqual({ A: 0, B: 0 });
    expect(m(res, "A", "B") + m(res, "B", "A")).toBe(0);
  });

  it("R5 no runners → identical to 07 §4.2", () => {
    const som = pl("som"), lek = pl("lek"), joe = pl("joe"), kan = pl("kan");
    const res = computeTeam(
      [{ id: "A", players: [som, lek] }, { id: "B", players: [joe, kan] }],
      [{ par: 4, turbo: true }],
      { som: [3], lek: [5], joe: [4], kan: [6] },
    );
    expect(res.totals).toEqual({ A: 6, B: -6 });
  });
});

describe("R — runner schedule helpers", () => {
  it("default: 18 holes / 2 teams → 1–9 A, 10–18 B", () => {
    expect(defaultRunnerSchedule(["A", "B"], 18)).toEqual([
      { teamId: "A", fromHole: 1, toHole: 9 },
      { teamId: "B", fromHole: 10, toHole: 18 },
    ]);
  });
  it("default: 3 teams → 6 holes each; 2nd runner starts at B", () => {
    expect(defaultRunnerSchedule(["A", "B", "C"], 18, 1).map((s) => s.teamId)).toEqual(["B", "C", "A"]);
    expect(defaultRunnerSchedule(["A", "B", "C"], 18)[1]).toEqual({ teamId: "B", fromHole: 7, toHole: 12 });
  });
  it("default: 9 holes / 2 teams → 5 + 4", () => {
    expect(defaultRunnerSchedule(["A", "B"], 9)).toEqual([
      { teamId: "A", fromHole: 1, toHole: 5 },
      { teamId: "B", fromHole: 6, toHole: 9 },
    ]);
  });
  it("validate: overlap / out of range / ok", () => {
    expect(validateSchedule([{ teamId: "A", fromHole: 1, toHole: 9 }, { teamId: "B", fromHole: 9, toHole: 18 }], 18)).not.toBeNull();
    expect(validateSchedule([{ teamId: "A", fromHole: 0, toHole: 9 }], 18)).not.toBeNull();
    expect(validateSchedule([{ teamId: "A", fromHole: 10, toHole: 19 }], 18)).not.toBeNull();
    expect(validateSchedule([{ teamId: "B", fromHole: 10, toHole: 18 }, { teamId: "A", fromHole: 1, toHole: 9 }], 18)).toBeNull();
  });
});

describe("G — groups (วง) golden", () => {
  const p1 = pl("p1"), p2 = pl("p2"), p3 = pl("p3");

  it("G1 match 3 players, bonus off", () => {
    const res = computeGroupMatch([p1, p2, p3], [P4], { p1: [3], p2: [4], p3: [5] }, OFF);
    expect(res.totals).toEqual({ p1: 2, p2: 0, p3: -2 });
  });

  it("G2 match + bonus", () => {
    const res = computeGroupMatch([p1, p2, p3], [P4], { p1: [3], p2: [4], p3: [5] }, { bonus: true, turbo: false });
    expect(res.totals).toEqual({ p1: 4, p2: -1, p3: -3 });
    expect(sum(res.totals)).toBe(0);
  });

  it("G3 group handicap override (net = gross + ต่อ)", () => {
    const res = computeGroupMatch([pl("p1", { 4: 1 }), p2], [P4], { p1: [4], p2: [4] }, OFF);
    expect(res.totals).toEqual({ p1: -1, p2: 1 });
  });

  it("G4 high-low = 07 §7.1", () => {
    const ps = ["P1", "P2", "P3", "P4", "P5"].map((id) => pl(id));
    const res = computeHighLow(ps, [P4], { P1: [3], P2: [4], P3: [4], P4: [5], P5: [5] }, OFF);
    expect(res.totals).toEqual({ P1: 2, P2: 0, P3: 0, P4: -1, P5: -1 });
  });

  it("G4b high-low ties: heads tie / tails tie / all tie", () => {
    expect(computeHighLow([p1, p2, p3], [P4], { p1: [3], p2: [3], p3: [5] }, OFF).totals).toEqual({ p1: 1, p2: 1, p3: -2 });
    expect(computeHighLow([p1, p2, p3], [P4], { p1: [3], p2: [5], p3: [5] }, OFF).totals).toEqual({ p1: 2, p2: -1, p3: -1 });
    expect(computeHighLow([p1, p2, p3], [P4], { p1: [4], p2: [4], p3: [4] }, OFF).totals).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it("G5 player in two groups → per-game zero-sum, totals add up", () => {
    const sc: Scores = { p1: [3], p2: [4], p3: [5] };
    const x = computeGroupMatch([p1, p2], [P4], sc, OFF);
    const y = computeHighLow([p1, p3], [P4], sc, OFF);
    expect(sum(x.totals)).toBe(0);
    expect(sum(y.totals)).toBe(0);
    expect(x.totals.p1! + y.totals.p1!).toBe(2);
  });

  it("G6 tie / missing score → no transfer, others unaffected", () => {
    const res = computeGroupMatch([p1, p2, p3], [P4], { p1: [4], p2: [4], p3: [null] }, OFF);
    expect(res.totals).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(res.holeLog[0]!.transfers).toEqual([]);
  });

  it("G7 turbo per game", () => {
    const hole: Hole = { par: 4, turbo: true };
    const sc: Scores = { p1: [4], p2: [5] };
    expect(computeGroupMatch([p1, p2], [hole], sc, { bonus: false, turbo: true }).totals).toEqual({ p1: 2, p2: -2 });
    expect(computeHighLow([p1, p2], [hole], sc, OFF).totals).toEqual({ p1: 1, p2: -1 });
  });

  it("invariants over a multi-hole round", () => {
    const ps = [p1, p2, p3, pl("p4", { 3: 0.5, 4: 1, 5: 2 })];
    const holes: Hole[] = [P4, { par: 3, turbo: true }, { par: 5, turbo: false }, P4];
    const sc: Scores = { p1: [3, 3, 6, null], p2: [4, 2, 5, 4], p3: [5, 4, 4, 4], p4: [4, 3, 7, 6] };
    for (const res of [
      computeGroupMatch(ps, holes, sc, { bonus: true, turbo: true }),
      computeHighLow(ps, holes, sc, { bonus: true, turbo: true }),
    ]) {
      expect(sum(res.totals)).toBe(0);
      for (const p of ps) {
        let recv = 0, paid = 0;
        for (const o of ps) {
          if (o.id === p.id) continue;
          recv += res.matrix[o.id]?.[p.id] ?? 0;
          paid += res.matrix[p.id]?.[o.id] ?? 0;
        }
        expect(res.totals[p.id]).toBe(recv - paid);
      }
    }
  });
});
