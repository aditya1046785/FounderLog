import { generateUniqueId, getDatabase, nowIso } from './database';
import { Idea } from './ideaService';
import { Problem } from './problemService';

type ProblemRow = {
  id: string;
  title: string;
  description: string | null;
  context: string | null;
  who_faces: string | null;
  frequency: 'rare' | 'sometimes' | 'often' | 'daily' | null;
  domain: string | null;
  custom_tags: string | null;
  status: 'open' | 'exploring' | 'solved';
  is_quick_capture: number;
  created_at: string;
  updated_at: string;
};

type IdeaRow = {
  id: string;
  title: string;
  description: string | null;
  business_model: string | null;
  feasibility: number;
  excitement: number;
  status: 'just_idea' | 'researching' | 'validating' | 'building' | 'dropped';
  created_at: string;
  updated_at: string;
};

function safeParseStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch (error) {
    console.error('Failed to parse JSON array field in link service:', error);
    return [];
  }
}

function mapProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    context: row.context,
    who_faces: safeParseStringArray(row.who_faces),
    frequency: row.frequency,
    domain: row.domain,
    custom_tags: safeParseStringArray(row.custom_tags),
    status: row.status,
    is_quick_capture: row.is_quick_capture === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    business_model: row.business_model,
    feasibility: row.feasibility,
    excitement: row.excitement,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    linked_problems_count: 0,
  };
}

export async function linkIdeaToProblem(ideaId: string, problemId: string): Promise<void> {
  try {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM problem_idea_links WHERE idea_id = ? AND problem_id = ?',
      [ideaId, problemId]
    );

    if (existing) {
      return;
    }

    await db.runAsync(
      `INSERT INTO problem_idea_links (id, problem_id, idea_id, created_at)
       VALUES (?, ?, ?, ?)`,
      [generateUniqueId(), problemId, ideaId, nowIso()]
    );
  } catch (error) {
    console.error('Failed to link idea to problem:', error);
    throw error;
  }
}

export async function unlinkIdeaFromProblem(ideaId: string, problemId: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM problem_idea_links WHERE idea_id = ? AND problem_id = ?', [ideaId, problemId]);
  } catch (error) {
    console.error('Failed to unlink idea from problem:', error);
    throw error;
  }
}

export async function getLinkedProblems(ideaId: string): Promise<Problem[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ProblemRow>(
      `SELECT p.*
       FROM problems p
       INNER JOIN problem_idea_links l ON p.id = l.problem_id
       WHERE l.idea_id = ?
       ORDER BY l.created_at DESC`,
      [ideaId]
    );

    return rows.map(mapProblem);
  } catch (error) {
    console.error('Failed to get linked problems:', error);
    throw error;
  }
}

export async function getLinkedIdeas(problemId: string): Promise<Idea[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<IdeaRow>(
      `SELECT i.*
       FROM ideas i
       INNER JOIN problem_idea_links l ON i.id = l.idea_id
       WHERE l.problem_id = ?
       ORDER BY l.created_at DESC`,
      [problemId]
    );

    return rows.map(mapIdea);
  } catch (error) {
    console.error('Failed to get linked ideas:', error);
    throw error;
  }
}
