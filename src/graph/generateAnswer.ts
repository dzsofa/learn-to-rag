import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from '../llm/ollamaChat';
import { GraphState } from './state';

export async function generateAnswer(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  // Label each passage with its source reference so the model knows where
  // content comes from, but don't ask it to embed citations yet — that is
  // the job of the second call below.
  const labelledPassages = state.docs.map((doc) => {
    const { chapterIndex, paraStart, paraEnd } = doc.document.metadata;
    return `[Source: Ch. ${chapterIndex}, para ${paraStart}–${paraEnd}]\n${doc.document.pageContent}`;
  });

  const chat = createChatModel();

  // ── Call 1: prose generation ──────────────────────────────────────────
  // The model focuses entirely on understanding and answering. No format
  // constraints on citations — it just writes a clear, grounded answer.
  const generationResult = await chat.invoke([
    new SystemMessage(
      `You are a literary assistant answering questions about Crime and Punishment.
Use ONLY the provided source passages to answer. Write naturally in complete sentences.
If the passages do not contain enough information to answer, say so clearly.`
    ),
    new HumanMessage(
      `Question: ${state.query}\n\n${labelledPassages.join('\n\n')}`
    ),
  ]);
  const answer = String(generationResult.content);

  // ── Call 2: citation extraction ───────────────────────────────────────
  // The model is given the answer it just wrote and the list of available
  // source references. Its only job is to output which references were used.
  // Temperature 0: this is deterministic extraction, not generation.
  const extractor = createChatModel({ temperature: 0 });

  // The available references, one per line — the model picks from this list.
  const availableRefs = state.docs
    .map((doc) => {
      const { chapterIndex, paraStart, paraEnd } = doc.document.metadata;
      return `Ch. ${chapterIndex}, para ${paraStart}–${paraEnd}`;
    })
    .join('\n');

  const citationResult = await extractor.invoke([
    new SystemMessage(
      `You extract source references from an answer.
Given an answer and a list of available source passages, output the references the answer drew from.
Rules:
- One reference per line, copied EXACTLY as it appears in the available list.
- Output ONLY the references. No labels, no explanation, no punctuation before or after.
- If the answer did not use any passage, output the single word: none`
    ),
    new HumanMessage(
      `Answer:\n${answer}\n\nAvailable sources:\n${availableRefs}`
    ),
  ]);

  const raw = String(citationResult.content).trim();

  // Parse each line; keep only lines that look like a chapter reference.
  // Handles both en-dash (–) and hyphen (-) since models vary.
  const CITATION_RE = /Ch\.\s*\d+,\s*para\s*\d+\s*[–—-]\s*\d+/;
  const citations =
    raw.toLowerCase() === 'none'
      ? []
      : Array.from(
          new Set(
            raw
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => CITATION_RE.test(line))
          )
        );

  return { answer, citations };
}
