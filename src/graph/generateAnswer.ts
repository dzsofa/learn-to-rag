import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from '../llm/ollamaChat';
import { GraphState } from './state';

export async function generateAnswer(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const retrievedDocs = state.docs.map((doc) => {
    return `[Ch.${doc.document.metadata.chapterIndex} ${doc.document.metadata.chapterTitle} para ${doc.document.metadata.paraStart}-${doc.document.metadata.paraEnd}]
    \n${doc.document.pageContent}`;
  });

  const chat = createChatModel();
  const result = await chat.invoke([
    new SystemMessage(`You are a literary assistant answering questions about Crime and Punishment.
        Use ONLY the provided passages to answer. Cite each passage you use as (Ch. X, para Y–Z).
        If the passages don't contain enough information, say so.`),
    new HumanMessage(`${state.query}\n\n${retrievedDocs.join('\n\n')}`)
  ]);
  const answer = String(result.content);
  const citations = [
    ...(new Set(answer.match(/\(Ch\. \d+, para \d+[-–]\d+\)/g)) ?? [])
  ];

  return { answer, citations };
}
