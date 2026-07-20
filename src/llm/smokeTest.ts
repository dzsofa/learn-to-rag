// smokeTest.ts — verifies Ollama is reachable and both models work.
// Run with: pnpm smoke
import { HumanMessage } from '@langchain/core/messages';
import { config } from '../config';
import { createChatModel } from './ollamaChat';
import { createEmbeddings } from './ollamaEmbeddings';

async function main() {
  console.log('Config:');
  console.log(`  chat model : ${config.ollama.chatModel}`);
  console.log(`  embed model: ${config.ollama.embeddingModel}`);
  console.log(`  base URL   : ${config.ollama.baseUrl}\n`);

  // 1. Chat model
  console.log('1. Testing chat model…');
  try {
    const t0 = Date.now();
    const chat = createChatModel({ temperature: 0 });
    const res = await chat.invoke([
      new HumanMessage('Reply with exactly: "smoke test OK"')
    ]);
    console.log(`   ✓ ${res.content}  (${Date.now() - t0}ms)\n`);
  } catch (e) {
    console.error(`   ✗ failed: ${e}`);
    console.error(`   → Is Ollama running? Try: ollama serve`);
    console.error(
      `   → Model pulled?  Try: ollama pull ${config.ollama.chatModel}\n`
    );
    process.exit(1);
  }

  // 2. Embedding model
  console.log('2. Testing embedding model…');
  try {
    const t0 = Date.now();
    const emb = createEmbeddings();
    const vec = await emb.embedQuery('Crime and Punishment');
    console.log(
      `   ✓ vector length: ${vec.length}  first value: ${vec[0].toFixed(4)}  (${
        Date.now() - t0
      }ms)\n`
    );
  } catch (e) {
    console.error(`   ✗ failed: ${e}`);
    console.error(
      `   → Model pulled?  Try: ollama pull ${config.ollama.embeddingModel}\n`
    );
    process.exit(1);
  }

  console.log('All checks passed ✓');
  console.log(
    'Next: download Crime and Punishment HTML from Project Gutenberg → data/raw/'
  );
}

main().catch(console.error);
