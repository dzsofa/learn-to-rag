import { ChromaClient } from 'chromadb';
import { config } from '../config';
import { chunkChapters } from './chunker';
import { parseGutenbergHtml } from './parseGutenbergHtml';
import { createEmbeddings } from '../llm/ollamaEmbeddings';

export async function indexToChroma() {
  const chapters = parseGutenbergHtml('data/raw/crime-and-punishment.html');
  const docs = chunkChapters(chapters, config.ingest.chunkSize, 1);

  const embeddings = createEmbeddings();
  const client = new ChromaClient({
    host: config.chroma.host,
    port: config.chroma.port,
    ssl: config.chroma.ssl
  });
  const collection = await client.getOrCreateCollection({
    name: config.chroma.collection
  });

  const BATCH = 50;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    const texts = batch.map((data) => data.pageContent);

    // Truncate oversized chunks before embedding
    const truncatedTexts = texts.map((t) =>
      t.length > 2000 ? t.slice(0, 2000) + '…' : t
    );

    // embed
    const vectors = await embeddings.embedDocuments(truncatedTexts);

    // build ids
    const ids = batch.map((_, j) => `doc-${i + j}`);

    console.log(`indexed ${Math.min(i + BATCH, docs.length)} / ${docs.length}`);
    // upsert
    const metadatas = batch.map(
      (d) => d.metadata as Record<string, string | number | boolean>
    );
    await collection.upsert({
      ids,
      embeddings: vectors,
      documents: truncatedTexts,
      metadatas
    });
  }
}

indexToChroma();
