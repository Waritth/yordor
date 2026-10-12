import { describe, expect, it } from "vitest";

import { compareNet, computeTeam, pairKey, teamRanked } from "../index";
import type { Hole, Scores, Team } from "../index";
import { m, pl, sum } from "./helpers";

const som = pl("som");
const lek = pl("lek");
const joe = pl("joe");
const kan = pl("kan");

const AB = (aPlayers = [som, lek], bPlayers = [joe, kan]): Team[] => [
  { id: "A", players: aPlayers },
  { id: "B", players: bPlayers },
];

describe("teamRanked / compareNet", () => {
  it("compareNet: +1 / -1 / 0 / null", () => {
    expect(compareNet(3, 4)).toBe(1);
    expect(compareNet(4, 3)).toBe(-1);
    expect(compareNet(3, 3)).toBe(0);
    expect(compareNet(null, 3)).toBeNull();
    expect(compareNet(3, null)).toBeNull();
  });

  it("sorts by net ascending, excludes null", () => {
    const team: Team = { id: "A", players: [lek, som] }; // lek listed first
    const ranked = teamRanked(team, 4, { som: [3], lek: [5] }, 0);
    expect(ranked.map((e) => e.player.id)).toEqual(["som", "lek"]);
  });

  it("stable tie-break keeps input order", () => {
    const team: Team = { id: "A", players: [joe, som] };
    const ranked = teamRanked(team, 4, { joe: [4], som: [4] }, 0);
    expect(ranked.map((e) => e.player.id)).toEqual(["joe", "som"]);
  });
});

describe("§4 Team mode (golden)", () => {
  it("4.1 basic birdie (par4, turbo off)", () => {
    const holes: Hole[] = [{ par: 4, turbo: false }];
    const scores: Scores = { som: [3], lek: [5], joe: [4], kan: [5] };
    const r = computeTeam(AB(), holes, scores);
    expect(r.totals).toEqual({ A: 2, B: -2 });
    expect(m(r, "B", "A")).toBe(2);
    expect(sum(r.totals)).toBe(0);
  });

  it("4.2 birdie × turbo stacked (par4, turbo on)", () => {
    const holes: Hole[] = [{ par: 4, turbo: true }];
    const scores: Scores = { som: [3], lek: [5], joe: [4], kan: [6] };
    const r = computeTeam(AB(), holes, scores);
    expect(r.totals).toEqual({ A: 6, B: -6 });
    expect(m(r, "B", "A")).toBe(6);
    expect(sum(r.totals)).toBe(0);
  });

  it("4.3 single-player team skips Best2", () => {
    const holes: Hole[] = [{ par: 4, turbo: false }];
    const scores: Scores = { som: [3], joe: [4], kan: [5] };
    const r = computeTeam(AB([som]), holes, scores);
    expect(r.totals).toEqual({ A: 2, B: -2 });
    expect(m(r, "B", "A")).toBe(2);
  });

  it("4.4 missing score not counted, others unaffected", () => {
    const holes: Hole[] = [{ par: 4, turbo: false }];
    const scores: Scores = { som: [3], lek: [5], joe: [4], kan: [null] };
    const r = computeTeam(AB(), holes, scores);
    expect(r.totals).toEqual({ A: 2, B: -2 });
    expect(sum(r.totals)).toBe(0);
  });
});

describe("Best N (1 / 1-2 / 1-2-3)", () => {
  const P4: Hole[] = [{ par: 4, turbo: false }];
  const six: Scores = { a1: [3], a2: [4], a3: [5], b1: [4], b2: [4], b3: [6] };
  const t33: Team[] = [
    { id: "A", players: [pl("a1"), pl("a2"), pl("a3")] },
    { id: "B", players: [pl("b1"), pl("b2"), pl("b3")] },
  ];

  it("bestN=1 → only Best1 counts (07 §4.1 → A +2)", () => {
    const r = computeTeam(AB(), P4, { som: [3], lek: [5], joe: [4], kan: [6] }, { bestN: 1 });
    expect(r.totals).toEqual({ A: 2, B: -2 });
  });

  it("default = Best 1-2 (unchanged)", () => {
    const r = computeTeam(AB(), P4, { som: [3], lek: [5], joe: [4], kan: [6] });
    expect(r.totals).toEqual({ A: 3, B: -3 });
  });

  it("bestN=3, 3 v 3: Best1 birdie 2 + Best2 tie + Best3 1 → A +3", () => {
    const r = computeTeam(t33, P4, six, { bestN: 3 });
    expect(r.totals).toEqual({ A: 3, B: -3 });
    expect(r.holeLog[0]!.games.map((g) => g.rank)).toEqual([0, 1, 2]);
  });

  it("bestN=3, 3 v 4: ranks by net, 4th player just widens the pool", () => {
    const t34: Team[] = [t33[0]!, { id: "B", players: [...t33[1]!.players, pl("b4")] }];
    // b4=3 → B ranked [3,4,4,6]: Best1 3v3 tie, Best2 4v4 tie, Best3 5v4 → B +1
    const r = computeTeam(t34, P4, { ...six, b4: [3] }, { bestN: 3 });
    expect(r.totals).toEqual({ A: -1, B: 1 });
  });

  it("bestN=3 but a team has 2 players → Best3 skipped", () => {
    const r = computeTeam(AB(), P4, { som: [3], lek: [5], joe: [4], kan: [6] }, { bestN: 3 });
    expect(r.totals).toEqual({ A: 3, B: -3 });
  });
});

