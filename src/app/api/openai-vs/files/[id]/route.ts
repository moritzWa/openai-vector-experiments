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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { vector_store_id } = await readStoreFile();
  const { id: fileId } = await params;
  if (!vector_store_id || !fileId) {
    return new NextResponse(JSON.stringify({ error: 'Missing ids' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  const vsFile = await client.vectorStores.files.retrieve(fileId, {
    vector_store_id,
  });
  let filename: string | null = null;
  let created_at: number | null = null;
  try {
    const file = await client.files.retrieve(fileId);
    filename = file.filename ?? null;
    created_at = file.created_at ?? null;
  } catch {
    console.error(`Failed to retrieve file ${fileId} from OpenAI`);
  }

  return new NextResponse(
    JSON.stringify({
      id: fileId,
      status: (vsFile as any)?.status ?? 'unknown',
      filename,
      created_at,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}
