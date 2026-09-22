import { Where } from 'chromadb';
import { config } from '../config';
import { createEmbeddings } from '../llm/ollamaEmbeddings';
import { getCollection } from './chromaClient';
import { Document } from '@langchain/core/documents';
import { RetrievedDoc } from '../interfaces/retrievedDoc';

export async function retrieve(
  query: string,
  k?: number | undefined,
  filter?: Where
) {
  const topK = k ?? config.retrieval.k;
  const embeddings = createEmbeddings();
  const queryEmb = await embeddings.embedQuery(query);
  const collection = await getCollection();
  const results = await collection.query({
    queryEmbeddings: [queryEmb],
    nResults: topK,
    include: ['documents', 'metadatas', 'distances'],
    where: filter
  });

  let retrieved: RetrievedDoc[] = [];
  results.documents[0].forEach((text, index) => {
    retrieved.push({
      document: new Document({
        pageContent: text ?? '',
        metadata: results.metadatas[0][index] ?? {}
      }),
      distance: results.distances?.[0]?.[index] ?? Infinity
    });
  });

  return retrieved;
}

const isMain = process.argv[1]?.endsWith('retriever.ts');
if (isMain)
  retrieve(
    "Why does Raskolnikov confess despite Porfiry's investigation?"
  ).then(console.log);
