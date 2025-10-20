import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  getDatabase,
  insertChunk,
  getNextChunkId,
  addVectors,
  saveIndex,
} from '@/lib/faiss-sqlite';
import { chunkText } from '@/lib/faiss-sqlite/chunking';

export async function POST(req: Request) {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Parse form data
    const form = await req.formData();
    let files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      files = form.getAll('file').filter((f): f is File => f instanceof File);
    }
    if (files.length === 0) {
      return NextResponse.json({ error: 'Missing file(s)' }, { status: 400 });
    }

    const results: Array<{
      fileName: string;
      chunks: number;
      documentId: string;
    }> = [];

    for (const file of files) {
      // Read file content
      const text = await file.text();

      // Chunk the text
      const chunks = chunkText(text);

      if (chunks.length === 0) {
        continue; // Skip empty files
      }

      // Generate embeddings for all chunks in batch
      const embeddingResponse = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunks,
      });

      const embeddings = embeddingResponse.data.map((d) => d.embedding);

      // Get starting chunk ID
      const startId = getNextChunkId();

      // Prepare vectors and metadata
      const vectors: number[][] = [];
      const timestamp = Date.now();

      for (let i = 0; i < chunks.length; i++) {
        const chunkId = startId + i;

        // Store metadata in SQLite
        insertChunk({
          id: chunkId,
          documentName: file.name,
          text: chunks[i],
          chunkIndex: i,
          createdAt: timestamp,
        });

        // Collect vector for batch insertion
        vectors.push(embeddings[i]);
      }

      // Add all vectors to FAISS index
      addVectors(vectors);

      results.push({
        fileName: file.name,
        chunks: chunks.length,
        documentId: `${file.name}-${timestamp}`,
      });
    }

    // Persist FAISS index to disk
    saveIndex();

    return NextResponse.json({
      success: true,
      files: results,
      totalChunks: results.reduce((sum, r) => sum + r.chunks, 0),
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      {
        error: 'Failed to ingest documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
