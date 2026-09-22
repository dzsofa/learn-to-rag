/**
 * diagnoseAnalysis.ts — inspect ONE question node-by-node.
 *
 * This is the book graph "unrolled" into a straight line so we can print the
 * state after every node. It mirrors the real edges in bookGraph.ts exactly:
 *   intentRouter → queryRewrite → retrieve → gradeDocs → generateAnswer
 * (We stop before verifyCitations — that node only decides whether to retry.)
 *
 * Usage (from the repo root, on your machine with Ollama + Chroma running):
 *   pnpm tsx eval/diagnoseAnalysis.ts analysis-06
 *   pnpm tsx eval/diagnoseAnalysis.ts "Why does Raskolnikov confess?"   // raw query
 *
 * If you pass a question id (e.g. analysis-06) it is looked up in
 * questions.jsonl so we also know the expected keywords and can show which
 * ones the answer missed. Pass a raw string to probe an ad-hoc question.
 */
import * as fs from 'fs';
import * as path from 'path';
import { GraphState } from '../src/graph/state';
import { intentRouter } from '../src/graph/intentRouter';
import { queryRewriteNode } from '../src/graph/queryRewriteNode';
import { retrieveNode } from '../src/graph/retrieveNode';
import { gradeDocsNode } from '../src/graph/gradeDocs';
import { generateAnswer } from '../src/graph/generateAnswer';
import { allKeywordsHit, keywordHit } from './scoringUtils';

type State = typeof GraphState.State;

// A fully-populated starting state (every field has a value so the node
// functions never hit `undefined`).
function emptyState(query: string): State {
  return {
    query,
    rewrittenQueries: [],
    intent: 'fact',
    docs: [],
    answer: '',
    citations: [],
    retryCount: 0
  };
}

function lookupQuestion(idOrQuery: string): {
  query: string;
  expectedKeywords: string[];
} {
  const readPath = path.resolve('./eval/', 'questions.jsonl');
  const lines = fs.readFileSync(readPath, 'utf-8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('//')) continue;
    const q = JSON.parse(t);
    if (q.id === idOrQuery) {
      return { query: q.query, expectedKeywords: q.expectedKeywords ?? [] };
    }
  }
  // Not an id — treat the argument as a raw query with no expected keywords.
  return { query: idOrQuery, expectedKeywords: [] };
}

function refOf(doc: { document: { metadata: Record<string, unknown> } }): string {
  const m = doc.document.metadata;
  return `Ch. ${m.chapterIndex}, para ${m.paraStart}–${m.paraEnd}`;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Pass a question id (e.g. analysis-06) or a raw query string.');
    process.exit(1);
  }

  const { query, expectedKeywords } = lookupQuestion(arg);
  console.log('='.repeat(70));
  console.log('QUERY:', query);
  if (expectedKeywords.length) console.log('EXPECTED KEYWORDS:', expectedKeywords.join(', '));
  console.log('='.repeat(70));

  let state = emptyState(query);

  // ── Node 1: intent ──────────────────────────────────────────────────
  state = { ...state, ...intentRouter(state) };
  console.log(`\n[1] intent = ${state.intent}`);

  // ── Node 2: query rewrite (analysis only) ───────────────────────────
  state = { ...state, ...(await queryRewriteNode(state)) };
  console.log(`\n[2] sub-queries (${state.rewrittenQueries.length}):`);
  state.rewrittenQueries.forEach((q) => console.log('    -', q));

  // ── Node 3: retrieve (before grading) ───────────────────────────────
  state = { ...state, ...(await retrieveNode(state)) };
  console.log(`\n[3] retrieved ${state.docs.length} docs (pre-grade):`);
  state.docs.forEach((d, i) =>
    console.log(
      `    ${String(i).padStart(2)}. dist=${d.distance.toFixed(3)}  ${refOf(d)}  ::  ${d.document.pageContent.slice(0, 90).replace(/\s+/g, ' ')}…`
    )
  );

  const preGradeRefs = new Set(state.docs.map(refOf));

  // ── Node 4: grade + rerank ──────────────────────────────────────────
  state = { ...state, ...(await gradeDocsNode(state)) };
  console.log(`\n[4] kept ${state.docs.length} docs (post-grade, best first):`);
  state.docs.forEach((d, i) => console.log(`    ${i}. ${refOf(d)}`));
  const dropped = [...preGradeRefs].filter(
    (r) => !state.docs.some((d) => refOf(d) === r)
  );
  if (dropped.length) console.log('    dropped by grader:', dropped.join(' | '));

  // ── Node 5: generate answer + extract citations ─────────────────────
  state = { ...state, ...(await generateAnswer(state)) };
  console.log('\n[5] ANSWER:\n');
  console.log(state.answer);
  console.log('\n    citations:', state.citations.length ? state.citations.join(' | ') : '(none)');

  // ── Verdict ─────────────────────────────────────────────────────────
  if (expectedKeywords.length) {
    const missing = expectedKeywords.filter((k) => !keywordHit(state.answer, k));
    console.log('\n' + '='.repeat(70));
    console.log('keyword pass:', allKeywordsHit(state.answer, expectedKeywords));
    if (missing.length) console.log('MISSING keywords:', missing.join(', '));
    console.log(
      'Ask yourself: is a passage containing the missing idea present in [3]?\n' +
        '  - present but not in answer  -> generation problem (prompt)\n' +
        '  - absent from [3] entirely   -> retrieval problem (chunking / k / rewrite)\n' +
        '  - answer covers it as synonym -> scoring artifact (add an alias)'
    );
  }
}

main().catch(console.error);
