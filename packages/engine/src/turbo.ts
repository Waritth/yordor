import { TURBO_MULT } from "./constants";
import type { Hole } from "./types";

/** Turbo modifier (spec §3): ×2 when the hole's turbo is on, else ×1. */
export function turboMult(hole: Pick<Hole, "turbo">): number {
  return hole.turbo ? TURBO_MULT : 1;
}
