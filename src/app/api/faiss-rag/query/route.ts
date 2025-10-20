import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  searchVectors,
  getChunksByIds,
  type SearchResult,
} from '@/lib/faiss-sqlite';
import { encodeSSE, SSE_HEADERS } from '@/lib/sse';

export async function POST(req: Request) {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Parse request body
    const body = await req.json();
    const { query, topK = 5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Generate embedding for the query
    const embeddingResponse = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search FAISS index for similar vectors
    const { distances, ids } = searchVectors(queryEmbedding, topK);

    // Retrieve corresponding chunks from SQLite (preserving order)
    const chunks = getChunksByIds(ids);

    // Build search results with distances
    const searchResults: SearchResult[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      text: chunk.text,
      documentName: chunk.documentName,
      distance: distances[i],
      chunkIndex: chunk.chunkIndex,
    }));

    // Build context from retrieved chunks
    const context = searchResults
      .map(
        (result, i) =>
          `[${i + 1}] From ${result.documentName} (chunk ${
            result.chunkIndex
          }):\n${result.text}`
      )
      .join('\n\n');

    // Generate response using OpenAI chat completions with streaming
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
Use the context below to answer the user's question. If the answer cannot be found in the context, say so.
Always cite which source number(s) you used (e.g., [1], [2]).

Context:
${context}`;

    const stream = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.7,
      stream: true,
    });

    // Create a ReadableStream for SSE
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the answer
          for await (const event of stream) {
            if ((event as any).type === 'response.output_text.delta') {
              const delta = (event as any).delta as string;
              controller.enqueue(encodeSSE('text', { delta }));
            }
          }

          // Send sources at the end
          controller.enqueue(
            encodeSSE('sources', {
              sources: searchResults.map((result) => ({
                documentName: result.documentName,
                chunkIndex: result.chunkIndex,
                distance: result.distance,
                text: result.text,
              })),
            })
          );

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(
            encodeSSE('error', {
              error: error instanceof Error ? error.message : String(error),
            })
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error('Query error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
