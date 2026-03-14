import {
  generateUniqueId,
  getDatabase,
  nowIso,
  toLocalDateFromIso,
  updateStreak,
  updateTodayProblemsCount,
} from './database';

export type ProblemStatus = 'open' | 'exploring' | 'solved';

export type Problem = {
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
};

export type CreateProblemInput = {
  title: string;
  description?: string | null;
  context?: string | null;
  who_faces?: string[];
  frequency?: 'rare' | 'sometimes' | 'often' | 'daily' | null;
  domain?: string | null;
  custom_tags?: string[];
  status?: ProblemStatus;
  is_quick_capture?: boolean;
};

export type UpdateProblemInput = Partial<CreateProblemInput>;

type ProblemRow = {
  id: string;
  title: string;
  description: string | null;
  context: string | null;
  who_faces: string | null;
  frequency: 'rare' | 'sometimes' | 'often' | 'daily' | null;
  domain: string | null;
  custom_tags: string | null;
  status: ProblemStatus;
  is_quick_capture: number;
  created_at: string;
  updated_at: string;
  linked_ideas_count?: number;
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
    console.error('Failed to parse JSON array field in problems:', error);
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
    linked_ideas_count: row.linked_ideas_count ?? 0,
  };
}

export async function createProblem(problem: CreateProblemInput): Promise<Problem> {
  try {
    const db = await getDatabase();
    const id = generateUniqueId();
    const timestamp = nowIso();

    await db.runAsync(
      `INSERT INTO problems (
        id, title, description, context, who_faces, frequency, domain,
        custom_tags, status, is_quick_capture, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        problem.title,
        problem.description ?? null,
        problem.context ?? null,
        JSON.stringify(problem.who_faces ?? []),
        problem.frequency ?? null,
        problem.domain ?? null,
        JSON.stringify(problem.custom_tags ?? []),
        problem.status ?? 'open',
        problem.is_quick_capture ? 1 : 0,
        timestamp,
        timestamp,
      ]
    );

    await updateTodayProblemsCount(1);
    await updateStreak();

    const created = await getProblemById(id);
    if (!created) {
      throw new Error('Problem was inserted but could not be retrieved.');
    }

    return created;
  } catch (error) {
    console.error('Failed to create problem:', error);
    throw error;
  }
}

export async function updateProblem(id: string, updates: UpdateProblemInput): Promise<Problem | null> {
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
    if (updates.context !== undefined) {
      fields.push('context = ?');
      params.push(updates.context);
    }
    if (updates.who_faces !== undefined) {
      fields.push('who_faces = ?');
      params.push(JSON.stringify(updates.who_faces ?? []));
    }
    if (updates.frequency !== undefined) {
      fields.push('frequency = ?');
      params.push(updates.frequency);
    }
    if (updates.domain !== undefined) {
      fields.push('domain = ?');
      params.push(updates.domain);
    }
    if (updates.custom_tags !== undefined) {
      fields.push('custom_tags = ?');
      params.push(JSON.stringify(updates.custom_tags ?? []));
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.is_quick_capture !== undefined) {
      fields.push('is_quick_capture = ?');
      params.push(updates.is_quick_capture ? 1 : 0);
    }

    if (fields.length === 0) {
      return getProblemById(id);
    }

    fields.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);

    await db.runAsync(`UPDATE problems SET ${fields.join(', ')} WHERE id = ?`, params);
    return getProblemById(id);
  } catch (error) {
    console.error('Failed to update problem:', error);
    throw error;
  }
}

export async function deleteProblem(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM problems WHERE id = ?', [id]);
    if (!existing) {
      return;
    }

    await db.runAsync('DELETE FROM problem_idea_links WHERE problem_id = ?', [id]);
    await db.runAsync('DELETE FROM problems WHERE id = ?', [id]);
    await updateTodayProblemsCount(-1);
  } catch (error) {
    console.error('Failed to delete problem:', error);
    throw error;
  }
}

export async function getProblemById(id: string): Promise<Problem | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ProblemRow>(
      `SELECT p.*, COUNT(l.idea_id) AS linked_ideas_count
       FROM problems p
       LEFT JOIN problem_idea_links l ON p.id = l.problem_id
       WHERE p.id = ?
       GROUP BY p.id`,
      [id]
    );

    return row ? mapProblem(row) : null;
  } catch (error) {
    console.error('Failed to get problem by id:', error);
    throw error;
  }
}

export async function getAllProblems(filters?: {
  date?: string;
  status?: ProblemStatus;
  domain?: string;
  searchQuery?: string;
}): Promise<Problem[]> {
  try {
    const db = await getDatabase();
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filters?.date) {
      conditions.push("date(p.created_at, 'localtime') = ?");
      params.push(filters.date);
    }
    if (filters?.status) {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }
    if (filters?.domain) {
      conditions.push('p.domain = ?');
      params.push(filters.domain);
    }
    if (filters?.searchQuery) {
      conditions.push('p.title LIKE ?');
      params.push(`%${filters.searchQuery.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.getAllAsync<ProblemRow>(
      `SELECT p.*, COUNT(l.idea_id) AS linked_ideas_count
       FROM problems p
       LEFT JOIN problem_idea_links l ON p.id = l.problem_id
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      params
    );

    return rows.map(mapProblem);
  } catch (error) {
    console.error('Failed to get all problems:', error);
    throw error;
  }
}

export async function getProblemsGroupedByDate(): Promise<Array<{ date: string; problems: Problem[] }>> {
  try {
    const problems = await getAllProblems();
    const grouped = new Map<string, Problem[]>();

    for (const problem of problems) {
      const date = toLocalDateFromIso(problem.created_at);
      const list = grouped.get(date) ?? [];
      list.push(problem);
      grouped.set(date, list);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, dateProblems]) => ({ date, problems: dateProblems }));
  } catch (error) {
    console.error('Failed to group problems by date:', error);
    throw error;
  }
}

export async function getTodayProblemsCount(): Promise<number> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM problems WHERE date(created_at, 'localtime') = date('now', 'localtime')"
    );
    return row?.count ?? 0;
  } catch (error) {
    console.error('Failed to get today problems count:', error);
    throw error;
  }
}

export async function getProblemsWithoutIdeas(): Promise<Problem[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ProblemRow>(
      `SELECT p.*, 0 AS linked_ideas_count
       FROM problems p
       LEFT JOIN problem_idea_links l ON p.id = l.problem_id
       WHERE l.problem_id IS NULL
       ORDER BY p.created_at DESC`
    );

    return rows.map(mapProblem);
  } catch (error) {
    console.error('Failed to get problems without ideas:', error);
    throw error;
  }
}

export async function updateProblemStatus(id: string, status: ProblemStatus): Promise<Problem | null> {
  try {
    return updateProblem(id, { status });
  } catch (error) {
    console.error('Failed to update problem status:', error);
    throw error;
  }
}
