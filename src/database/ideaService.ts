import { generateUniqueId, getDatabase, nowIso, updateTodayIdeasCount } from './database';
import { Problem } from './problemService';

export type IdeaStatus = 'just_idea' | 'researching' | 'validating' | 'building' | 'dropped';

export type Idea = {
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
};

export type CreateIdeaInput = {
  title: string;
  description?: string | null;
  business_model?: string | null;
  feasibility?: number;
  excitement?: number;
  status?: IdeaStatus;
};

export type UpdateIdeaInput = Partial<CreateIdeaInput>;

type IdeaRow = {
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
};

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
    console.error('Failed to parse JSON array field in ideas service:', error);
    return [];
  }
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
    linked_problems_count: row.linked_problems_count ?? 0,
  };
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

export async function createIdea(idea: CreateIdeaInput, linkedProblemIds: string[]): Promise<Idea> {
  try {
    const db = await getDatabase();
    const id = generateUniqueId();
    const timestamp = nowIso();

    await db.runAsync(
      `INSERT INTO ideas (
        id, title, description, business_model, feasibility, excitement, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        idea.title,
        idea.description ?? null,
        idea.business_model ?? null,
        idea.feasibility ?? 0,
        idea.excitement ?? 0,
        idea.status ?? 'just_idea',
        timestamp,
        timestamp,
      ]
    );

    for (const problemId of linkedProblemIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO problem_idea_links (id, problem_id, idea_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [generateUniqueId(), problemId, id, nowIso()]
      );
    }

    await updateTodayIdeasCount(1);

    const created = await getIdeaById(id);
    if (!created) {
      throw new Error('Idea was inserted but could not be retrieved.');
    }

    return created;
  } catch (error) {
    console.error('Failed to create idea:', error);
    throw error;
  }
}

export async function updateIdea(id: string, updates: UpdateIdeaInput): Promise<Idea | null> {
  try {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: Array<string | number | null> = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.business_model !== undefined) {
      fields.push('business_model = ?');
      params.push(updates.business_model);
    }
    if (updates.feasibility !== undefined) {
      fields.push('feasibility = ?');
      params.push(updates.feasibility);
    }
    if (updates.excitement !== undefined) {
      fields.push('excitement = ?');
      params.push(updates.excitement);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }

    if (fields.length === 0) {
      return getIdeaById(id);
    }

    fields.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);

    await db.runAsync(`UPDATE ideas SET ${fields.join(', ')} WHERE id = ?`, params);
    return getIdeaById(id);
  } catch (error) {
    console.error('Failed to update idea:', error);
    throw error;
  }
}

export async function deleteIdea(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM problem_idea_links WHERE idea_id = ?', [id]);
    await db.runAsync('DELETE FROM ideas WHERE id = ?', [id]);
  } catch (error) {
    console.error('Failed to delete idea:', error);
    throw error;
  }
}

export async function getIdeaById(id: string): Promise<(Idea & { linked_problems: Problem[] }) | null> {
  try {
    const db = await getDatabase();
    const ideaRow = await db.getFirstAsync<IdeaRow>(
      `SELECT i.*, COUNT(l.problem_id) AS linked_problems_count
       FROM ideas i
       LEFT JOIN problem_idea_links l ON i.id = l.idea_id
       WHERE i.id = ?
       GROUP BY i.id`,
      [id]
    );

    if (!ideaRow) {
      return null;
    }

    const linkedProblemRows = await db.getAllAsync<ProblemRow>(
      `SELECT p.*
       FROM problems p
       INNER JOIN problem_idea_links l ON p.id = l.problem_id
       WHERE l.idea_id = ?
       ORDER BY l.created_at DESC`,
      [id]
    );

    return {
      ...mapIdea(ideaRow),
      linked_problems: linkedProblemRows.map(mapProblem),
    };
  } catch (error) {
    console.error('Failed to get idea by id:', error);
    throw error;
  }
}

export async function getAllIdeas(filters?: {
  status?: IdeaStatus;
  searchQuery?: string;
}): Promise<Idea[]> {
  try {
    const db = await getDatabase();
    const conditions: string[] = [];
    const params: string[] = [];

    if (filters?.status) {
      conditions.push('i.status = ?');
      params.push(filters.status);
    }

    if (filters?.searchQuery) {
      conditions.push('i.title LIKE ?');
      params.push(`%${filters.searchQuery.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.getAllAsync<IdeaRow>(
      `SELECT i.*, COUNT(l.problem_id) AS linked_problems_count
       FROM ideas i
       LEFT JOIN problem_idea_links l ON i.id = l.idea_id
       ${whereClause}
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      params
    );

    return rows.map(mapIdea);
  } catch (error) {
    console.error('Failed to get all ideas:', error);
    throw error;
  }
}

export async function getIdeasForProblem(problemId: string): Promise<Idea[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<IdeaRow>(
      `SELECT i.*, COUNT(l2.problem_id) AS linked_problems_count
       FROM ideas i
       INNER JOIN problem_idea_links l ON i.id = l.idea_id
       LEFT JOIN problem_idea_links l2 ON i.id = l2.idea_id
       WHERE l.problem_id = ?
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      [problemId]
    );

    return rows.map(mapIdea);
  } catch (error) {
    console.error('Failed to get ideas for problem:', error);
    throw error;
  }
}

export async function getTodayIdeasCount(): Promise<number> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM ideas WHERE date(created_at, 'localtime') = date('now', 'localtime')"
    );
    return row?.count ?? 0;
  } catch (error) {
    console.error('Failed to get today ideas count:', error);
    throw error;
  }
}
