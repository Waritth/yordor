import { describe, expect, it } from "vitest";

import { bonusLabel, bonusMult, net, turboMult } from "../index";
import type { Par } from "../index";
import { pl } from "./helpers";

describe("§1 net = gross − handicap[par]", () => {
  it("par5 gross7 hcp2 → 5", () => expect(net(7, pl("p", { 5: 2 }), 5)).toBe(5));
  it("par4 gross4 hcp0 → 4", () => expect(net(4, pl("p"), 4)).toBe(4));
  it("par3 gross5 hcp0.5 → 4.5", () =>
    expect(net(5, pl("p", { 3: 0.5 }), 3)).toBe(4.5));
  it("null → null", () => expect(net(null, pl("p", { 4: 1 }), 4)).toBeNull());
});

describe("§2 bonusMult (from winner gross)", () => {
  it.each<[Par, number, number]>([
    [4, 4, 1],
    [4, 3, 2], // Birdie
    [4, 2, 3], // Eagle
    [5, 2, 5], // Albatross
    [3, 4, 1], // bogey
  ])("par%i gross%i → ×%i", (par, gross, mult) => {
    expect(bonusMult(gross, par)).toBe(mult);
  });
  it("null gross → 1", () => expect(bonusMult(null, 4)).toBe(1));
  it("Albatross+ capped at ×5", () => expect(bonusMult(1, 5)).toBe(5));

  it("labels", () => {
    expect(bonusLabel(3, 4)).toBe("Birdie");
    expect(bonusLabel(2, 4)).toBe("Eagle");
    expect(bonusLabel(2, 5)).toBe("Albatross");
    expect(bonusLabel(4, 4)).toBeNull();
    expect(bonusLabel(null, 4)).toBeNull();
  });
});

describe("§3 turbo", () => {
  it("off → 1", () => expect(turboMult({ turbo: false })).toBe(1));
  it("on → 2", () => expect(turboMult({ turbo: true })).toBe(2));
});
