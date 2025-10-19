'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type QueryResult = {
  answer: string;
  citations: Array<{ file_id: string; quote?: string }>;
  vector_store_id: string;
};

type ListedFile = {
  id: string;
  filename?: string;
  created_at?: number | null;
  status?: string;
};

export default function Page() {
  const [vectorStoreId, setVectorStoreId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ingestMsg, setIngestMsg] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<ListedFile[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/openai-vs/store');
      const json = await res.json();
      if (res.ok && json.vector_store_id)
        setVectorStoreId(json.vector_store_id);
      // Load files list after store exists
      const fr = await fetch('/api/openai-vs/files');
      const fj = await fr.json();
      if (fr.ok && Array.isArray(fj.files)) setFiles(fj.files);
    })();
  }, []);

  const canIngest = useMemo(
    () => Boolean(file && vectorStoreId),
    [file, vectorStoreId]
  );
  const canQuery = useMemo(
    () => Boolean(query.trim() && vectorStoreId),
    [query, vectorStoreId]
  );

  async function onIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !vectorStoreId) return;
    setIngestMsg('Uploading…');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/openai-vs/ingest', {
      method: 'POST',
      body: fd,
    });
    const json = await res.json();
    if (res.ok) {
      setIngestMsg(
        `Attached ${json.file_name} to store ${json.vector_store_id}`
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // refresh files list
      const fr = await fetch('/api/openai-vs/files');
      const fj = await fr.json();
      if (fr.ok && Array.isArray(fj.files)) setFiles(fj.files);
    } else {
      setIngestMsg(`Error: ${json.error || 'ingest failed'}`);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!canQuery) return;
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/openai-vs/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.ok) setResult(json);
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          OpenAI Vector Store RAG (demo)
        </h1>
        <p className="text-sm text-gray-500">
          Vector store: {vectorStoreId ?? '…'}
        </p>
      </div>

      <form onSubmit={onIngest} className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            disabled={!canIngest}
            className="rounded bg-black text-white px-3 py-2 disabled:opacity-50"
          >
            Upload Markdown
          </button>
        </div>
        {ingestMsg && <p className="text-sm text-gray-600">{ingestMsg}</p>}
      </form>

      <form onSubmit={onSearch} className="space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your uploaded file…"
          className="w-full border rounded px-3 py-2"
        />
        <button
          disabled={!canQuery || loading}
          className="rounded bg-black text-white px-3 py-2 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {result && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Answer</h2>
          <div className="whitespace-pre-wrap border rounded p-3">
            {result.answer || '(no text)'}
          </div>
          {result.citations?.length ? (
            <div>
              <h3 className="font-medium mt-2">Citations</h3>
              <ul className="list-disc pl-6 text-sm">
                {result.citations.map((c, i) => (
                  <li key={i}>
                    {c.file_id}
                    {c.quote ? ` – "${c.quote}"` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Uploaded files</h2>
        {!files.length ? (
          <p className="text-sm text-gray-500">No files yet</p>
        ) : (
          <ul className="list-disc pl-6 text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between">
                <span>{f.filename || f.id}</span>
                <span className="text-gray-500">{f.status || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
