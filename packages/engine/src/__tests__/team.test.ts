import { describe, expect, it } from "vitest";

import { compareNet, computeTeam, teamRanked } from "../index";
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
