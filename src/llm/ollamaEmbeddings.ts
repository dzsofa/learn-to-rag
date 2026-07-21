// ollamaEmbeddings.ts — factory for the embedding model.
//
// An embedding model converts text → a vector of floats.
// Semantically similar texts produce numerically close vectors,
// which is what enables "find passages about guilt" to work even
// when the exact word "guilt" doesn't appear in every matching chunk.
//
// nomic-embed-text → 768-dimensional vectors, fast, retrieval-optimised.
// Alternative: mxbai-embed-large → 1024-dim, higher quality but ~3× slower.
import { OllamaEmbeddings } from '@langchain/ollama';
import { config } from '../config';

export function createEmbeddings(): OllamaEmbeddings {
  return new OllamaEmbeddings({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.embeddingModel
  });
}
