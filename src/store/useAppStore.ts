import { create } from 'zustand';

import {
  getAppStateValue,
  getOrCreateTodayLog,
  getStreakInfo,
  initializeDatabase,
} from '../database/database';
import {
  createIdea,
  CreateIdeaInput,
  getAllIdeas,
  getTodayIdeasCount,
  IdeaStatus,
  updateIdea,
  deleteIdea,
} from '../database/ideaService';
import {
  createProblem,
  CreateProblemInput,
  deleteProblem,
  getAllProblems,
  getTodayProblemsCount,
  ProblemStatus,
  updateProblem,
  updateProblemStatus,
} from '../database/problemService';
import { CelebrationItem } from '../components/common/CelebrationModal';
import { onProblemSaved } from '../utils/notifications';
import {
  addScore,
  calculateDailyBonus,
  calculatePointsForIdea,
  calculatePointsForProblem,
  checkProblemMilestone,
  checkStreakMilestone,
  getScoreBreakdown,
  getFirstIdeaBonus,
  getFirstProblemBonus,
} from '../utils/scoring';

export interface Problem {
  id: string;
  title: string;
  description: string | null;
  context: string | null;
  who_faces: string[];
  frequency: 'rare' | 'sometimes' | 'often' | 'daily' | null;
  domain: string | null;
  custom_tags: string[];
  status: ProblemStatus;
  is_quick_capture: boolean;
  created_at: string;
  updated_at: string;
  linked_ideas_count?: number;
}

export interface Idea {
  id: string;
  title: string;
  description: string | null;
  business_model: string | null;
  feasibility: number;
  excitement: number;
  status: IdeaStatus;
  created_at: string;
  updated_at: string;
  linked_problems_count?: number;
}

export interface ProblemIdeaLink {
  id: string;
  problem_id: string;
  idea_id: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  date: string;
  problems_count: number;
  ideas_count: number;
  target_completed: number;
  score_earned: number;
}

type AppState = {
  problems: Problem[];
  ideas: Idea[];
  todayProblemsCount: number;
  todayIdeasCount: number;
  currentStreak: number;
  bestStreak: number;
  totalScore: number;
  scoreFromProblems: number;
  scoreFromIdeas: number;
  scoreFromBonuses: number;
  notificationPermissionStatus: string;
  remindersEnabled: boolean;
  currentCelebration: CelebrationItem | null;
  pendingCelebrations: CelebrationItem[];
  isLoading: boolean;
  todayLog: DailyLog | null;
  initialize: () => Promise<void>;
  addProblem: (problem: CreateProblemInput) => Promise<void>;
  editProblem: (id: string, updates: Partial<CreateProblemInput>) => Promise<void>;
  removeProblem: (id: string) => Promise<void>;
  changeProblemStatus: (id: string, status: ProblemStatus) => Promise<void>;
  addIdea: (idea: CreateIdeaInput, linkedProblemIds: string[]) => Promise<void>;
  editIdea: (id: string, updates: Partial<CreateIdeaInput>) => Promise<void>;
  removeIdea: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshTodayCounts: () => Promise<void>;
  enqueueCelebration: (celebration: CelebrationItem) => void;
  dismissCelebration: () => void;
};

function createCelebration(args: {
  type: CelebrationItem['type'];
  title: string;
  subtitle: string;
  points: number;
  ctaLabel?: string;
}): CelebrationItem {
  return {
    id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: args.type,
    title: args.title,
    subtitle: args.subtitle,
    points: args.points,
    ctaLabel: args.ctaLabel,
  };
}

function getStreakSubtitle(streak: number): string {
  if (streak === 7) {
    return "One week of consistent observation. You're building the muscle.";
  }
  if (streak === 14) {
    return '14 days of momentum. Consistency is compounding.';
  }
  if (streak === 30) {
    return "30 days! Most people quit at 3. You're different.";
  }
  if (streak === 60) {
    return '60 days strong. This is founder discipline in action.';
  }
  if (streak === 100) {
    return "100 DAYS. You're in the top 1% of founders. Legendary.";
  }
  if (streak === 365) {
    return 'A full year of observation. This is mastery.';
  }
  return 'Consistency compounds into startup intuition.';
}

