'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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
  const pollingTimers = useRef<Record<string, number>>({});
  const { startPollingFile } = useFilePolling(setFiles, pollingTimers);
  const [selectionLabel, setSelectionLabel] =
    useState<string>('No file chosen');

  // Clear any active polling intervals on unmount/navigation
  useEffect(() => {
    return () => {
      const timers = Object.values(pollingTimers.current);
      for (const timerId of timers) clearInterval(timerId);
      pollingTimers.current = {};
    };
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/openai-vs/store');
      const json = await res.json();
      if (res.ok && json.vector_store_id)
        setVectorStoreId(json.vector_store_id);
      // Load files list after store exists
      const filesResponse = await fetch('/api/openai-vs/files');
      const filesJson = await filesResponse.json();
      if (filesResponse.ok && Array.isArray(filesJson.files))
        setFiles(filesJson.files);
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
    const formData = new FormData();
    // Support multiple selections; append as 'files'
    const inputEl = fileInputRef.current;
    if (inputEl?.files && inputEl.files.length > 0) {
      for (const file of Array.from(inputEl.files))
        formData.append('files', file);
    } else if (file) {
      formData.append('files', file);
    }
    const ingestResponse = await fetch('/api/openai-vs/ingest', {
      method: 'POST',
      body: formData,
    });
    const ingestJson = await ingestResponse.json();
    if (ingestResponse.ok) {
      const uploaded = Array.isArray(ingestJson.files) ? ingestJson.files : [];
      setIngestMsg(
        `Attached ${uploaded.length} file(s) to store ${ingestJson.vector_store_id}`
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Add optimistic entries for all files and start polling each
      setFiles((prev) => [
        ...uploaded.map((u: any) => ({
          id: u.file_id,
          filename: u.file_name,
          status: 'in_progress',
          created_at: Date.now() / 1000,
        })),
        ...prev,
      ]);
      uploaded.forEach((u: any) => startPollingFile(u.file_id));
    } else {
      setIngestMsg(`Error: ${ingestJson.error || 'ingest failed'}`);
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
          {/* Visually hide the native input; trigger via the button */}
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
          <Button disabled={!canIngest} type="submit">
            Upload Markdown
          </Button>
        </div>
        {ingestMsg && <p className="text-sm text-gray-600">{ingestMsg}</p>}
      </form>

      <form onSubmit={onSearch} className="space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your uploaded file…"
          className="w-full"
        />
        <Button disabled={!canQuery || loading} type="submit">
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {result && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Answer</h2>
          <Card className="whitespace-pre-wrap p-3">
            {result.answer || '(no text)'}
          </Card>
          {'citations_summary' in result &&
          (result as any).citations_summary?.length ? (
            <div>
              <h3 className="font-medium mt-2">Citations</h3>
              <ul className="list-disc text-sm">
                {(result as any).citations_summary.map((c: any, i: number) => (
                  <li key={i}>
                    <span className="font-medium">{c.filename}</span>
                    <Badge variant="secondary" className="ml-2">
                      × {c.count}
                    </Badge>
                    {c.quotes?.length ? (
                      <ul className="list-disc pl-6 text-gray-600">
                        {c.quotes.map((q: string, qi: number) => (
                          <li key={qi}>
                            <span className="italic">“{q}”</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
          <ul className="list-disc text-sm">
            {files.map((fileItem) => (
              <li
                key={fileItem.id}
                className="flex pb-2 items-center justify-between"
              >
                <span>
                  {fileItem.filename || fileItem.id}
                  {fileItem.created_at ? (
                    <span className="ml-2 text-gray-500">
                      {new Date(
                        (fileItem.created_at || 0) * 1000
                      ).toLocaleString()}
                    </span>
                  ) : null}
                </span>
                <Badge
                  variant={
                    fileItem.status === 'completed'
                      ? 'secondary'
                      : fileItem.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {fileItem.status || ''}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function useFilePolling(
  setFiles: React.Dispatch<React.SetStateAction<ListedFile[]>>,
  timersRef: React.MutableRefObject<Record<string, number>>
) {
  return {
    startPollingFile: (fileId: string) => {
      if (timersRef.current[fileId]) return; // already polling
      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        try {
          const statusResponse = await fetch(`/api/openai-vs/files/${fileId}`, {
            cache: 'no-store',
          });
          if (statusResponse.ok) {
            const statusJson = await statusResponse.json();
            // write status changes to state
            setFiles((prev) =>
              prev.map((fileItem) =>
                fileItem.id === fileId
                  ? {
                      ...fileItem,
                      status: statusJson.status ?? fileItem.status,
                      filename: statusJson.filename ?? fileItem.filename,
                      created_at: statusJson.created_at ?? fileItem.created_at,
                    }
                  : fileItem
              )
            );
            if (
              statusJson.status === 'completed' ||
              statusJson.status === 'failed' ||
              statusJson.status === 'cancelled'
            ) {
              clearInterval(timersRef.current[fileId]);
              delete timersRef.current[fileId];
              return;
            }
          }
        } catch (error) {
          console.error(`Failed to poll file ${fileId}`, error);
        }
        if (attempts >= 120) {
          // ~4 minutes at 2s interval
          clearInterval(timersRef.current[fileId]);
          delete timersRef.current[fileId];
        }
      };
      const id = window.setInterval(poll, 2000);
      timersRef.current[fileId] = id;
      void poll();
    },
  };
}
