import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_PATH = path.resolve(process.cwd(), 'data/openai-vs.json');

type ResponseLike = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: { value?: string } | string;
      annotations?: Array<{ type?: string; file_id?: string; quote?: string }>;
    }>;
  }>;
  output_text?: string | null;
};

async function readStoreFile() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(raw) as { vector_store_id?: string };
  } catch {
    return {} as { vector_store_id?: string };
  }
}

type QueryBody = { query?: string };

export async function POST(req: Request) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { vector_store_id } = await readStoreFile();
  if (!vector_store_id)
    return NextResponse.json(
      { error: 'Vector store not initialized' },
      { status: 400 }
    );

  const body = (await req.json().catch(() => ({}))) as QueryBody;
  const query = (body.query || '').trim();
  if (!query)
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const system =
    'You are a retrieval assistant. Answer strictly using the retrieved files. Include brief citations by filename when possible.';

  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: system },
      { role: 'user', content: query },
    ],
    tools: [{ type: 'file_search', vector_store_ids: [vector_store_id] }],
  });

  // Single-pass extraction and aggregation
  const resp = response as ResponseLike;
  const outputs = resp.output ?? [];
  const answerParts: string[] = [];
  const byFile = new Map<string, { count: number }>();
  const uniqueIds = new Set<string>();

  for (const output of outputs) {
    const content = output?.content ?? [];
    for (const contentItem of content) {
      if (contentItem?.type === 'output_text') {
        const t = contentItem?.text as { value?: string } | string | undefined;
        const value = typeof t === 'string' ? t : t?.value ?? '';
        if (value) answerParts.push(value);
      }
      const annotations = contentItem?.annotations ?? [];
      for (const annotation of annotations) {
        console.log('annotation in loop:', annotation);

        if (annotation?.type === 'file_citation' && annotation?.file_id) {
          uniqueIds.add(annotation.file_id);
          const entry = byFile.get(annotation.file_id) ?? { count: 0 };
          entry.count += 1;
          byFile.set(annotation.file_id, entry);
        }
      }
    }
  }

  const answer = answerParts.join('') || resp.output_text || '';

  // Resolve filenames once per unique file ID
  const idToName: Record<string, string> = {};
  await Promise.all(
    Array.from(uniqueIds).map(async (id) => {
      try {
        const file = await client.files.retrieve(id);
        idToName[id] = file.filename;
      } catch {}
    })
  );

  const citations_summary = Array.from(byFile, ([file_id, v]) => ({
    file_id,
    filename: idToName[file_id] ?? file_id,
    count: v.count,
  })).sort((a, b) => b.count - a.count);

  return NextResponse.json({ answer, citations_summary, vector_store_id });
}
