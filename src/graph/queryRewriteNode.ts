import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from '../llm/ollamaChat';
import { GraphState } from './state';

export async function queryRewriteNode(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  // Only analysis questions benefit from multi-query expansion.
  // Fact and quote questions are handled well by a single vector search.
  if (state.intent !== 'analysis') return {};

  // On retry the rewriting already ran once. Re-running it would produce the
  // same sub-queries and retrieve the same chunks. Skip it so the retry uses
  // the original query directly — a different angle on the same content.
  if (state.retryCount > 0) return {};

  const chat = createChatModel();

  const result = await chat.invoke([
    new SystemMessage(
      `You are expanding a literary question into search queries.
Generate 2–3 short search queries that together cover all aspects of the answer.
Each query should use different vocabulary and focus on a different angle or part of the novel.
Output ONLY the queries, one per line. No numbering, no bullets, no explanation.`
    ),
    new HumanMessage(`Question: ${state.query}`),
  ]);

  const raw = String(result.content).trim();

  const rewrittenQueries = raw
    .split('\n')
    .map((line) => line.trim())
    // Strip leading "1. " / "2) " / "- " / "* " that models sometimes add
    .map((line) => line.replace(/^[\d]+[.)]\s*/, '').replace(/^[-*•]\s*/, ''))
    .filter((line) => line.length > 10); // discard blank lines or stray junk

  return { rewrittenQueries };
}
