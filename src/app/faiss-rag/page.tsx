'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';

type QueryResult = {
  query: string;
  answer: string;
  sources: Array<{
    documentName: string;
    chunkIndex: number;
    distance: number;
    text: string;
  }>;
  usage: {
    embeddingTokens: number;
    completionTokens: number;
  };
};

type Document = {
  documentName: string;
  totalChunks: number;
  createdAt: number;
};

type DocumentsResponse = {
  documents: Document[];
  stats: {
    totalDocuments: number;
    totalChunks: number;
    totalVectors: number;
  };
};

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [ingestMsg, setIngestMsg] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentsResponse['stats'] | null>(null);
  const [selectionLabel, setSelectionLabel] = useState<string>('No file chosen');
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Reset expanded sources when new query result arrives
  useEffect(() => {
    setExpandedSources(new Set());
  }, [result]);

  async function loadDocuments() {
    try {
      const res = await fetch('/api/faiss-rag/documents');
      const json: DocumentsResponse = await res.json();
      if (res.ok) {
        setDocuments(json.documents);
        setStats(json.stats);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }

  async function onIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setIngestMsg('Uploading…');
    const formData = new FormData();

    // Support multiple selections
    const inputEl = fileInputRef.current;
    if (inputEl?.files && inputEl.files.length > 0) {
      for (const file of Array.from(inputEl.files)) {
        formData.append('files', file);
      }
    } else if (file) {
      formData.append('files', file);
    }

    try {
      const response = await fetch('/api/faiss-rag/ingest', {
        method: 'POST',
        body: formData,
      });
      const json = await response.json();

      if (response.ok) {
        const uploaded = Array.isArray(json.files) ? json.files : [];
        setIngestMsg(
          `Successfully uploaded ${uploaded.length} file(s) with ${json.totalChunks} total chunks`
        );
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSelectionLabel('No file chosen');

        // Reload documents list
        loadDocuments();
      } else {
        setIngestMsg(`Error: ${json.error || 'Upload failed'}`);
      }
    } catch (error) {
      setIngestMsg(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    let answerText = '';

    try {
      const res = await fetch('/api/faiss-rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: 5 }),
      });

      if (!res.body) {
        const json = await res.json();
        setResult(json);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split(/\n\n/).filter(Boolean);

        for (const line of lines) {
          const noPrefix = line.startsWith('data:') ? line.slice(5).trim() : line;
          try {
            const msg = JSON.parse(noPrefix);

            if (msg.type === 'text') {
              answerText += msg.delta;
              setResult((prev) => ({
                ...(prev || { query, answer: '', sources: [], usage: { embeddingTokens: 0, completionTokens: 0 } }),
                answer: answerText,
              }));
            } else if (msg.type === 'sources') {
              setResult((prev) => ({
                ...(prev || { query, answer: answerText, sources: [], usage: { embeddingTokens: 0, completionTokens: 0 } }),
                sources: msg.sources,
              }));
            }
          } catch (err) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    } catch (error) {
      setIngestMsg(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          FAISS + SQLite RAG (demo)
        </h1>
        <p className="text-sm text-gray-500">
          Vector similarity search with local storage
        </p>
      </div>

      <form onSubmit={onIngest} className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            multiple
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              const all = e.target.files ? Array.from(e.target.files) : [];
              if (all.length === 0) setSelectionLabel('No file chosen');
              else if (all.length === 1) setSelectionLabel(all[0].name);
              else setSelectionLabel(`${all.length} files selected`);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose files
          </Button>
          <div className="h-10 flex items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground min-w-[240px]">
            {selectionLabel}
          </div>
          <Button disabled={!file} type="submit">
            Upload Markdown
          </Button>
        </div>
        {ingestMsg && <p className="text-sm text-gray-600">{ingestMsg}</p>}
      </form>

      <form onSubmit={onSearch} className="space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your uploaded files…"
          className="w-full"
        />
        <Button disabled={!query.trim() || loading} type="submit">
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {result && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium mb-2">Answer</h2>
            <Card className="whitespace-pre-wrap p-4">
              {result.answer || '(no answer)'}
            </Card>
          </div>

          {result.sources && result.sources.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Sources ({result.sources.length})</h3>
              <div className="space-y-2">
                {result.sources.map((source, i) => {
                  const isExpanded = expandedSources.has(i);
                  return (
                    <Card key={i} className="p-3 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{source.documentName}</span>
                        <div className="flex gap-2 items-center">
                          <Badge variant="secondary">
                            Chunk {source.chunkIndex}
                          </Badge>
                          <Badge variant="outline">
                            Distance: {source.distance.toFixed(3)}
                          </Badge>
                          <button
                            onClick={() => {
                              setExpandedSources((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) {
                                  next.delete(i);
                                } else {
                                  next.add(i);
                                }
                                return next;
                              });
                            }}
                            className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                      <p
                        className={`text-gray-600 italic transition-all ${
                          isExpanded ? '' : 'line-clamp-3'
                        }`}
                      >
                        "{source.text}"
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {result.usage && (
            <div className="text-xs text-gray-500">
              Tokens used: {result.usage.embeddingTokens} (embedding) + {result.usage.completionTokens} (completion)
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Uploaded Documents</h2>
          {stats && (
            <div className="text-sm text-gray-500">
              {stats.totalDocuments} docs, {stats.totalChunks} chunks, {stats.totalVectors} vectors
            </div>
          )}
        </div>
        {!documents.length ? (
          <p className="text-sm text-gray-500">No documents yet</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc, i) => (
              <li
                key={i}
                className="flex items-center justify-between p-3 border rounded-md"
              >
                <div>
                  <span className="font-medium">{doc.documentName}</span>
                  <span className="ml-3 text-sm text-gray-500">
                    {new Date(doc.createdAt).toLocaleString()}
                  </span>
                </div>
                <Badge variant="secondary">
                  {doc.totalChunks} chunk{doc.totalChunks !== 1 ? 's' : ''}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
