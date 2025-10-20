import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-2xl font-bold">OpenAI Vector Store RAG</h2>
      <Link href="/openai-vector-store-rag" className="text-blue-500">
        OpenAI Vector Store RAG
      </Link>
      <br />
      <h2 className="text-2xl font-bold">FAISS + SQLite RAG</h2>
      <Link href="/faiss-rag" className="text-blue-500">
        FAISS + SQLite RAG
      </Link>
    </div>
  );
}
