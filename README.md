# OpenAI Vector Experiments

Two production-ready RAG (Retrieval-Augmented Generation) implementations comparing local and managed vector search solutions.

## Implementations

### 1. FAISS + SQLite RAG

Local vector search using [FAISS](https://github.com/facebookresearch/faiss) for similarity search and SQLite for metadata storage.

- **Frontend:** [http://localhost:3000/faiss-rag](http://localhost:3000/faiss-rag)
- **API:** `/api/faiss-rag/*`
- **Details:** See [FAISS-RAG-DEMO.md](./FAISS-RAG-DEMO.md)

**Features:**

- Free, runs entirely locally
- Fast in-memory search
- Full control over indexing and retrieval
- 500-word chunks with 50-word overlap

### 2. OpenAI Vector Store RAG

Managed vector search using OpenAI's Vector Store API.

- **Frontend:** [http://localhost:3000/openai-vector-store-rag](http://localhost:3000/openai-vector-store-rag)
- **API:** `/api/openai-vs/*`

**Features:**

- Fully managed by OpenAI
- Automatic scaling and persistence
- Simple API integration
- Pay-per-use pricing

## Quick Start

```bash
# Install dependencies
bun install

# Set OpenAI API key
export OPENAI_API_KEY=your-key-here

# Run development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Vector Search:** FAISS (faiss-node) & OpenAI Vector Store
- **Database:** SQLite (better-sqlite3)
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **LLM:** OpenAI GPT-4
- **UI:** React + TailwindCSS + shadcn/ui

## Comparison

| Feature         | FAISS + SQLite   | OpenAI Vector Store |
| --------------- | ---------------- | ------------------- |
| **Cost**        | Free (local)     | Paid (API usage)    |
| **Speed**       | Fast (in-memory) | Network latency     |
| **Control**     | Full control     | Managed service     |
| **Scaling**     | Manual           | Automatic           |
| **Persistence** | Local files      | Cloud storage       |
| **Setup**       | More complex     | Simple API calls    |

## API Examples

### FAISS RAG

```bash
# Ingest documents
curl -X POST http://localhost:3000/api/faiss-rag/ingest \
  -F "file=@document.md"

# Query
curl -X POST http://localhost:3000/api/faiss-rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is FAISS?", "topK": 5}'
```

### OpenAI Vector Store

```bash
# Ingest documents
curl -X POST http://localhost:3000/api/openai-vs/ingest \
  -F "file=@document.md"

# Query
curl -X POST http://localhost:3000/api/openai-vs/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain vector stores"}'
```

## License

MIT
