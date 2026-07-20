// ollamaChat.ts — factory for the chat/generation model.
//
// A "chat model" takes [SystemMessage, HumanMessage, …] and returns
// an AIMessage. ChatOllama is LangChain's thin adapter over Ollama's
// /api/chat endpoint — no API key, everything stays local.
//
// We keep temperature low (0.1) for factual Q&A; set it higher if you
// want more varied phrasing in answers.
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config';

export function createChatModel(opts: { temperature?: number } = {}) {
  return new ChatOllama({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.chatModel,
    temperature: opts.temperature ?? 0.1
  });
}
