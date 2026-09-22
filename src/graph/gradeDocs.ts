import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from '../llm/ollamaChat';
import { GraphState } from './state';
import { RetrievedDoc } from '../interfaces/retrievedDoc';

export async function gradeDocsNode(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
if (state.intent === 'quote' || state.intent === 'fact') {
  return { docs: state.docs.slice(0, 5) }; // best 5 by vector distance, no grading
}
  const chat = createChatModel();
  const scored: Array<{ doc: RetrievedDoc; score: number }> = [];

  for (const doc of state.docs) {
    const { chapterIndex, paraStart, paraEnd } = doc.document.metadata;
    const passage = `(Ch. ${chapterIndex}, para ${paraStart}-${paraEnd})\n${doc.document.pageContent}`;

    const result = await chat.invoke([
      new SystemMessage(`
        You are grading the relevance of a passage to a question.
        Rate the passage using ONLY a single digit:
        0 = unrelated to the question
        1 = partially relevant (touches the topic but does not answer directly)
        2 = directly answers the question
        Respond with ONLY the digit. No explanation.
        `),
      new HumanMessage(`Question: ${state.query}\n\nPassage:\n${passage}`)
    ]);

    // The model might return "2" or "2 - because..." — take the first character.
    const score = parseInt(String(result.content).trim()[0], 10);
    scored.push({ doc, score: isNaN(score) ? 0 : score });
  }

  // Sort best-first, keep top 8 for analysis (breadth matters for synthesis).
  // Never drop everything.
  const reranked = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s) => s.doc);

  return { docs: reranked };
}
