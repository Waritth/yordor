// ตารางวิ่ง (runner schedule) helpers — docs/RUNNER_GROUPS_SPEC.md §2.

export interface RunnerSegment {
  teamId: string;
  /** 1-based, inclusive */
  fromHole: number;
  toHole: number;
}

/**
 * Split holes evenly across teams in order; earlier chunks take the remainder.
 * The k-th runner starts rotating from team k so runners don't stack on one team.
 */
export function defaultRunnerSchedule(
  teamIds: string[],
  holeCount: number,
  runnerIndex = 0,
): RunnerSegment[] {
  const n = teamIds.length;
  if (n === 0 || holeCount <= 0) return [];
  const base = Math.floor(holeCount / n);
  const extra = holeCount % n;
  const segments: RunnerSegment[] = [];
  let from = 1;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    if (size === 0) continue;
    segments.push({
      teamId: teamIds[(i + runnerIndex) % n]!,
      fromHole: from,
      toHole: from + size - 1,
    });
    from += size;
  }
  return segments;
}

/** Returns an error message, or null when the schedule is valid. */
export function validateSchedule(
  segments: RunnerSegment[],
  holeCount: number,
): string | null {
  for (const s of segments) {
    if (!Number.isInteger(s.fromHole) || !Number.isInteger(s.toHole))
      return "หลุมต้องเป็นจำนวนเต็ม";
    if (s.fromHole < 1 || s.toHole > holeCount)
      return `ช่วงหลุมต้องอยู่ใน 1–${holeCount}`;
    if (s.fromHole > s.toHole) return "หลุมเริ่มต้องไม่เกินหลุมจบ";
  }
  const sorted = [...segments].sort((a, b) => a.fromHole - b.fromHole);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.fromHole <= sorted[i - 1]!.toHole)
      return "ช่วงหลุมของตัววิ่งซ้อนกัน";
  }
  return null;
}
