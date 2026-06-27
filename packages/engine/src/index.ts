// @yordor/engine — pure scoring logic (no I/O, deterministic).
// See docs/02_SCORING_LOGIC_SPEC.md.

export const ENGINE_VERSION = "0.1.0";

export * from "./constants";
export * from "./types";
export { net, scoreAt } from "./net";
export { bonusMult, bonusLabel } from "./bonus";
export { turboMult } from "./turbo";
export { teamRanked, compareNet, computeTeam } from "./team";
export {
  validHand,
  computeCard3,
  settle,
  type Card3Hand,
  type Card3HandLog,
  type Card3Result,
  type Card3Transfer,
} from "./card3";
