import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_PATH = path.resolve(process.cwd(), 'data/openai-vs.json');

async function readStoreFile() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(raw) as { vector_store_id?: string };
  } catch {
    return {} as { vector_store_id?: string };
  }
}

export async function GET() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { vector_store_id } = await readStoreFile();
  if (!vector_store_id) return NextResponse.json({ files: [] });

  const list = await client.vectorStores.files.list(vector_store_id);
  // Normalize output for UI: [{id, filename, created_at, status}]
  const files = list.data.map((f: any) => ({
    id: f.id,
    filename: f.filename ?? f.display_name ?? 'file',
    created_at: f.created_at ?? null,
    status: f.status ?? 'unknown',
  }));
  return NextResponse.json({ files, vector_store_id });
}
