import * as readline from 'node:readline';
import * as fs from 'fs';
import * as path from 'path';
import { runQuery } from '../src/graph/bookGraph';

export async function runEval(questionsFile = 'questions.dev.jsonl') {
  const readPath = path.resolve('./eval/', questionsFile);
  // Tag the run filename with the set (dev/test) so runs can't be confused.
  // "questions.dev.jsonl" -> "dev", "questions.test.jsonl" -> "test".
  const setTag = questionsFile.replace(/^questions\.?/, '').replace(/\.jsonl$/, '') || 'dev';
  const writePath = path.resolve('./eval/runs/', `${setTag}-${Date.now()}.jsonl`);
  const rl = readline.createInterface({
    input: fs.createReadStream(readPath, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });

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
    const { id, type, query, expectedKeywords } = q;
    const result = await runQuery(query);

    const evalJSON = fs.createWriteStream(writePath, { flags: 'a' });
    evalJSON.write(
      JSON.stringify({
        id,
        type,
        query,
        expectedKeywords,
        answer: result.answer,
        retryCount: result.retryCount,
        citations: result.citations
      }) + '\n'
    );
  }
}

const isMain = process.argv[1]?.endsWith('runEval.ts');
if (isMain) runEval(process.argv[2]);
