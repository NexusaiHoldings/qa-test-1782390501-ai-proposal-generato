/**
 * Case-study library — server-side manager.
 * Stores document metadata + text excerpts for semantic RFP matching.
 * Max 10 case studies per user (enforced at insert time).
 */

export interface CaseStudy {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  excerpt: string;
  createdAt: string;
}

const MAX_CASE_STUDIES = 10;
const EXCERPT_MAX_CHARS = 4096;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
} {
  if (_pool) return _pool;
  const { Pool: PgPool } = require("pg") as {
    Pool: new (cfg: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

async function ensureTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proposals_case_studies (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT        NOT NULL,
      title       TEXT        NOT NULL,
      file_name   TEXT        NOT NULL,
      file_size   INTEGER     NOT NULL,
      content_type TEXT       NOT NULL,
      excerpt     TEXT        NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function listCaseStudies(userId: string): Promise<CaseStudy[]> {
  await ensureTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, title, file_name, file_size, content_type, excerpt, created_at
     FROM proposals_case_studies
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    fileName: row.file_name as string,
    fileSize: row.file_size as number,
    contentType: row.content_type as string,
    excerpt: row.excerpt as string,
    createdAt: row.created_at instanceof Date
      ? (row.created_at as Date).toISOString()
      : String(row.created_at),
  }));
}

export async function countCaseStudies(userId: string): Promise<number> {
  await ensureTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT COUNT(*) AS count FROM proposals_case_studies WHERE user_id = $1`,
    [userId],
  );
  return parseInt(String(result.rows[0]?.count ?? "0"), 10);
}

export async function addCaseStudy(
  userId: string,
  title: string,
  fileName: string,
  fileSize: number,
  contentType: string,
  excerpt: string,
): Promise<CaseStudy> {
  await ensureTable();
  const count = await countCaseStudies(userId);
  if (count >= MAX_CASE_STUDIES) {
    throw new Error(
      `Maximum of ${MAX_CASE_STUDIES} case studies allowed per user. Delete one to add another.`,
    );
  }
  const pool = getPool();
  const safeExcerpt = excerpt.slice(0, EXCERPT_MAX_CHARS);
  const result = await pool.query(
    `INSERT INTO proposals_case_studies
       (user_id, title, file_name, file_size, content_type, excerpt)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, title, file_name, file_size, content_type, excerpt, created_at`,
    [userId, title, fileName, fileSize, contentType, safeExcerpt],
  );
  const row = result.rows[0];
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    fileName: row.file_name as string,
    fileSize: row.file_size as number,
    contentType: row.content_type as string,
    excerpt: row.excerpt as string,
    createdAt: row.created_at instanceof Date
      ? (row.created_at as Date).toISOString()
      : String(row.created_at),
  };
}

export async function removeCaseStudy(userId: string, id: string): Promise<void> {
  await ensureTable();
  const pool = getPool();
  await pool.query(
    `DELETE FROM proposals_case_studies WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
