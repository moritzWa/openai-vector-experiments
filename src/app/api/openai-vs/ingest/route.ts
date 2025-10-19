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

export async function POST(req: Request) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { vector_store_id } = await readStoreFile();
  if (!vector_store_id)
    return NextResponse.json(
      { error: 'Vector store not initialized' },
      { status: 400 }
    );

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploaded = await client.files.create({
    file: new File([buffer], file.name, { type: file.type || 'text/markdown' }),
    purpose: 'assistants',
  });

  await client.vectorStores.files.create(vector_store_id, {
    file_id: uploaded.id,
  });

  return NextResponse.json({
    file_id: uploaded.id,
    file_name: file.name,
    vector_store_id,
  });
}
