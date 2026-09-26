export interface LevelConfig {
  id: string;
  name: string;
  /** Hitting this triggers the celebration; it is not the final grading number. */
  objective: { type: "score"; targetScore: number };
  moveLimit: number;
  /** 1/2/3 stars, evaluated against the score AFTER the celebration's bonus phase. */
  starThresholds: [number, number, number];
}

/**
 * Tuned against simulated play (see game/core/__tests__/balance.test.ts): base play scores
 * roughly 55-80 points per move, so a 3000-point objective in 20 moves is out of reach.
 * With these numbers a greedy bot wins ~88% of games and lands on 1/2/3 stars about
 * 41%/34%/12% of the time, while a purely random bot still occasionally earns stars.
 * The 2nd and 3rd stars need the bonus-detonation phase (leftover moves) to add score.
 */
export const DEMO_LEVEL: LevelConfig = {
  id: "demo-1",
  name: "Demo Level",
  objective: { type: "score", targetScore: 1200 },
  moveLimit: 20,
  starThresholds: [1200, 2000, 3000],
};

export const LEVELS: readonly LevelConfig[] = [DEMO_LEVEL];

export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === id);
}

/** Number of stars (0-3) a score earns against a level's thresholds. */
export function computeStars(score: number, thresholds: readonly number[]): number {
  return thresholds.filter((threshold) => score >= threshold).length;
}
