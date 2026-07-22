import { Document } from '@langchain/core/documents';

export interface RetrievedDoc {
  document: Document;
  distance: number;
}
