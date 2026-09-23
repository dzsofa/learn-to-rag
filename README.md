# Book RAG — Crime and Punishment

A RAG assistant over Dostoyevsky's *Crime and Punishment* (Project Gutenberg HTML), built as a TypeScript learning project for LangChain JS, LangGraph JS, and local LLMs via Ollama.

## Stack

| Layer | Tool |
|---|---|
| Language | TypeScript (Node.js, ESM) |
| Orchestration | LangGraph JS |
| RAG utilities | LangChain JS |
| LLM + embeddings | Ollama (`llama3.2` / `nomic-embed-text`) |
| Vector store | Chroma (local) |
| Package manager | pnpm |

## Hardware requirements

Everything runs locally — no cloud API needed. The bottleneck is the chat model (`llama3.2`, 3B parameters).

| Component | Minimum | Recommended |
|---|---|---|
| RAM | 8 GB | 16 GB |
| GPU VRAM | — (CPU-only works) | 4 GB+ (NVIDIA) or 8 GB+ (Apple Silicon) |
| Disk | 5 GB free | 8 GB free |
| OS | Windows 10/11, macOS 12+, Linux | — |

**Model sizes on disk:**

- `llama3.2` (3B, 4-bit quantised) — ~2.0 GB
- `nomic-embed-text` — ~274 MB
- Chroma index for this corpus — ~5 MB
- Node.js dependencies — ~500 MB

**What to expect without a GPU (CPU-only):**

Inference on CPU produces roughly 3–8 tokens/sec on a modern CPU (Intel i7/i9 or AMD Ryzen 5/7). Short grading calls (~20 tokens output) take ~5–10 s each. Because `analysis` questions run one grading call per retrieved document (up to ~20 docs after multi-query merge), expect **3–5 minutes per analysis query** on CPU only. `fact` and `quote` questions are faster (~30–60 s) since they skip LLM grading entirely.

**With a GPU:**

Ollama offloads all layers to the GPU when VRAM is sufficient. On an NVIDIA RTX 3060 (12 GB) or Apple M-series chip (8 GB+ unified memory), query latency drops to roughly **10–30 s** for analysis and **5–10 s** for fact/quote. Ollama handles GPU detection automatically — no code changes needed.

> If you only have CPU, start with `fact` and `quote` questions while learning; they give fast feedback. Run `pnpm eval` overnight if you want a full 30-question benchmark.

## Prerequisites

