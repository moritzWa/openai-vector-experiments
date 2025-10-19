import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold">OpenAI Vector Store RAG</h1>
      <Link href="/openai-vector-store-rag" className="text-blue-500">
        OpenAI Vector Store RAG
      </Link>
    </div>
  );
}
