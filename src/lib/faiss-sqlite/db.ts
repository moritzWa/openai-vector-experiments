import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { DocumentChunk, DocumentMetadata } from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'metadata.db');

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    dbInstance = new Database(DB_PATH);
    initializeSchema(dbInstance);
  }
  return dbInstance;
}

function initializeSchema(db: Database.Database) {
  // Create chunks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY,
      document_name TEXT NOT NULL,
      text TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create index for faster document lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_document_name
    ON chunks(document_name)
  `);
}

export function insertChunk(chunk: DocumentChunk): void {
  const db = getDatabase();
  const preparedStatement = db.prepare(`
    INSERT INTO chunks (id, document_name, text, chunk_index, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  preparedStatement.run(
    chunk.id,
    chunk.documentName,
    chunk.text,
    chunk.chunkIndex,
    chunk.createdAt
  );
}

export function getChunksByIds(ids: number[]): DocumentChunk[] {
  if (ids.length === 0) return [];

  const db = getDatabase();
  const placeholders = ids.map(() => '?').join(',');

  // Use ORDER BY CASE to preserve the order of the input IDs
  const orderCases = ids.map((_, i) => `WHEN ? THEN ${i}`).join(' ');

  const preparedStatement = db.prepare(`
    SELECT id, document_name as documentName, text, chunk_index as chunkIndex, created_at as createdAt
    FROM chunks
    WHERE id IN (${placeholders})
    ORDER BY CASE id ${orderCases} END
  `);

  // Pass ids twice: once for IN clause, once for ORDER BY CASE
  return preparedStatement.all(...ids, ...ids) as DocumentChunk[];
}

export function getAllDocuments(): DocumentMetadata[] {
  const db = getDatabase();
  const preparedStatement = db.prepare(`
    SELECT
      document_name as documentName,
      COUNT(*) as totalChunks,
      MIN(created_at) as createdAt
    FROM chunks
    GROUP BY document_name
    ORDER BY createdAt DESC
  `);

  return preparedStatement.all() as DocumentMetadata[];
}

export function getNextChunkId(): number {
  const db = getDatabase();
  const result = db
    .prepare('SELECT COALESCE(MAX(id), -1) + 1 as nextId FROM chunks')
    .get() as { nextId: number };
  return result.nextId;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
