import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from '../llm/ollamaChat';
import { GraphState } from './state';

export async function generateAnswer(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const retrievedDocs = state.docs.map((doc) => {
    const chapterIndex = doc.document.metadata.chapterIndex;
    const paraStart = doc.document.metadata.paraStart;
    const paraEnd = doc.document.metadata.paraEnd;
    return `(Ch. ${chapterIndex}, para ${paraStart}-${paraEnd})\n${doc.document.pageContent}`;
  });

  const chat = createChatModel();
  const result = await chat.invoke([
    new SystemMessage(`You are a literary assistant answering questions about Crime and Punishment.
        Use ONLY the provided passages to answer. 
        Cite each passage you use as (Ch. X, para Y–Z).
        Always use exactly this format. No other formats.
        Example:
        Question: Who is Sonia?
        Answer: Sonia is a kind woman who helps others (Ch. 3, para 40-42) and is deeply compassionate (Ch. 5, para 100-105).
        If the passages don't contain enough information, say so.`),
    new HumanMessage(`${state.query}\n\n${retrievedDocs.join('\n\n')}`)
  ]);
  const answer = String(result.content);
  const citations = [
    ...(new Set(answer.match(/\(Ch\. \d+, para \d+[-–]\d+\)/g)) ?? [])
  ];

  return { answer, citations };
}
