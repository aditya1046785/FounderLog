import { getAppStateValue, setAppStateValue } from '../database/database';

const BASE_POINTS_PROBLEM = 5;
const BASE_POINTS_IDEA = 10;
const DAILY_TARGET = 10;
const DAILY_TARGET_BONUS = 20;
const FIRST_PROBLEM_BONUS = 25;
const FIRST_IDEA_BONUS = 25;

const PROBLEM_MILESTONES: Record<number, number> = {
  50: 50,
  100: 100,
  500: 250,
};

const STREAK_MILESTONES: Record<number, number> = {
  7: 50,
  14: 100,
  30: 200,
  60: 350,
  100: 500,
  365: 1000,
};

const SCORE_TOTAL_KEY = 'total_score';
const SCORE_FROM_PROBLEMS_KEY = 'score_from_problems';
const SCORE_FROM_IDEAS_KEY = 'score_from_ideas';
const SCORE_FROM_BONUSES_KEY = 'score_from_bonuses';

export type ScoreBreakdown = {
  fromProblems: number;
  fromIdeas: number;
  fromBonuses: number;
};

export function calculatePointsForProblem(): number {
  return BASE_POINTS_PROBLEM;
}

export function calculatePointsForIdea(): number {
  return BASE_POINTS_IDEA;
}

export function getFirstProblemBonus(isFirstProblemEver: boolean): number {
  return isFirstProblemEver ? FIRST_PROBLEM_BONUS : 0;
}

export function getFirstIdeaBonus(isFirstIdeaEver: boolean): number {
  return isFirstIdeaEver ? FIRST_IDEA_BONUS : 0;
}

export function calculateDailyBonus(todayCount: number): number {
  return todayCount === DAILY_TARGET ? DAILY_TARGET_BONUS : 0;
}

export function checkStreakMilestone(streak: number): number {
  return STREAK_MILESTONES[streak] ?? 0;
}

export function checkProblemMilestone(totalCount: number): number {
  return PROBLEM_MILESTONES[totalCount] ?? 0;
}

export async function addScore(points: number, scoreBreakdown?: Partial<ScoreBreakdown>): Promise<number> {
  const safePoints = Math.max(0, Math.floor(points));
  if (safePoints <= 0) {
    return getTotalScore();
  }

  const [totalRaw, fromProblemsRaw, fromIdeasRaw, fromBonusesRaw] = await Promise.all([
    getAppStateValue(SCORE_TOTAL_KEY),
    getAppStateValue(SCORE_FROM_PROBLEMS_KEY),
    getAppStateValue(SCORE_FROM_IDEAS_KEY),
    getAppStateValue(SCORE_FROM_BONUSES_KEY),
  ]);

  const total = Number.parseInt(totalRaw || '0', 10) || 0;
  const fromProblems = Number.parseInt(fromProblemsRaw || '0', 10) || 0;
  const fromIdeas = Number.parseInt(fromIdeasRaw || '0', 10) || 0;
  const fromBonuses = Number.parseInt(fromBonusesRaw || '0', 10) || 0;

  const nextTotal = total + safePoints;
  const nextFromProblems = fromProblems + Math.max(0, Math.floor(scoreBreakdown?.fromProblems ?? 0));
  const nextFromIdeas = fromIdeas + Math.max(0, Math.floor(scoreBreakdown?.fromIdeas ?? 0));
  const nextFromBonuses = fromBonuses + Math.max(0, Math.floor(scoreBreakdown?.fromBonuses ?? 0));

  await Promise.all([
    setAppStateValue(SCORE_TOTAL_KEY, String(nextTotal)),
    setAppStateValue(SCORE_FROM_PROBLEMS_KEY, String(nextFromProblems)),
    setAppStateValue(SCORE_FROM_IDEAS_KEY, String(nextFromIdeas)),
    setAppStateValue(SCORE_FROM_BONUSES_KEY, String(nextFromBonuses)),
  ]);

  return nextTotal;
}

export async function getTotalScore(): Promise<number> {
  const totalRaw = await getAppStateValue(SCORE_TOTAL_KEY);
  return Number.parseInt(totalRaw || '0', 10) || 0;
}

export async function getScoreBreakdown(): Promise<ScoreBreakdown> {
  const [fromProblemsRaw, fromIdeasRaw, fromBonusesRaw] = await Promise.all([
    getAppStateValue(SCORE_FROM_PROBLEMS_KEY),
    getAppStateValue(SCORE_FROM_IDEAS_KEY),
    getAppStateValue(SCORE_FROM_BONUSES_KEY),
  ]);

  return {
    fromProblems: Number.parseInt(fromProblemsRaw || '0', 10) || 0,
    fromIdeas: Number.parseInt(fromIdeasRaw || '0', 10) || 0,
    fromBonuses: Number.parseInt(fromBonusesRaw || '0', 10) || 0,
  };
}

export function progressToTarget(problemCount: number): number {
  return Math.min(problemCount / DAILY_TARGET, 1);
}
