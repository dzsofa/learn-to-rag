import { Document } from '@langchain/core/documents';
import { Chapter } from '../interfaces/chapter';

/**
 * Splits a string at sentence boundaries into sub-strings of at most
 * `maxChars` characters each. Adjacent sub-strings share up to `overlapChars`
 * of context from the tail of the previous sub-string, so no sentence boundary
 * is a hard context break.
 *
 * Sentence detection: splits on `.`, `!`, or `?` followed by whitespace
 * (lookbehind assertion). Works well for English prose; does not special-case
 * abbreviations like "Mr." — the overlap compensates for any context loss at
 * those false boundaries.
 *
 * Edge case: if a single sentence is longer than `maxChars`, it is returned
 * as-is in its own sub-string (we cannot split mid-sentence).
 */
export function splitAtSentenceBoundaries(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  // Keep the punctuation attached to the preceding sentence.
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

  // If there is only one sentence (or the text is already short), nothing to split.
  if (sentences.length <= 1) return [text];

  const chunks: string[] = [];
  let buffer: string[] = [];
  let bufferLen = 0;

  for (const sentence of sentences) {
    const sep = buffer.length > 0 ? 1 : 0; // one space when joining
    const wouldExceed = bufferLen + sep + sentence.length > maxChars;

    if (wouldExceed && buffer.length > 0) {
      // Emit the current buffer as one sub-chunk.
      chunks.push(buffer.join(' '));

      // Build an overlap tail: walk backwards through the buffer, accumulating
      // sentences until we have filled ~overlapChars worth of context.
      const overlapBuf: string[] = [];
      let overlapLen = 0;
      for (let j = buffer.length - 1; j >= 0; j--) {
        const s = buffer[j];
        const sepJ = overlapBuf.length > 0 ? 1 : 0;
        if (overlapLen + sepJ + s.length <= overlapChars) {
          overlapBuf.unshift(s); // unshift preserves original sentence order
          overlapLen += sepJ + s.length;
        } else {
          break;
        }
      }

      buffer = overlapBuf;
      bufferLen = overlapLen;
    }

    const newSep = buffer.length > 0 ? 1 : 0;
    buffer.push(sentence);
    bufferLen += newSep + sentence.length;
  }

  if (buffer.length > 0) {
    chunks.push(buffer.join(' '));
  }

  return chunks;
}

export function chunkChapters(
  chapters: Chapter[],
  chunkSize: number,
  overlapParagraphs: number = 1,
  maxParagraphChars: number = chunkSize * 2
): Document[] {
  if (chunkSize <= 0) throw new Error('ChunkSize must be > 0');
  if (overlapParagraphs < 0) throw new Error('Overlap must be >= 0');
  if (maxParagraphChars < chunkSize)
    throw new Error('maxParagraphChars must be >= chunkSize');

  // Overlap used when splitting an individual oversized paragraph into
  // sentence-level sub-chunks. This is independent of the paragraph-level
  // overlap in the main loop below.
  const SENTENCE_OVERLAP_CHARS = 150;

  const docs: Document[] = [];

  for (let c = 0; c < chapters.length; c++) {
    const chapter = chapters[c];
    const rawParagraphs = chapter.paragraphs ?? [];

    // Expand any paragraph that exceeds maxParagraphChars into sentence-level
    // sub-paragraphs so the main loop below never receives an oversized input.
    //
    // Trade-off on metadata: paraStart/paraEnd indices now refer to positions in
    // the expanded list. For chapters with no oversized paragraphs (the majority)
    // the indices are identical to the originals. For chapters that do have them,
    // the indices are close approximations of the original paragraph range.
    const paragraphs = rawParagraphs.flatMap((p) => {
      const trimmed = p.trim();
      if (!trimmed) return [];
      return trimmed.length > maxParagraphChars
        ? splitAtSentenceBoundaries(trimmed, maxParagraphChars, SENTENCE_OVERLAP_CHARS)
        : [trimmed];
    });

    let buffer = '';

    let startIdx = 0;

    const emit = (endExclusiveIdx: number) => {
      const content = buffer.trim();
      if (!content) return;

      docs.push(
        new Document({
          pageContent: content,
          metadata: {
            book: chapter.book,
            part: chapter.part,
            chapterTitle: chapter.chapterTitle,
            chapterIndex: chapter.chapterIndex,
            sourceFile: chapter.sourceFile,
            paraStart: startIdx,
            paraEnd: endExclusiveIdx
          }
        })
      );
    };

    let i = 0;
    while (i < paragraphs.length) {
      const p = (paragraphs[i] ?? '').trim();
      if (!p) {
        i++;
        continue;
      }

      const separator = buffer.length ? '\n\n' : '';

      const candidate = buffer + separator + p;

      // If adding next paragraph would exceed chunkSize AND buffer is non-empty:
      // emit the current buffer, then reset but with overlap.
      if (buffer.length > 0 && candidate.length > chunkSize) {
        emit(i);

        // Overlap rewind:
        // Start the next chunk overlap paragraphs back from i.
        // Example: overlap=1 => start at i-1 (one paragraph back).
        const newStart = Math.max(0, i - overlapParagraphs);
        startIdx = newStart;

        // Rebuild buffer from the overlapped range: paragraphs [startIdx, i)
        // (i is not included because paras[i] is the "next" one we couldn't fit)
        buffer = '';
        for (let j = startIdx; j < i; j++) {
          const pj = (paragraphs[j] ?? '').trim();
          if (!pj) continue;
          buffer += (buffer.length ? '\n\n' : '') + pj;
        }

        // Safety: if the overlap buffer alone overflows, or if adding para[i]
        // would immediately overflow again, skip the overlap and start fresh.
        const nextP = (paragraphs[i] ?? '').trim();
        const wouldImmediatelyOverflow =
          buffer.length >= chunkSize ||
          (buffer.length > 0 && (buffer + '\n\n' + nextP).length > chunkSize);

        if (wouldImmediatelyOverflow) {
          buffer = '';
          startIdx = i;
        }

        // IMPORTANT: do not increment i here.
        // We want to try appending paras[i] again to the rebuilt overlapped buffer.
        continue;
      }
      buffer = candidate;
      i++;
    }
    if (buffer.trim()) {
      emit(paragraphs.length);
    }
  }
  return docs;
}
