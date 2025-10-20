export interface DocumentChunk {
  id: number;
  documentName: string;
  text: string;
  chunkIndex: number;
  createdAt: number;
}

export interface DocumentMetadata {
  documentName: string;
  totalChunks: number;
  createdAt: number;
}

export interface SearchResult {
  id: number;
  text: string;
  documentName: string;
  distance: number;
  chunkIndex: number;
}
