import { retrieve } from '../rag/retriever';
import { GraphState } from './state';

export async function retrieveNode(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const query = state.query;
  const result = await retrieve(query);

  return {
    docs: result
  };
}