async function loadSnapshot() {
  const [
    problems,
    ideas,
    todayProblemsCount,
    todayIdeasCount,
    streakInfo,
    totalScoreRaw,
    todayLog,
    notificationPermissionStatusRaw,
    scoreBreakdown,
  ] =
    await Promise.all([
      getAllProblems(),
      getAllIdeas(),
      getTodayProblemsCount(),
      getTodayIdeasCount(),
      getStreakInfo(),
      getAppStateValue('total_score'),
      getOrCreateTodayLog(),
      getAppStateValue('notification_permission_status'),
      getScoreBreakdown(),
    ]);

  const notificationPermissionStatus = notificationPermissionStatusRaw || 'undetermined';

  return {
    problems,
    ideas,
    todayProblemsCount,
    todayIdeasCount,
    currentStreak: streakInfo.currentStreak,
    bestStreak: streakInfo.bestStreak,
    totalScore: Number.parseInt(totalScoreRaw || '0', 10) || 0,
    scoreFromProblems: scoreBreakdown.fromProblems,
    scoreFromIdeas: scoreBreakdown.fromIdeas,
    scoreFromBonuses: scoreBreakdown.fromBonuses,
    notificationPermissionStatus,
    remindersEnabled: notificationPermissionStatus === 'granted',
    todayLog,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  problems: [],
  ideas: [],
  todayProblemsCount: 0,
  todayIdeasCount: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalScore: 0,
  scoreFromProblems: 0,
  scoreFromIdeas: 0,
  scoreFromBonuses: 0,
  notificationPermissionStatus: 'undetermined',
  remindersEnabled: false,
  currentCelebration: null,
  pendingCelebrations: [],
  isLoading: true,
  todayLog: null,

  initialize: async () => {
    set({ isLoading: true });
    try {
      await initializeDatabase();
      const snapshot = await loadSnapshot();
      set({ ...snapshot, isLoading: false });
    } catch (error) {
      console.error('Failed to initialize app store:', error);
      set({ isLoading: false });
    }
  },

  addProblem: async (problem) => {
    set({ isLoading: true });
    try {
      const prevState = get();
      const previousProblemsCount = prevState.problems.length;
      const previousTodayProblemsCount = prevState.todayProblemsCount;
      const previousStreak = prevState.currentStreak;

      await createProblem(problem);
      await onProblemSaved();

      const [todayProblemsCountAfterSave, streakInfoAfterSave] = await Promise.all([
        getTodayProblemsCount(),
        getStreakInfo(),
      ]);

      const totalProblemsAfterSave = previousProblemsCount + 1;

      const basePoints = calculatePointsForProblem();
      const firstProblemBonus = getFirstProblemBonus(previousProblemsCount === 0);
      const dailyBonus =
        previousTodayProblemsCount < 10 ? calculateDailyBonus(todayProblemsCountAfterSave) : 0;
      const problemMilestoneBonus = checkProblemMilestone(totalProblemsAfterSave);
      const streakMilestoneBonus =
        streakInfoAfterSave.currentStreak > previousStreak
          ? checkStreakMilestone(streakInfoAfterSave.currentStreak)
          : 0;

      const bonusPoints =
        firstProblemBonus + dailyBonus + problemMilestoneBonus + streakMilestoneBonus;
      const totalPoints = basePoints + bonusPoints;

      await addScore(totalPoints, {
        fromProblems: basePoints,
        fromBonuses: bonusPoints,
      });

      const celebrations: CelebrationItem[] = [];

      if (firstProblemBonus > 0) {
        celebrations.push(
          createCelebration({
            type: 'first',
            title: 'FIRST PROBLEM LOGGED!',
            subtitle: 'You just started a founder habit that compounds for years.',
            points: firstProblemBonus,
            ctaLabel: "LET'S GO",
          })
        );
      }

      if (dailyBonus > 0) {
        celebrations.push(
          createCelebration({
            type: 'daily',
            title: 'DAILY TARGET COMPLETE!',
            subtitle: "Today's mission: accomplished. ✅",
            points: dailyBonus,
          })
        );
      }

      if (problemMilestoneBonus > 0) {
        celebrations.push(
          createCelebration({
            type: 'problem',
            title: `${totalProblemsAfterSave} PROBLEMS!`,
            subtitle: `${totalProblemsAfterSave} problems observed. That's ${totalProblemsAfterSave} potential startups.`,
            points: problemMilestoneBonus,
          })
        );
      }

      if (streakMilestoneBonus > 0) {
        celebrations.push(
          createCelebration({
            type: 'streak',
            title: 'STREAK MILESTONE!',
            subtitle: getStreakSubtitle(streakInfoAfterSave.currentStreak),
            points: streakMilestoneBonus,
          })
        );
      }

      await get().refreshAll();

      for (const celebration of celebrations) {
        get().enqueueCelebration(celebration);
      }
    } catch (error) {
      console.error('Failed to add problem:', error);
      set({ isLoading: false });
    }
  },

  editProblem: async (id, updates) => {
    set({ isLoading: true });
    try {
      await updateProblem(id, updates);
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to edit problem:', error);
      set({ isLoading: false });
    }
  },

  removeProblem: async (id) => {
    set({ isLoading: true });
    try {
      await deleteProblem(id);
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to remove problem:', error);
      set({ isLoading: false });
    }
  },

  changeProblemStatus: async (id, status) => {
    set({ isLoading: true });
    try {
      await updateProblemStatus(id, status);
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to change problem status:', error);
      set({ isLoading: false });
    }
  },

  addIdea: async (idea, linkedProblemIds) => {
    set({ isLoading: true });
    try {
      const prevIdeasCount = get().ideas.length;
      await createIdea(idea, linkedProblemIds);

      const basePoints = calculatePointsForIdea();
      const firstIdeaBonus = getFirstIdeaBonus(prevIdeasCount === 0);
      const totalPoints = basePoints + firstIdeaBonus;

      await addScore(totalPoints, {
        fromIdeas: basePoints,
        fromBonuses: firstIdeaBonus,
      });

      await get().refreshAll();

      if (firstIdeaBonus > 0) {
        get().enqueueCelebration(
          createCelebration({
            type: 'first',
            title: 'FIRST IDEA CREATED!',
            subtitle: 'From observation to solution. This is founder progress.',
            points: firstIdeaBonus,
            ctaLabel: "LET'S GO",
          })
        );
      }
    } catch (error) {
      console.error('Failed to add idea:', error);
      set({ isLoading: false });
    }
  },

  editIdea: async (id, updates) => {
    set({ isLoading: true });
    try {
      await updateIdea(id, updates);
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to edit idea:', error);
      set({ isLoading: false });
    }
  },

  removeIdea: async (id) => {
    set({ isLoading: true });
    try {
      await deleteIdea(id);
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to remove idea:', error);
      set({ isLoading: false });
    }
  },

  refreshAll: async () => {
    try {
      const snapshot = await loadSnapshot();
      set({ ...snapshot, isLoading: false });
    } catch (error) {
      console.error('Failed to refresh app store:', error);
      set({ isLoading: false });
    }
  },

  refreshTodayCounts: async () => {
    try {
      const [todayProblemsCount, todayIdeasCount, todayLog] = await Promise.all([
        getTodayProblemsCount(),
        getTodayIdeasCount(),
        getOrCreateTodayLog(),
      ]);

      set({ todayProblemsCount, todayIdeasCount, todayLog });
    } catch (error) {
      console.error('Failed to refresh today counts:', error);
    }
  },

  enqueueCelebration: (celebration) => {
    set((state) => {
      if (!state.currentCelebration) {
        return {
          ...state,
          currentCelebration: celebration,
        };
      }

      return {
        ...state,
        pendingCelebrations: [...state.pendingCelebrations, celebration],
      };
    });
  },

  dismissCelebration: () => {
    const { pendingCelebrations } = get();

    if (pendingCelebrations.length === 0) {
      set({ currentCelebration: null });
      return;
    }

    set({ currentCelebration: null, pendingCelebrations: pendingCelebrations.slice(1) });

    const next = pendingCelebrations[0];
    setTimeout(() => {
      set((state) => {
        if (state.currentCelebration) {
          return state;
        }

        return {
          ...state,
          currentCelebration: next,
        };
      });
    }, 500);
  },
}));
