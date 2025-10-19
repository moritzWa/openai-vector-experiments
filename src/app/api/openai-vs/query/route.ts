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

function extractAnswerAndCitations(response: ResponseLike): {
  answer: string;
  citations: Array<{ file_id: string; quote?: string }>;
} {
  const outputs = response.output ?? [];
  const answerParts: string[] = [];
  const citations: Array<{ file_id: string; quote?: string }> = [];
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
        if (annotation?.type === 'file_citation' && annotation?.file_id) {
          citations.push({
            file_id: annotation.file_id,
            quote: annotation?.quote,
          });
        }
      }
    }
  }
  const answer = answerParts.join('') || response.output_text || '';
  return { answer, citations };
}

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

  const { answer, citations } = extractAnswerAndCitations(
    response as ResponseLike
  );

  return NextResponse.json({ answer, citations, vector_store_id });
}
