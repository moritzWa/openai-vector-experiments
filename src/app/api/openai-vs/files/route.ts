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
  if (!vector_store_id)
    return NextResponse.json(
      { files: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );

  const list = await client.vectorStores.files.list(vector_store_id);

  // Normalize output for UI: [{id, filename, created_at, status}]
  const files = await Promise.all(
    list.data.map(async (f: any) => {
      let filename: string | undefined;
      let created_at: number | null | undefined;
      try {
        const file = await client.files.retrieve(f.id);
        filename = file.filename;
        created_at = file.created_at ?? null;
      } catch {}
      return {
        id: f.id,
        filename: filename ?? 'file',
        created_at: created_at ?? f.created_at ?? null,
        status: f.status ?? 'unknown',
      };
    })
  );
  return NextResponse.json(
    { files, vector_store_id },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