describe("noHcpPairs — คู่ทีมที่ไม่ต่อกัน (เทียบ gross)", () => {
  const P4: Hole[] = [{ par: 4, turbo: false }];
  // T1 {a1 ต่อ 0.5, b1 0} · T2 {0,0} · T3 {a3 ต่อ 0.5, b3 0}
  const t3: Team[] = [
    { id: "T1", players: [pl("a1", { 4: 0.5 }), pl("b1")] },
    { id: "T2", players: [pl("a2"), pl("b2")] },
    { id: "T3", players: [pl("a3", { 4: 0.5 }), pl("b3")] },
  ];
  const sc: Scores = { a1: [4], b1: [5], a2: [4], b2: [5], a3: [4], b3: [4] };

  it("handicap on every pair (default)", () => {
    // 1v2: 4.5v4 T2+1, 5v5 tie · 2v3: 4v4 tie, 5v4.5 T3+1 · 1v3: 4.5v4 T3+1, 5v4.5 T3+1
    const r = computeTeam(t3, P4, sc);
    expect(r.totals).toEqual({ T1: -3, T2: 0, T3: 3 });
  });

  it("T1–T3 ไม่ต่อ → that pair compares gross; other pairs keep handicap", () => {
    // 1v3 gross: T1 [4,5] v T3 [4,4] → B1 tie, B2 5v4 T3+1
    const r = computeTeam(t3, P4, sc, { noHcpPairs: [pairKey("T3", "T1")] });
    expect(r.totals).toEqual({ T1: -2, T2: 0, T3: 2 });
    expect(m(r, "T1", "T3")).toBe(1);
    expect(m(r, "T1", "T2")).toBe(1);
    const g13 = r.holeLog[0]!.games.filter((g) => [g.teamA, g.teamB].sort().join() === "T1,T3");
    expect(g13.every((g) => !g.hcp)).toBe(true);
    expect(g13[0]!.netA).toBe(4); // a1 gross, not 4.5
  });

  it("ranking inside the team follows gross for a no-handicap pair", () => {
    // T1: a1 ต่อ 2 (g3 → net 5), b1 g4 → with hcp Best1=b1; gross Best1=a1 (Birdie)
    const t: Team[] = [
      { id: "T1", players: [pl("a1", { 4: 2 }), pl("b1")] },
      { id: "T2", players: [pl("a2"), pl("b2")] },
    ];
    const s2: Scores = { a1: [3], b1: [4], a2: [4], b2: [5] };
    const withHcp = computeTeam(t, P4, s2);
    const gross = computeTeam(t, P4, s2, { noHcpPairs: [pairKey("T1", "T2")] });
    // hcp: T1 [b1 4, a1 5] v T2 [4,5] → tie, tie → 0
    expect(withHcp.totals).toEqual({ T1: 0, T2: 0 });
    // gross: T1 [a1 3, b1 4] v T2 [4,5] → B1 Birdie ×2, B2 1 → T1 +3
    expect(gross.totals).toEqual({ T1: 3, T2: -3 });
  });

  it("gross tie in a ไม่ต่อ pair → same Best1/Best2 person as the handicap pairs", () => {
    // mu ต่อ 0.5 (g5 → net 5.5), ja ต่อ 0 (g5 → net 5). net: ja is Best1.
    // gross tie 5/5 → tie-break by net → ja stays Best1 (not mu by input order).
    const team: Team = { id: "T2", players: [pl("mu", { 4: 0.5 }), pl("ja")] };
    const s2: Scores = { mu: [5], ja: [5] };
    const ids = (useHcp: boolean) =>
      teamRanked(team, 4, s2, 0, useHcp).map((e) => e.player.id);
    expect(ids(true)).toEqual(["ja", "mu"]);
    expect(ids(false)).toEqual(["ja", "mu"]);
  });

  it("pairKey is order-independent", () => {
    expect(pairKey("A", "C")).toBe(pairKey("C", "A"));
  });
});
