const KEY_PREFIX = "meme-match:level-best:";

/** Best final score for a level; 0 if none is stored (or storage is unavailable). */
export function getLevelBest(levelId: string): number {
  try {
    if (typeof window === "undefined") return 0;
    const value = Number(window.localStorage.getItem(KEY_PREFIX + levelId));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function setLevelBest(levelId: string, score: number): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY_PREFIX + levelId, String(Math.round(score)));
  } catch {
    // storage full or blocked: the best score is a nicety, never fatal
  }
}
