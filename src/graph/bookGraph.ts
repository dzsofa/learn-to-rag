import { END, START, StateGraph } from '@langchain/langgraph';
import { GraphState } from './state';
import { verifyCitations } from './verifyCitations';
import { intentRouter } from './intentRouter';
import { retrieveNode } from './retrieveNode';
import { generateAnswer } from './generateAnswer';
import { config } from '../config';
import { gradeDocsNode } from './gradeDocs';

export const bookGraph = new StateGraph(GraphState)
  .addNode('intentRouter', intentRouter)
  .addNode('retrieveNode', retrieveNode)
  .addNode('gradeDocsNode', gradeDocsNode)
  .addNode('generateAnswer', generateAnswer)
  .addNode('verifyCitations', verifyCitations)
  .addEdge(START, 'intentRouter')
  .addEdge('intentRouter', 'retrieveNode')
  .addEdge('retrieveNode', 'gradeDocsNode')
  .addEdge('gradeDocsNode', 'generateAnswer')
  .addEdge('generateAnswer', 'verifyCitations')
  .addConditionalEdges('verifyCitations', routeByCitations, {
    end: END,
    retry: 'retrieveNode'
  })
  .compile();

export const runQuery = async (query: string) => {
  const result = await bookGraph.invoke({ query });
  return result;
};

function routeByCitations(state: typeof GraphState.State): 'end' | 'retry' {
  if (state.citations.length === 0) {
    return state.retryCount < config.graph.maxRetries ? 'retry' : 'end';
  } else {
    return 'end';
  }
}

const isMain = process.argv[1]?.endsWith('bookGraph.ts');
if (isMain) {
  runQuery('Who is Raskolnikov?')
    .then((result) => {
      console.log('Answer:', result.answer);
      console.log('Citations:', result.citations);
    })
    .catch(console.error);
}
