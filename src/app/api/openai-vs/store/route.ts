import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_PATH = path.resolve(process.cwd(), 'data/openai-vs.json');

async function readStoreFile() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(raw) as { vector_store_id?: string; name?: string };
  } catch {
    return {} as { vector_store_id?: string; name?: string };
  }
}

async function writeStoreFile(data: { vector_store_id: string; name: string }) {
  const dir = path.dirname(DATA_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function GET() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const existing = await readStoreFile();
  if (existing.vector_store_id) {
    return NextResponse.json(existing);
  }
  const created = await client.vectorStores.create({ name: 'openai-vs-demo' });
  const payload = { vector_store_id: created.id, name: created.name ?? 'openai-vs-demo' };
  await writeStoreFile(payload);
  return NextResponse.json(payload);
}


