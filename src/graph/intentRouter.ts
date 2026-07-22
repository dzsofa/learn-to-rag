import { StateGraph } from '@langchain/langgraph';
import { Intent } from '../interfaces/intent';
import { GraphState } from './state';

export function intentRouter(
  state: typeof GraphState.State
): Partial<typeof GraphState.State> {
  let detectedIntent = '';
  const quote = ['passage', 'quote', 'said', 'wrote', 'scene where'];
  const analysis = [
    'theme',
    'symbol',
    'why does',
    'what does',
    'represent',
    'significance',
    'analyze',
    'compare'
  ];

  if (quote.some((kw) => state.query.includes(kw))) {
    detectedIntent = 'quote';
  } else if (analysis.some((kw) => state.query.includes(kw))) {
    detectedIntent = 'analysis';
  } else {
    detectedIntent = 'fact';
  }

  return { intent: detectedIntent as Intent };
}

const isMain = process.argv[1]?.endsWith('intentRouter.ts');
if (isMain) {
  const tests = [
    'Who is Raskolnikov?',
    'Find a passage where Raskolnikov visits the pawnbroker',
    'What themes appear in the epilogue?'
  ];

  tests.forEach((test) => {
    const result = intentRouter({
      query: test,
      intent: 'fact',
      docs: [],
      answer: '',
      citations: [],
      retryCount: 0
    });
    console.log(`"${test}" → ${result.intent}`);
  });
}
