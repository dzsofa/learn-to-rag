import { retrieve } from '../rag/retriever';
import { GraphState } from './state';
import { RetrievedDoc } from '../interfaces/retrievedDoc';

export async function retrieveNode(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  // Fall back to single retrieval when:
  // - no sub-queries were generated (fact/quote intent), OR
  // - this is a retry pass (rewrittenQueries still set from first pass, but
  //   running the same multi-query again would return identical results)
  if (state.rewrittenQueries.length === 0 || state.retryCount > 0) {
    const result = await retrieve(state.query);
    return { docs: result };
  }

  // Multi-query: retrieve for the original query AND each sub-query in parallel.
  // Running in parallel keeps latency close to a single retrieve call.
  const queries = [state.query, ...state.rewrittenQueries];
  const allResults = await Promise.all(queries.map((q) => retrieve(q)));

  // Flatten and deduplicate by (chapterIndex, paraStart, paraEnd).
  // When the same chunk appears in multiple result sets, keep the entry
  // with the lowest (best) distance score.
  const seen = new Map<string, RetrievedDoc>();
  for (const results of allResults) {
    for (const doc of results) {
      const { chapterIndex, paraStart, paraEnd } = doc.document.metadata;
      const key = `${chapterIndex}:${paraStart}:${paraEnd}`;
      const existing = seen.get(key);
      if (!existing || doc.distance < existing.distance) {
        seen.set(key, doc);
      }
    }
  }

  // Sort the merged set by distance so the grader sees best matches first.
  const merged = Array.from(seen.values()).sort((a, b) => a.distance - b.distance);
  return { docs: merged };
}
