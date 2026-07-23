import * as readline from 'node:readline';
import * as fs from 'fs';
import * as path from 'path';
import { runQuery } from '../src/graph/bookGraph';

export async function runEval() {
  const filePath = path.resolve('./eval/', 'questions.jsonl');
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });
  let summary = [];
  for await (const line of rl) {
    if (!line.trim() || line.startsWith('//')) continue;
    let q;
    try {
      q = JSON.parse(line);
    } catch (error) {
      console.log(line);
      console.error('invalid JSONL line');
      continue;
    }
    const { id, query, expectedKeywords } = q;
    const result = await runQuery(query);

    const keywordPass = expectedKeywords.every((kw: string) =>
      result.answer.includes(kw)
    );
    const citationPass = result.citations.length > 0;
    const retryCount = result.retryCount;

    summary.push({ id, keywordPass, citationPass, retryCount });
  }
  summary.forEach((item) => console.log(item, '\n\n'));

// Group by type
const byType = {
  fact: summary.filter(r => r.id.startsWith('fact-')),
  quote: summary.filter(r => r.id.startsWith('quote-')),
  analysis: summary.filter(r => r.id.startsWith('analysis-'))
};

// Calculate stats for each type
const stats = Object.entries(byType).map(([type, typeResults]) => {
  const keywordPass = typeResults.filter(r => r.keywordPass).length;
  const citationPass = typeResults.filter(r => r.citationPass).length;
  const total = typeResults.length;
  
  return {
    type,
    keywordPass: `${keywordPass}/${total} (${Math.round(keywordPass / total * 100)}%)`,
    citationPass: `${citationPass}/${total} (${Math.round(citationPass / total * 100)}%)`
  };
});

// Overall stats
const totalKeywordPass = summary.filter(r => r.keywordPass).length;
const totalCitationPass = summary.filter(r => r.citationPass).length;
const total = summary.length;

// Retry distribution
const retryDist = {
  0: summary.filter(r => r.retryCount === 0).length,
  1: summary.filter(r => r.retryCount === 1).length,
  2: summary.filter(r => r.retryCount === 2).length
};

// Print report
console.log('=== EVAL REPORT ===');
console.log(`Total: ${total} questions\n`);
console.log('By type:');
stats.forEach(s => {
  console.log(`  ${s.type}: ${s.keywordPass} keyword, ${s.citationPass} citation`);
});
console.log(`\nOverall: ${totalKeywordPass}/${total} keyword (${Math.round(totalKeywordPass/total*100)}%), ${totalCitationPass}/${total} citation (${Math.round(totalCitationPass/total*100)}%)`);
console.log('\nRetry distribution:');
console.log(`  0 retries: ${retryDist[0]}`);
console.log(`  1 retry: ${retryDist[1]}`);
console.log(`  2 retries: ${retryDist[2]}`);
  
}

const isMain = process.argv[1]?.endsWith('runEval.ts');
if (isMain) runEval();
