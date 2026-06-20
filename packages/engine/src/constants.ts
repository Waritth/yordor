// Scoring constants — see docs/02_SCORING_LOGIC_SPEC.md §0

export const PARS = [3, 4, 5] as const;

export const BONUS_BIRDIE = 2; // gross = par - 1
export const BONUS_EAGLE = 3; // gross = par - 2
export const BONUS_ALBATROSS = 5; // gross <= par - 3 (capped)
export const TURBO_MULT = 2;
