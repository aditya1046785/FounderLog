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
};

async function loadSnapshot() {
  const [problems, ideas, todayProblemsCount, todayIdeasCount, streakInfo, totalScoreRaw, todayLog] =
    await Promise.all([
      getAllProblems(),
      getAllIdeas(),
      getTodayProblemsCount(),
      getTodayIdeasCount(),
      getStreakInfo(),
      getAppStateValue('total_score'),
      getOrCreateTodayLog(),
    ]);

  return {
    problems,
    ideas,
    todayProblemsCount,
    todayIdeasCount,
    currentStreak: streakInfo.currentStreak,
    bestStreak: streakInfo.bestStreak,
    totalScore: Number.parseInt(totalScoreRaw || '0', 10) || 0,
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
      await createProblem(problem);
      await get().refreshAll();
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
      await createIdea(idea, linkedProblemIds);
      await get().refreshAll();
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
}));
