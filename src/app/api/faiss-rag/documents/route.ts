import { NextResponse } from 'next/server';
import { getAllDocuments, getIndexSize } from '@/lib/faiss-sqlite';

export async function GET() {
  try {
    const documents = getAllDocuments();
    const totalVectors = getIndexSize();

    return NextResponse.json({
      documents: documents.map((doc) => ({
        documentName: doc.documentName,
        totalChunks: doc.totalChunks,
        createdAt: doc.createdAt,
      })),
      stats: {
        totalDocuments: documents.length,
        totalChunks: documents.reduce((sum, doc) => sum + doc.totalChunks, 0),
        totalVectors,
      },
    });
  } catch (error) {
    console.error('Documents list error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
