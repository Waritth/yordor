import { describe, expect, it } from "vitest";

import { computeTeam } from "../index";
import type { Hole, Par, Scores, Team } from "../index";
import { m, sum } from "./helpers";

// Deterministic PRNG (mulberry32) → reproducible property tests.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARS: Par[] = [3, 4, 5];
const HCP = [0, 0.5, 1, 2];
const pick = <T>(arr: T[], rand: () => number, fallback: T): T =>
  arr[Math.floor(rand() * arr.length)] ?? fallback;

function randomRound(rand: () => number): {
  teams: Team[];
  holes: Hole[];
  scores: Scores;
} {
  const nTeams = 2 + Math.floor(rand() * 3); // 2..4
  const nHoles = 1 + Math.floor(rand() * 9); // 1..9
  const holes: Hole[] = Array.from({ length: nHoles }, () => ({
    par: pick(PARS, rand, 4),
    turbo: rand() < 0.3,
  }));

  const teams: Team[] = [];
  const scores: Scores = {};
  let pid = 0;
  for (let t = 0; t < nTeams; t++) {
    const nPlayers = 1 + Math.floor(rand() * 3); // 1..3
    const players = [];
    for (let p = 0; p < nPlayers; p++) {
      const id = `p${pid++}`;
      players.push({
        id,
        handicap: {
          3: pick(HCP, rand, 0),
          4: pick(HCP, rand, 0),
          5: pick(HCP, rand, 0),
        },
      });
      scores[id] = holes.map(() =>
        rand() < 0.15 ? null : 2 + Math.floor(rand() * 6),
      );
    }
    teams.push({ id: `T${t}`, players });
  }
  return { teams, holes, scores };
}

describe("§9 invariants (50 random rounds)", () => {
  for (let seed = 1; seed <= 50; seed++) {
    it(`seed ${seed}`, () => {
      const rand = rng(seed);
      const { teams, holes, scores } = randomRound(rand);
      const r = computeTeam(teams, holes, scores);

      // 1. zero-sum
      expect(sum(r.totals)).toBe(0);

      // 2. matrix ↔ totals  (totals = Σ received − Σ paid)
      for (const t of teams) {
        let recv = 0;
        let pay = 0;
        for (const o of teams) {
          if (o.id === t.id) continue;
          recv += m(r, o.id, t.id); // o pays t
          pay += m(r, t.id, o.id); // t pays o
        }
        expect(r.totals[t.id]).toBe(recv - pay);
      }

      // 5. non-negative point flows
      for (const from of teams) {
        for (const to of teams) {
          if (from.id !== to.id) expect(m(r, from.id, to.id)).toBeGreaterThanOrEqual(0);
        }
      }

      // 3. determinism
      const r2 = computeTeam(teams, holes, scores);
      expect(r2.totals).toEqual(r.totals);
      expect(r2.matrix).toEqual(r.matrix);
    });
  }
});

describe("§9 targeted invariants", () => {
  it("4. null safety: nulling team C does not change A↔B flows", () => {
    const teams: Team[] = [
      { id: "A", players: [{ id: "a", handicap: { 3: 0, 4: 0, 5: 0 } }] },
      { id: "B", players: [{ id: "b", handicap: { 3: 0, 4: 0, 5: 0 } }] },
      { id: "C", players: [{ id: "c", handicap: { 3: 0, 4: 0, 5: 0 } }] },
    ];
    const holes: Hole[] = [
      { par: 4, turbo: false },
      { par: 4, turbo: false },
    ];
    const full: Scores = { a: [3, 4], b: [4, 3], c: [5, 5] };
    const nulled: Scores = { a: [3, 4], b: [4, 3], c: [null, null] };
    const r1 = computeTeam(teams, holes, full);
    const r2 = computeTeam(teams, holes, nulled);
    expect(m(r2, "A", "B")).toBe(m(r1, "A", "B"));
    expect(m(r2, "B", "A")).toBe(m(r1, "B", "A"));
  });

  it("6. tie → no transfer", () => {
    const teams: Team[] = [
      { id: "A", players: [{ id: "a", handicap: { 3: 0, 4: 0, 5: 0 } }] },
      { id: "B", players: [{ id: "b", handicap: { 3: 0, 4: 0, 5: 0 } }] },
    ];
    const r = computeTeam(teams, [{ par: 4, turbo: false }], { a: [4], b: [4] });
    expect(r.totals).toEqual({ A: 0, B: 0 });
    expect(m(r, "A", "B")).toBe(0);
    expect(m(r, "B", "A")).toBe(0);
  });
});
