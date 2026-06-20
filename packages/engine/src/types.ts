// Core data types — see docs/02_SCORING_LOGIC_SPEC.md §0

export type Par = 3 | 4 | 5;

/** handicap (แต้มต่อ) per par */
export type Handicap = Record<Par, number>;

export interface Player {
  id: string;
  name?: string;
  handicap: Handicap;
}

export interface Hole {
  /** 3 | 4 | 5 */
  par: Par;
  turbo: boolean;
  index?: number;
}

export interface Team {
  id: string;
  name?: string;
  players: Player[];
}

/**
 * scores[playerId][holeIndex] = strokes (gross) | null.
 * Missing player or missing cell ⇒ treated as null (⊘ — not yet entered).
 */
export type Scores = Record<string, ReadonlyArray<number | null> | undefined>;

/** One ranked entry within a team for a hole (net computed, non-null). */
export interface RankEntry {
  player: Player;
  net: number;
  gross: number;
}

/** totals[id] = ยอดสุทธิ (+ รับ / − จ่าย) ; matrix[from][to] = point ที่ from จ่าย to */
export interface ComputeResult {
  totals: Record<string, number>;
  matrix: Record<string, Record<string, number>>;
  holeLog: HoleLog[];
}

export interface GameLog {
  /** 0 = Best1, 1 = Best2 */
  rank: number;
  teamA: string;
  teamB: string;
  /** winning team id, or null if tie / skipped */
  winner: string | null;
  netA: number | null;
  netB: number | null;
  /** the ranked player's name on each side (for breakdown display) */
  nameA: string | null;
  nameB: string | null;
  grossA: number | null;
  grossB: number | null;
  pts: number;
  /** bonus label (Birdie/Eagle/Albatross) + its multiplier */
  bonus: string | null;
  bonusMult: number;
  turbo: boolean;
}

export interface HoleLog {
  holeIndex: number;
  par: Par;
  turbo: boolean;
  games: GameLog[];
}