1. [Ollama](https://ollama.com) installed and running — pull the two required models:
   ```
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ollama serve
   ```
2. [Chroma](https://docs.trychroma.com) running locally:
   ```
   chroma run --path ./chroma-db
   ```
3. Node.js ≥ 18 and pnpm installed. (No `engines` field is set in `package.json`; the project is tested on v22.)

## Quick start

```bash
pnpm install
cp .env.example .env          # edit if your ports differ
# place crime-and-punishment.html in data/raw/
pnpm ingest                   # parse → chunk → embed → index into Chroma
pnpm chat                     # interactive CLI
```

## All commands

| Command | What it does |
|---|---|
| `pnpm smoke` | Verifies Ollama chat + embeddings are reachable |
| `pnpm ingest` | Parses the Gutenberg HTML, chunks it, and indexes into Chroma |
| `pnpm chat` | Interactive CLI — type a question, get an answer with citations |
| `pnpm eval` | Runs the **development** question set (20 questions) and writes a timestamped `dev-*` result file |
| `pnpm eval:test` | Runs the **held-out test** set (10 questions) and writes a `test-*` result file — use sparingly (see Evaluation methodology) |
| `pnpm score <id>` | Scores a result file by keyword-pass and citation-pass |
| `pnpm diff <id1> <id2>` | Compares two eval runs question-by-question |

## Graph pipeline

```
intentRouter → queryRewriteNode → retrieveNode → gradeDocsNode → generateAnswer → verifyCitations
                                        ↑                                               │
                                        └────────────────── retry (max 2) ─────────────┘
```

- **intentRouter** — classifies the query as `fact`, `quote`, or `analysis` using keyword/regex heuristics.
- **queryRewriteNode** — for `analysis` questions only, expands the query into 2–3 sub-queries to improve recall.
- **retrieveNode** — runs vector search against Chroma; merges and deduplicates results from all sub-queries.
- **gradeDocsNode** — for `analysis`, an LLM grades each retrieved passage 0/1/2 for relevance and reranks; fact/quote take top-5 by distance directly.
- **generateAnswer** — call 1 writes a grounded prose answer; call 2 (temp=0) extracts the citation references.
- **verifyCitations** — if no citations were extracted, triggers a retry up to `MAX_RETRIES` times.

Answers include inline citations in the form `Ch. N, para X–Y`.

## Configuration

All settings live in `.env` (copy from `.env.example`). Key variables:

```
OLLAMA_CHAT_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
CHROMA_COLLECTION=crime-and-punishment
CHUNK_SIZE=800
CHUNK_OVERLAP=1     # paragraph count (0–2), not characters
RETRIEVAL_K=5
MAX_RETRIES=2
```

## RAG implementation notes

### Document processing

The Gutenberg HTML is parsed with [cheerio](https://cheerio.js.org). The parser walks `<h2>` elements and uses them as chapter boundaries, collecting `<p>` siblings between consecutive headings as the paragraph list for each chapter. The Gutenberg license footer is detected by its heading text and skipped. Every chunk produced downstream carries structured metadata: `book`, `part`, `chapterTitle`, `chapterIndex`, `paraStart`, `paraEnd`, `sourceFile`.

### Chunking strategy

The project uses a **paragraph-buffer chunker** (`src/ingest/chunker.ts`) rather than a fixed-size character splitter. The key properties:

- Paragraphs are accumulated into a buffer until adding the next one would exceed `CHUNK_SIZE` (default 800 chars). The buffer is then emitted as a chunk.
- **Paragraph-level overlap** (controlled by `CHUNK_OVERLAP`, default `1`): when a new buffer starts, it rewinds by that many paragraphs, so adjacent chunks share context at the boundary. This avoids hard cuts mid-scene. The unit is **paragraph count**, not characters — sensible values are 0, 1, or 2. Passing a large number (e.g. 100) would trigger the chunker's overflow safety guard and silently disable overlap.
- **Oversized paragraph handling**: a single paragraph that exceeds `CHUNK_SIZE * 2` (1600 chars) is split at sentence boundaries (lookbehind regex `(?<=[.!?])\s+`) with a 150-char sentence overlap before being fed into the buffer loop. This ensures the chunker never receives an input that can't fit in a chunk.
- The `paraStart`/`paraEnd` indices in metadata let the retriever report precise source ranges in citations.

This strategy was chosen over a `RecursiveCharacterTextSplitter` because literary prose has meaningful paragraph boundaries (scene shifts, dialogue turns, Dostoevsky's paragraph-per-thought style) that fixed-size splitting ignores. The trade-off is slightly uneven chunk sizes, which is acceptable here.

### Embeddings and vector search

Embeddings are generated by `nomic-embed-text` running locally via Ollama. Chroma stores them in an HNSW index and uses **L2 (Euclidean) distance** — the default when no `hnsw:space` metadata is set on the collection. Lower distance = closer match. Observed distances for good matches are typically in the 0.43–0.56 range; above ~0.75 the passage is usually only loosely related.

Ingestion calls `collection.upsert()` with stable IDs (`doc-0`, `doc-1`, …), so re-running `pnpm ingest` is idempotent — it overwrites existing vectors rather than creating duplicates.

### Multi-query retrieval

For `analysis` questions, `queryRewriteNode` asks the LLM to expand the original query into 2–3 sub-queries that cover different angles of the question (different vocabulary, different aspects of the novel). `retrieveNode` then issues `k` retrievals in parallel for the original query and each sub-query, giving a candidate pool of up to `k × (n_subqueries + 1)` passages before deduplication.

Deduplication is keyed on `(chapterIndex, paraStart, paraEnd)`: when the same chunk appears in multiple result sets, only the copy with the lowest distance is kept. The merged set is sorted by distance before being passed to the grader.

`fact` and `quote` questions skip query rewriting entirely — a single precise vector search works well for them, and multi-query would mostly retrieve duplicates.

### Reranking

After retrieval, `gradeDocsNode` applies different logic depending on intent:

- **fact / quote**: no LLM grading — top-5 by vector distance is returned as-is.
- **analysis**: an LLM grades each candidate passage on a 0/1/2 scale (0 = unrelated, 1 = partial, 2 = directly answers the question), re-sorts by score, and keeps the top 8. The cap is higher than for fact/quote because synthesis questions benefit from breadth across the novel, not just the single most relevant passage.

LLM grading adds latency (one model call per passage) but significantly improves answer quality for complex questions where the closest-by-distance passage is not necessarily the most informative.

### Answer generation and citation extraction

Generation uses **two separate LLM calls** to avoid asking the model to generate prose and track source references at the same time:

1. **Generation call**: the model receives the retrieved passages labelled with their source references and writes a natural-language answer. No format constraint is imposed — it just has to answer the question.
2. **Citation extraction call** (temperature 0): the model receives the answer it just wrote plus the list of available source references, and outputs only the reference strings it actually drew from. Temperature 0 makes this deterministic. Results are filtered with a regex (`Ch\. N, para X–Y`) and deduplicated.

Separating the two tasks consistently improves both prose quality (the generation call is unconstrained) and citation precision (the extraction call has a single well-defined job).

### Known failure modes

| Failure type | Symptom | Root cause |
|---|---|---|
| Routing misclassification | Wrong pipeline branch runs (e.g. analysis question treated as fact) | Keyword/regex heuristic — ambiguous queries fall through |
| Retrieval miss | The answer exists in the book but not in the returned chunks | Query vocabulary doesn't match chunk vocabulary; try rephrasing or widening `RETRIEVAL_K` |
| Grader over-filtering | A relevant passage was retrieved but dropped before generation | LLM grader assigned score 0; increasing the kept-doc cap helps |
| Citation hallucination | Citations are emitted but don't correspond to retrieved passages | `verifyCitations` currently only checks whether citations are non-empty, not whether they are grounded |
| Synonym miss in eval | Answer is correct but uses a different word than the expected keyword | Add an alias in `scoringUtils.ts` — only for transliterations and direct synonyms, not loose conceptual overlap |

## Evaluation methodology

The 30 questions are split into two sets to avoid tuning the system against the same questions used to measure it:

- **Development set** — `eval/questions.dev.jsonl` (20 questions). Run freely with `pnpm eval`. Diagnose individual failures here (e.g. `pnpm tsx eval/diagnoseAnalysis.ts <id>`) and make changes in response. The six hard analysis questions under active work live here.
- **Held-out test set** — `eval/questions.test.jsonl` (10 questions). Run with `pnpm eval:test` **only at milestones**, to get an honest performance number.

**Freeze protocol:** never make a change in response to seeing an individual *test* question fail. If you need to diagnose a test question, move it into the dev set first — it is burned for measurement the moment you inspect it. Record each test score against the git commit it corresponds to, so you have a trustworthy progress trace.

**Known limitations of this split:** the test set is only lightly held out. Every tuning decision so far was made against the aggregate score over all 30 questions, so even questions never inspected individually influenced the system's design. The test-set analysis questions are also comparatively easy (single expected keyword), so they don't strongly discriminate on hard synthesis behaviour. The proper next step, once tuning settles, is a **fresh batch of questions written afterwards** — probing the same capabilities with new vocabulary and angles — to serve as the real held-out test.

A note on scoring aliases (`eval/scoringUtils.ts`): an alias is safe when it reflects a corpus fact or grammatical form you'd have written *before* seeing a failure (`sonya→sonia`, `poor→poverty`). It risks overfitting when added *reactively* because one answer happened to use that word. Keep aliases to transliterations and direct synonyms, never loose conceptual overlap.

## Project structure

```
src/
  config.ts               single source of truth for all settings
  constants/              keyword + regex lists for intent routing
  graph/                  LangGraph nodes and compiled graph
  ingest/                 HTML parser, chunker, Chroma indexer
  llm/                    Ollama chat + embeddings wrappers
  rag/                    Chroma client and retriever
  cli/                    interactive chat REPL
eval/
  questions.dev.jsonl     20-question development set (fact / quote / analysis)
  questions.test.jsonl    10-question held-out test set
  runEval.ts              runs a question set through the graph (defaults to dev)
  scoreEval.ts            scores a run by keyword-pass and citation-pass
  scoringUtils.ts         case-insensitive keyword matching with alias map
  diffEvals.ts            side-by-side comparison of two runs
  diagnoseAnalysis.ts     node-by-node trace for a single question
```
