/**
 * diffEvals.ts — compare two eval run files question by question.
 *
 * Usage:  pnpm diff <runIdA> <runIdB>
 * Example: pnpm diff 1784809709307 1784821414953
 *
 * Shows which questions improved, which regressed, and which are still failing
 * in both runs. Useful after any change that requires re-indexing or re-running
 * the agent, since headline aggregate scores can hide individual movements.
 */
import * as readline from 'node:readline';
import * as fs from 'fs';
import * as path from 'path';
import { allKeywordsHit } from './scoringUtils';

interface RawEntry {
  id: string;
  type: string;
  query: string;
  expectedKeywords: string[];
  answer: string;
  citations: string[];
  retryCount: number;
}

interface ScoredEntry {
  id: string;
  type: string;
  query: string;
  keywordPass: boolean;
  citationPass: boolean;
  retryCount: number;
}

async function loadAndScore(runId: string): Promise<Map<string, ScoredEntry>> {
  const filePath = path.resolve('./eval/runs/', `${runId}.jsonl`);
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });

  const map = new Map<string, ScoredEntry>();
  for await (const line of rl) {
    if (!line.trim() || line.startsWith('//')) continue;
    try {
      const e: RawEntry = JSON.parse(line);
      map.set(e.id, {
        id: e.id,
        type: e.type,
        query: e.query,
        keywordPass: allKeywordsHit(e.answer, e.expectedKeywords),
        citationPass: e.citations.length > 0,
        retryCount: e.retryCount
      });
    } catch {
      console.error('Skipping invalid JSONL line');
    }
  }
  return map;
}

/** Returns a direction string for one metric, or '–' if unchanged. */
function delta(was: boolean, now: boolean): string {
  if (was === now) return '–';
  return was ? 'PASS→FAIL' : 'FAIL→PASS';
}

export async function diffEvals(runIdA: string, runIdB: string) {
  const [runA, runB] = await Promise.all([loadAndScore(runIdA), loadAndScore(runIdB)]);

  const ids = [...new Set([...runA.keys(), ...runB.keys()])].sort();

  // Partition questions into three buckets.
  const changed: Array<[ScoredEntry, ScoredEntry]> = [];
  const stillFailing: ScoredEntry[] = [];

  for (const id of ids) {
    const a = runA.get(id);
    const b = runB.get(id);
    if (!a || !b) {
      console.warn(`  ${id}: present in only one run, skipping`);
      continue;
    }

    if (a.keywordPass !== b.keywordPass || a.citationPass !== b.citationPass) {
      changed.push([a, b]);
    } else if (!a.keywordPass || !a.citationPass) {
      stillFailing.push(a); // unchanged and still has at least one failure
    }
  }

  const aKw = [...runA.values()].filter((e) => e.keywordPass).length;
  const bKw = [...runB.values()].filter((e) => e.keywordPass).length;
  const aCit = [...runA.values()].filter((e) => e.citationPass).length;
  const bCit = [...runB.values()].filter((e) => e.citationPass).length;
  const total = runA.size;

  // ── Header ─────────────────────────────────────────────────────────────────
  console.log('=== EVAL DIFF ===');
  console.log(`Run A: ${runIdA}  (${aKw}/${total} kw, ${aCit}/${total} cit)`);
  console.log(`Run B: ${runIdB}  (${bKw}/${total} kw, ${bCit}/${total} cit)\n`);

  // ── Changed questions ───────────────────────────────────────────────────────
  if (changed.length === 0) {
    console.log('No questions changed between runs.\n');
  } else {
    console.log(`CHANGED QUESTIONS (${changed.length} of ${total}):\n`);
    const COL = { id: 15, kw: 13, cit: 13, ret: 9 };
    console.log(
      `  ${'ID'.padEnd(COL.id)}${'KEYWORD'.padEnd(COL.kw)}${'CITATION'.padEnd(COL.cit)}${'RETRIES'.padEnd(COL.ret)}QUERY`
    );
    console.log(`  ${'─'.repeat(70)}`);

    for (const [a, b] of changed) {
      const kwStr = delta(a.keywordPass, b.keywordPass).padEnd(COL.kw);
      const citStr = delta(a.citationPass, b.citationPass).padEnd(COL.cit);
      const retStr =
        a.retryCount === b.retryCount
          ? String(a.retryCount).padEnd(COL.ret)
          : `${a.retryCount}→${b.retryCount}`.padEnd(COL.ret);
      const querySnippet = a.query.length > 45 ? a.query.slice(0, 44) + '…' : a.query;
      console.log(`  ${a.id.padEnd(COL.id)}${kwStr}${citStr}${retStr}"${querySnippet}"`);
    }
    console.log();
  }

  // ── Still failing ───────────────────────────────────────────────────────────
  if (stillFailing.length > 0) {
    console.log(`STILL FAILING IN BOTH RUNS (${stillFailing.length} questions):\n`);
    console.log(`  ${'ID'.padEnd(15)}KW   CIT  RETRIES  QUERY`);
    console.log(`  ${'─'.repeat(65)}`);
    for (const e of stillFailing) {
      const kw = e.keywordPass ? '✓' : '✗';
      const cit = e.citationPass ? '✓' : '✗';
      const querySnippet = e.query.length > 40 ? e.query.slice(0, 39) + '…' : e.query;
      console.log(`  ${e.id.padEnd(15)}${kw}    ${cit}    ${String(e.retryCount).padEnd(9)}"${querySnippet}"`);
    }
    console.log();
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const kwImproved = changed.filter(([a, b]) => !a.keywordPass && b.keywordPass).length;
  const kwRegressed = changed.filter(([a, b]) => a.keywordPass && !b.keywordPass).length;
  const citImproved = changed.filter(([a, b]) => !a.citationPass && b.citationPass).length;
  const citRegressed = changed.filter(([a, b]) => a.citationPass && !b.citationPass).length;
  const kwNet = bKw - aKw;
  const citNet = bCit - aCit;

  console.log('SUMMARY:');
  console.log(
    `  keyword:  ${aKw}/${total} → ${bKw}/${total}  ` +
      `(+${kwImproved} improved, -${kwRegressed} regressed, net ${kwNet >= 0 ? '+' : ''}${kwNet})`
  );
  console.log(
    `  citation: ${aCit}/${total} → ${bCit}/${total}  ` +
      `(+${citImproved} improved, -${citRegressed} regressed, net ${citNet >= 0 ? '+' : ''}${citNet})`
  );
}

const isMain = process.argv[1]?.endsWith('diffEvals.ts');
if (isMain) {
  const [runIdA, runIdB] = process.argv.slice(2);
  if (!runIdA || !runIdB) {
    console.error('Usage: pnpm diff <runIdA> <runIdB>');
    process.exit(1);
  }
  diffEvals(runIdA, runIdB);
}
