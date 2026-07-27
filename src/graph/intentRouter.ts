import { Intent } from '../interfaces/intent';
import { GraphState } from './state';

export function intentRouter(
  state: typeof GraphState.State
): Partial<typeof GraphState.State> {
  let detectedIntent = '';
  const quote = [
    'passage',
    'quote',
    'said',
    'wrote',
    'scene where',
    'find where',
    'cite',
    ' say ',
    ' says '
  ];
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
    'What themes appear in the epilogue?',
    'Find where Sonya urges Raskolnikov to confess',
    'Find where the pawnbroker is described',
    'What does Raskolnikov say about morality?',
    "Cite a passage about Raskolnikov's theory",
    'Find a passage where Raskolnikov feels remorse'
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
