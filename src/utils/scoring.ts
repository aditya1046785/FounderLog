const DAILY_TARGET = 10;

export type DailyScoreInput = {
  problemCount: number;
  linkedIdeasCount: number;
  streakDays: number;
};

export type DailyScoreResult = {
  score: number;
  completionRatio: number;
  reachedTarget: boolean;
};

export function calculateDailyScore(input: DailyScoreInput): DailyScoreResult {
  const completionRatio = Math.min(input.problemCount / DAILY_TARGET, 1);
  const problemScore = Math.round(completionRatio * 70);
  const linkingScore = Math.min(input.linkedIdeasCount * 5, 20);
  const streakBonus = Math.min(input.streakDays * 2, 10);

  return {
    score: problemScore + linkingScore + streakBonus,
    completionRatio,
    reachedTarget: input.problemCount >= DAILY_TARGET,
  };
}

export function progressToTarget(problemCount: number): number {
  return Math.min(problemCount / DAILY_TARGET, 1);
}
