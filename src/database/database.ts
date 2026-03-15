import * as SQLite from 'expo-sqlite';

const DB_NAME = 'founder.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  return dbPromise;
}

export async function initializeDatabase(): Promise<void> {
  try {
    const db = await getDatabase();

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS problems (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        context TEXT,
        who_faces TEXT,
        frequency TEXT,
        domain TEXT,
        custom_tags TEXT,
        status TEXT DEFAULT 'open',
        is_quick_capture INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        business_model TEXT,
        feasibility INTEGER DEFAULT 0,
        excitement INTEGER DEFAULT 0,
        status TEXT DEFAULT 'just_idea',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS problem_idea_links (
        id TEXT PRIMARY KEY,
        problem_id TEXT NOT NULL,
        idea_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
        FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
        UNIQUE(problem_id, idea_id)
      );

      CREATE TABLE IF NOT EXISTS daily_logs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        problems_count INTEGER DEFAULT 0,
        ideas_count INTEGER DEFAULT 0,
        target_completed INTEGER DEFAULT 0,
        score_earned INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems(created_at);
      CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at);
      CREATE INDEX IF NOT EXISTS idx_links_problem_id ON problem_idea_links(problem_id);
      CREATE INDEX IF NOT EXISTS idx_links_idea_id ON problem_idea_links(idea_id);
    `);

    await ensureLegacyColumns(db);
    await initializeAppState();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

type DailyLog = {
  id: string;
  date: string;
  problems_count: number;
  ideas_count: number;
  target_completed: number;
  score_earned: number;
};

type AppStateRow = {
  key: string;
  value: string;
};

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toLocalDateFromIso(isoString: string): string {
  return getLocalDateString(new Date(isoString));
}

async function ensureLegacyColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  await ensureColumn(db, 'problems', 'description', 'TEXT');
  await ensureColumn(db, 'problems', 'who_faces', 'TEXT');
  await ensureColumn(db, 'problems', 'frequency', 'TEXT');
  await ensureColumn(db, 'problems', 'domain', 'TEXT');
  await ensureColumn(db, 'problems', 'custom_tags', 'TEXT');
  await ensureColumn(db, 'problems', 'is_quick_capture', 'INTEGER DEFAULT 0');

  await ensureColumn(db, 'ideas', 'business_model', 'TEXT');
  await ensureColumn(db, 'ideas', 'feasibility', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'ideas', 'excitement', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'ideas', 'status', "TEXT DEFAULT 'just_idea'");

  await ensureColumn(db, 'problem_idea_links', 'id', 'TEXT');
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  if (!columns.some((column) => column.name === columnName)) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

export async function initializeAppState(): Promise<void> {
  const db = await getDatabase();
  const defaults: AppStateRow[] = [
    { key: 'current_streak', value: '0' },
    { key: 'best_streak', value: '0' },
    { key: 'total_score', value: '0' },
    { key: 'last_active_date', value: '' },
  ];

  for (const entry of defaults) {
    await db.runAsync('INSERT OR IGNORE INTO app_state (key, value) VALUES (?, ?)', [entry.key, entry.value]);
  }
}

export async function getAppStateValue(key: string): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM app_state WHERE key = ?', [key]);
  return row?.value ?? '';
}

export async function setAppStateValue(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_state (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getOrCreateTodayLog(): Promise<DailyLog> {
  const db = await getDatabase();
  const today = getLocalDateString();
  const existing = await db.getFirstAsync<DailyLog>('SELECT * FROM daily_logs WHERE date = ?', [today]);
  if (existing) {
    return existing;
  }

  const dailyLog: DailyLog = {
    id: generateUniqueId(),
    date: today,
    problems_count: 0,
    ideas_count: 0,
    target_completed: 0,
    score_earned: 0,
  };

  await db.runAsync(
    `INSERT INTO daily_logs (id, date, problems_count, ideas_count, target_completed, score_earned)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      dailyLog.id,
      dailyLog.date,
      dailyLog.problems_count,
      dailyLog.ideas_count,
      dailyLog.target_completed,
      dailyLog.score_earned,
    ]
  );

  return dailyLog;
}

export async function updateTodayProblemsCount(delta: number): Promise<void> {
  const db = await getDatabase();
  const log = await getOrCreateTodayLog();

  await db.runAsync('UPDATE daily_logs SET problems_count = MAX(0, problems_count + ?) WHERE id = ?', [delta, log.id]);
}

export async function updateTodayIdeasCount(delta: number): Promise<void> {
  const db = await getDatabase();
  const log = await getOrCreateTodayLog();

  await db.runAsync('UPDATE daily_logs SET ideas_count = MAX(0, ideas_count + ?) WHERE id = ?', [delta, log.id]);
}

export async function getDailyLogs(days: number = 30): Promise<DailyLog[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailyLog>('SELECT * FROM daily_logs ORDER BY date DESC LIMIT ?', [days]);
}

export async function getTotalStats(): Promise<{
  totalProblems: number;
  totalIdeas: number;
  problemsWithoutIdeas: number;
  totalDaysLogged: number;
}> {
  const db = await getDatabase();

  const totalProblems = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM problems'))?.count ?? 0;
  const totalIdeas = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM ideas'))?.count ?? 0;
  const problemsWithoutIdeas =
    (
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM problems p
         LEFT JOIN problem_idea_links l ON p.id = l.problem_id
         WHERE l.problem_id IS NULL`
      )
    )?.count ?? 0;
  const totalDaysLogged = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM daily_logs'))?.count ?? 0;

  return {
    totalProblems,
    totalIdeas,
    problemsWithoutIdeas,
    totalDaysLogged,
  };
}

export async function updateStreak(): Promise<void> {
  const today = getLocalDateString();
  const yesterday = getYesterdayDateString();
  const lastActiveDate = await getAppStateValue('last_active_date');
  const currentStreakRaw = await getAppStateValue('current_streak');
  const bestStreakRaw = await getAppStateValue('best_streak');

  let currentStreak = Number.parseInt(currentStreakRaw || '0', 10) || 0;
  let bestStreak = Number.parseInt(bestStreakRaw || '0', 10) || 0;

  if (lastActiveDate === today) {
    return;
  }

  if (lastActiveDate === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }

  if (currentStreak > bestStreak) {
    bestStreak = currentStreak;
  }

  await setAppStateValue('current_streak', String(currentStreak));
  await setAppStateValue('best_streak', String(bestStreak));
  await setAppStateValue('last_active_date', today);
}

export async function getStreakInfo(): Promise<{ currentStreak: number; bestStreak: number; isActiveToday: boolean }> {
  const [currentStreakRaw, bestStreakRaw, lastActiveDate] = await Promise.all([
    getAppStateValue('current_streak'),
    getAppStateValue('best_streak'),
    getAppStateValue('last_active_date'),
  ]);

  const today = getLocalDateString();

  return {
    currentStreak: Number.parseInt(currentStreakRaw || '0', 10) || 0,
    bestStreak: Number.parseInt(bestStreakRaw || '0', 10) || 0,
    isActiveToday: lastActiveDate === today,
  };
}
