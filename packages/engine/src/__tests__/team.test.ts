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

describe("offPairs — คู่ทีมที่ไม่เล่นกัน", () => {
  const P4: Hole[] = [{ par: 4, turbo: false }];
  // A {3,5}  B {4,5}  C {4,6}
  const sc: Scores = { a1: [3], a2: [5], b1: [4], b2: [5], c1: [4], c2: [6] };
  const t3: Team[] = [
    { id: "A", players: [pl("a1"), pl("a2")] },
    { id: "B", players: [pl("b1"), pl("b2")] },
    { id: "C", players: [pl("c1"), pl("c2")] },
  ];

  it("all pairs (round-robin) by default", () => {
    // A–B: B1 birdie 2, B2 tie → A+2 · A–C: 2 + 1 → A+3 · B–C: tie, 5v6 → B+1
    const r = computeTeam(t3, P4, sc);
    expect(r.totals).toEqual({ A: 5, B: -1, C: -4 });
  });

  it("A–C off → only A–B and B–C count", () => {
    const r = computeTeam(t3, P4, sc, { offPairs: [pairKey("C", "A")] });
    expect(r.totals).toEqual({ A: 2, B: -1, C: -1 });
    expect(m(r, "C", "A")).toBe(0);
    expect(r.holeLog[0]!.games.some((g) => [g.teamA, g.teamB].sort().join() === "A,C")).toBe(false);
    expect(sum(r.totals)).toBe(0);
  });

  it("pairKey is order-independent", () => {
    expect(pairKey("A", "C")).toBe(pairKey("C", "A"));
  });
});

