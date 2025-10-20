# FAISS + SQLite RAG Implementation

A production-ready Retrieval-Augmented Generation (RAG) system using FAISS for vector similarity search and SQLite for metadata storage.

## Architecture

### Components

1. **FAISS Index** (`data/faiss.index`)
   - Stores 1536-dimensional embeddings (OpenAI text-embedding-3-small)
   - Uses IndexFlatL2 for exact L2 distance search
   - Persisted to disk as binary file

2. **SQLite Database** (`data/metadata.db`)
   - Stores document chunks with metadata
   - Schema: id, document_name, text, chunk_index, created_at
   - Maintains 1:1 mapping with FAISS indices

3. **Chunking Strategy**
   - 500 words per chunk
   - 50 words overlap between chunks
   - Preserves context across chunk boundaries

## API Endpoints

### POST `/api/faiss-rag/ingest`
Upload markdown files for indexing.

**Request:**
```bash
curl -X POST http://localhost:3000/api/faiss-rag/ingest \
  -F "file=@document.md"
```

**Response:**
```json
{
  "success": true,
  "files": [{
    "fileName": "document.md",
    "chunks": 5,
    "documentId": "document.md-1234567890"
  }],
  "totalChunks": 5
}
```

### POST `/api/faiss-rag/query`
Query the RAG system.

**Request:**
```bash
curl -X POST http://localhost:3000/api/faiss-rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is FAISS?", "topK": 5}'
```

**Response:**
```json
{
  "query": "What is FAISS?",
  "answer": "FAISS is a library for efficient similarity search...",
  "sources": [{
    "documentName": "sample-doc.md",
    "chunkIndex": 0,
    "distance": 0.89,
    "text": "FAISS (Facebook AI Similarity Search)..."
  }],
  "usage": {
    "embeddingTokens": 5,
    "completionTokens": 150
  }
}
```

### GET `/api/faiss-rag/documents`
List all uploaded documents.

**Response:**
```json
{
  "documents": [{
    "documentName": "sample-doc.md",
    "totalChunks": 5,
    "createdAt": 1234567890
  }],
  "stats": {
    "totalDocuments": 3,
    "totalChunks": 15,
    "totalVectors": 15
  }
}
```

## Frontend

Access the UI at: `http://localhost:3000/faiss-rag`

Features:
- Upload multiple markdown files
- Query with natural language
- View answers with source citations
- See all uploaded documents with stats

## Key Implementation Details

### 1. Vector Search Order Preservation
SQLite's `IN` clause doesn't preserve order, which would mismatch distances with chunks. Fixed with:

```sql
ORDER BY CASE id
  WHEN ? THEN 0
  WHEN ? THEN 1
  -- ...
END
```

### 2. FAISS Index Size Limiting
Requesting more results than available vectors throws error. Fixed with:

```typescript
const actualK = Math.min(k, index.ntotal());
```

### 3. Native Module Configuration
Next.js + Turbopack requires external packages configuration:

```typescript
// next.config.ts
serverExternalPackages: ['faiss-node', 'better-sqlite3']
```

## Testing

Run the full workflow test:

```bash
./test-full-workflow.sh
```

This will:
1. Clean existing data
2. Upload test documents
3. Run sample queries
4. Verify all endpoints

## Comparison: FAISS vs OpenAI Vector Store

| Feature | FAISS + SQLite | OpenAI Vector Store |
|---------|----------------|---------------------|
| **Cost** | Free (local) | Paid (API usage) |
| **Speed** | Fast (in-memory) | Network latency |
| **Control** | Full control | Managed service |
| **Scaling** | Manual | Automatic |
| **Persistence** | Local files | Cloud storage |
| **Setup** | More complex | Simple API calls |

## Interview Preparation Notes

### Why FAISS over pgvector?
- **FAISS**: 10-100x faster for pure similarity search, optimized for read-heavy workloads
- **pgvector**: Better for transactional consistency, when vectors need ACID guarantees

### Production Considerations
1. **Hybrid Approach**: FAISS for search speed + Postgres for metadata/transactions
2. **Scaling**: Shard FAISS indices or use distributed solutions (Faiss distributed, Milvus)
3. **Updates**: FAISS doesn't support efficient deletion → rebuild index or soft-delete in metadata

### RAG Pipeline Steps
1. **Ingestion**: Chunk → Embed → Store (FAISS + metadata)
2. **Query**: Embed query → Similarity search → Retrieve context
3. **Generation**: Context + query → LLM → Answer with citations

### Key Metrics
- **Embedding dimension**: 1536 (OpenAI text-embedding-3-small)
- **Chunk size**: 500 words
- **Overlap**: 50 words
- **Search**: L2 distance (lower = more similar)

## Files Structure

```
src/
├── app/
│   ├── api/faiss-rag/
│   │   ├── ingest/route.ts       # Upload & index documents
│   │   ├── query/route.ts        # RAG query endpoint
│   │   └── documents/route.ts    # List documents
│   └── faiss-rag/
│       └── page.tsx               # Frontend UI
├── lib/faiss-sqlite/
│   ├── types.ts                   # TypeScript interfaces
│   ├── db.ts                      # SQLite operations
│   ├── faiss.ts                   # FAISS operations
│   ├── chunking.ts                # Text chunking utility
│   └── index.ts                   # Exports
data/
├── faiss.index                    # FAISS vector index
└── metadata.db                    # SQLite database
```

## Next Steps for Production

1. **Error Handling**: Add retry logic for API calls
2. **Rate Limiting**: Prevent abuse of embedding/completion APIs
3. **Caching**: Cache embeddings for repeated queries
4. **Monitoring**: Track query latency, accuracy metrics
5. **Auth**: Add authentication for multi-user scenarios
6. **Backup**: Regular backups of FAISS index + SQLite DB
