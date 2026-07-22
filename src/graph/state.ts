import { Annotation } from '@langchain/langgraph';
import { RetrievedDoc } from '../interfaces/retrievedDoc';
import { Intent } from "../interfaces/intent";

export const GraphState = Annotation.Root({
  query: Annotation<string>(),
  intent: Annotation<Intent>(),
  docs: Annotation<RetrievedDoc[]>({
    reducer: (_, next) => next,
    default: () => []
  }),
  answer: Annotation<string>(),
  citations: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => []
  }),
  retryCount: Annotation<number>({
    reducer: (currentValue, newValue) => currentValue + newValue,
    default: () => 0
  })
});
