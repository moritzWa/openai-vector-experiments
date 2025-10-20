export interface ChunkOptions {
  chunkSize?: number; // words per chunk
  overlap?: number;   // words of overlap between chunks
}

const DEFAULT_CHUNK_SIZE = 500;  // words
const DEFAULT_OVERLAP = 50;      // words

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = options;

  // Split into words (simple whitespace split)
  const words = text.split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) return [];
  if (words.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + chunkSize, words.length);
    const chunkWords = words.slice(startIndex, endIndex);
    chunks.push(chunkWords.join(' '));

    // Move to next chunk with overlap
    startIndex += chunkSize - overlap;

    // Prevent infinite loop if overlap >= chunkSize
    if (startIndex <= chunks.length * (chunkSize - overlap) - chunkSize) {
      startIndex = chunks.length * (chunkSize - overlap);
    }
  }

  return chunks;
}
