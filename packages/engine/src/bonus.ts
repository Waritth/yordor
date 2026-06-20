import { BONUS_ALBATROSS, BONUS_EAGLE, BONUS_BIRDIE } from "./constants";
import type { Par } from "./types";

/**
 * Bonus multiplier from the WINNER's gross vs par (spec §2).
 * Albatross+ (diff ≥ 3) is capped at ×5.
 */
export function bonusMult(gross: number | null, par: Par): number {
  if (gross == null) return 1;
  const diff = par - gross;
  if (diff >= 3) return BONUS_ALBATROSS;
  if (diff === 2) return BONUS_EAGLE;
  if (diff === 1) return BONUS_BIRDIE;
  return 1;
}

export function bonusLabel(gross: number | null, par: Par): string | null {
  if (gross == null) return null;
  const diff = par - gross;
  if (diff >= 3) return "Albatross";
  if (diff === 2) return "Eagle";
  if (diff === 1) return "Birdie";
  return null;
}
