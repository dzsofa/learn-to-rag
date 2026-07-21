// config.ts — single source of truth for all runtime settings.
//
// `import "dotenv/config"` reads the .env file and merges it into
// process.env before we call getStr/getInt below.
import "dotenv/config";

function getStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function getInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n)) throw new Error(`${key} must be an integer, got: "${raw}"`);
  return n;
}

export const config = {
  ollama: {
    baseUrl: getStr('OLLAMA_BASE_URL', 'http://localhost:11434'),
    chatModel: getStr('OLLAMA_CHAT_MODEL', 'llama3.2'),
    embeddingModel: getStr('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text')
  },
  chroma: {
    url: getStr('CHROMA_URL', 'http://localhost:8000'),
    collection: getStr('CHROMA_COLLECTION', 'crime-and-punishment')
  },
  ingest: {
    bookHtmlPath: getStr(
      'BOOK_HTML_PATH',
      'data/raw/crime-and-punishment.html'
    ),
    chunkSize: getInt('CHUNK_SIZE', 800),
    chunkOverlap: getInt('CHUNK_OVERLAP', 100)
  },
  retrieval: {
    k: getInt('RETRIEVAL_K', 5)
  },
  graph: {
    maxRetries: getInt('MAX_RETRIES', 2)
  }
} as const;
