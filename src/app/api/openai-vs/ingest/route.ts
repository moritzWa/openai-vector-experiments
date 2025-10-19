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
  let files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    files = form.getAll('file').filter((f): f is File => f instanceof File);
  }
  if (files.length === 0)
    return NextResponse.json({ error: 'Missing file(s)' }, { status: 400 });

  const results: Array<{ file_id: string; file_name: string }> = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploaded = await client.files.create({
      file: new File([buffer], file.name, {
        type: file.type || 'text/markdown',
      }),
      purpose: 'assistants',
    });
    await client.vectorStores.files.create(vector_store_id, {
      file_id: uploaded.id,
    });
    results.push({ file_id: uploaded.id, file_name: file.name });
  }

  return NextResponse.json({
    files: results,
    vector_store_id,
  });
}
