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

type QueryBody = { query?: string };

export async function POST(req: Request) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { vector_store_id } = await readStoreFile();
  if (!vector_store_id) {
    return NextResponse.json(
      { error: 'Vector store not initialized' },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as QueryBody;
  const query = (body.query || '').trim();
  if (!query)
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const system =
    'You are a retrieval assistant. Answer strictly using the retrieved files. Include brief citations by filename when possible.';

  const stream = await client.responses.create({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: system },
      { role: 'user', content: query },
    ],
    tools: [{ type: 'file_search', vector_store_ids: [vector_store_id] }],
    stream: true,
  });

  const encoder = new TextEncoder();
  const bodyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if ((event as any).type === 'response.output_text.delta') {
            const delta = (event as any).delta as string;
            controller.enqueue(
              encoder.encode(
                `data:${JSON.stringify({ type: 'text', delta })}\n\n`
              )
            );
          }
          if ((event as any).type === 'response.error') {
            const err = (event as any).error?.message || 'error';
            controller.enqueue(
              encoder.encode(
                `data:${JSON.stringify({ type: 'error', error: err })}\n\n`
              )
            );
          }
        }

        const final = await (stream as any).finalResponse();

        // Aggregate citations summary from final
        const outputs = (final as any)?.output ?? [];
        const byFile = new Map<string, number>();
        const uniqueIds = new Set<string>();
        for (const output of outputs) {
          const content = output?.content ?? [];
          for (const item of content) {
            const annotations = item?.annotations ?? [];
            for (const ann of annotations) {
              if (ann?.type === 'file_citation' && ann?.file_id) {
                uniqueIds.add(ann.file_id);
                byFile.set(ann.file_id, (byFile.get(ann.file_id) || 0) + 1);
              }
            }
          }
        }
        const idToName: Record<string, string> = {};
        await Promise.all(
          Array.from(uniqueIds).map(async (id) => {
            try {
              const file = await client.files.retrieve(id);
              idToName[id] = file.filename;
            } catch {}
          })
        );
        const citations_summary = Array.from(byFile, ([file_id, count]) => ({
          file_id,
          filename: idToName[file_id] ?? file_id,
          count,
        })).sort((a, b) => b.count - a.count);

        controller.enqueue(
          encoder.encode(
            `data:${JSON.stringify({
              type: 'summary',
              citations_summary,
              vector_store_id,
            })}\n\n`
          )
        );
        controller.enqueue(encoder.encode('event:end\ndata:["end"]\n\n'));
        controller.close();
      } catch (e: any) {
        controller.enqueue(
          encoder.encode(
            `data:${JSON.stringify({
              type: 'error',
              error: String(e?.message || e),
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(bodyStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  });
}
