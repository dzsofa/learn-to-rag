import { GraphState } from './state';

export function verifyCitations(
  state: typeof GraphState.State
): Partial<typeof GraphState.State> {
  const citations = state.citations;

  if ((citations.length === 0)) {
    return { retryCount: 1 };
  } else {
    return {};
  }
}
