import * as readline from 'node:readline/promises';
import { runQuery } from '../graph/bookGraph';

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(
    `This is your library assistant to get information about Fyodor Dostoyevsky's Crime and Punishment. You can ask questions and I will provide answers based on the content of the book with citations,`
  );
  while (true) {
    const line = await rl.question('You: ');
    if (line.trim() === 'exit' || line.trim() === 'break') break;
    if (line.trim() === '') continue;
    const result = await runQuery(line);
    console.log('\n\n');
    console.log(result.answer);
    if (result.citations.length > 0) {
      console.log('\nSources:');
      result.citations.forEach((c) => console.log(`  ${c}`));
    }
  }

  rl.close();
}

main().catch(console.error);
