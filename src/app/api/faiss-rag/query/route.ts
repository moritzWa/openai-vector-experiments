import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  searchVectors,
  getChunksByIds,
  type SearchResult,
} from '@/lib/faiss-sqlite';

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
          `[${i + 1}] From ${result.documentName} (chunk ${result.chunkIndex}):\n${result.text}`
      )
      .join('\n\n');

    // Generate response using OpenAI chat completions
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
Use the context below to answer the user's question. If the answer cannot be found in the context, say so.
Always cite which source number(s) you used (e.g., [1], [2]).

Context:
${context}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.7,
    });

    const answer = completion.choices[0].message.content;

    return NextResponse.json({
      query,
      answer,
      sources: searchResults.map((result) => ({
        documentName: result.documentName,
        chunkIndex: result.chunkIndex,
        distance: result.distance,
        text: result.text, // Full text
      })),
      usage: {
        embeddingTokens: embeddingResponse.usage.total_tokens,
        completionTokens: completion.usage?.total_tokens || 0,
      },
    });
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
