import { IndexFlatL2 } from "faiss-node";
import path from "path";
import fs from "fs";

const INDEX_PATH = path.join(process.cwd(), "data", "faiss.index");
const DIMENSION = 1536; // OpenAI text-embedding-3-small dimension

let indexInstance: IndexFlatL2 | null = null;

export function getIndex(): IndexFlatL2 {
  if (!indexInstance) {
    if (fs.existsSync(INDEX_PATH)) {
      // Load existing index from disk
      indexInstance = IndexFlatL2.read(INDEX_PATH);
    } else {
      // Create new index
      indexInstance = new IndexFlatL2(DIMENSION);
    }
  }
  return indexInstance;
}

export function addVectors(vectors: number[][]): void {
  const index = getIndex();

  // Convert 2D array to flattened array
  const flatArray: number[] = [];
  vectors.forEach((vector) => {
    flatArray.push(...vector);
  });

  index.add(flatArray);
}

export function searchVectors(
  queryVector: number[],
  k: number = 5
): { distances: number[]; ids: number[] } {
  const index = getIndex();

  // Limit k to the number of vectors in the index
  const indexSize = index.ntotal();
  const actualK = Math.min(k, indexSize);

  if (actualK === 0) {
    return { distances: [], ids: [] };
  }

  const result = index.search(queryVector, actualK);

  // FAISS returns "labels" but they're really vector indices/IDs
  return {
    distances: Array.from(result.distances),
    ids: Array.from(result.labels).map(Number),
  };
}

export function saveIndex(): void {
  const index = getIndex();

  // Ensure data directory exists
  const dataDir = path.dirname(INDEX_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  index.write(INDEX_PATH);
}

export function getIndexSize(): number {
  const index = getIndex();
  return index.ntotal();
}
