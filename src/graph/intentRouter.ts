import { analysis, analysisPatterns } from '../constants/analysis';
import { quote, quotePatterns } from '../constants/quote';
import { Intent } from '../interfaces/intent';
import { GraphState } from './state';

export function intentRouter(
  state: typeof GraphState.State
): Partial<typeof GraphState.State> {
  const q = state.query.toLowerCase().replace(/\s+/g, ' ').trim();

  const isQuote =
    quote.some((kw) => q.includes(kw)) ||
    quotePatterns.some((rx) => rx.test(q));

  const isAnalysis =
    analysis.some((kw) => q.includes(kw)) ||
    analysisPatterns.some((rx) => rx.test(q));

  let detectedIntent: 'quote' | 'analysis' | 'fact' = 'fact';

  // precedence: quote usually should beat analysis if both match
  if (isQuote) detectedIntent = 'quote';
  else if (isAnalysis) detectedIntent = 'analysis';

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
    'Find a passage where Raskolnikov feels remorse',
    'How does Raskolnikov achieve redemption?'
  ];

  tests.forEach((test) => {
    const result = intentRouter({
      query: test,
      rewrittenQueries: [],
      intent: 'fact',
      docs: [],
      answer: '',
      citations: [],
      retryCount: 0
    });
    console.log(`"${test}" → ${result.intent}`);
  });
}
