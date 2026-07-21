import { Document } from '@langchain/core/documents';
import { Chapter } from '../interfaces/chapter';
import { parseGutenbergHtml } from './parseGutenbergHtml';

export function chunkChapters(
  chapters: Chapter[],
  chunkSize: number,
  overlapParagraphs: number = 1
): Document[] {
  if (chunkSize <= 0) throw new Error('ChunkSize must be > 0');
  if (overlapParagraphs < 0) throw new Error('Overlap must be >= 0');

  const docs: Document[] = [];

  for (let c = 0; c < chapters.length; c++) {
    const chapter = chapters[c];
    const paragraphs = chapter.paragraphs ?? [];

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
