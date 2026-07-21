import { ChromaClient, Collection } from 'chromadb';
import { config } from '../config';

let _collection: Collection | null = null;

export async function getCollection(): Promise<Collection> {
  if (_collection) return _collection;

  const client = new ChromaClient({
    host: config.chroma.host,
    port: config.chroma.port,
    ssl: config.chroma.ssl
  });
  const result = await client.getCollection({
    name: config.chroma.collection
  });

  _collection = result;
  return _collection;
}
