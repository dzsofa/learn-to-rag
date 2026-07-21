import { readFileSync } from 'fs';
import * as cheerio from 'cheerio';
import { Chapter } from '../interfaces/chapter';

export function parseGutenbergHtml(filePath: string): Chapter[] {
  const file = readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(file);

  let currentPart = '';
  let chapterIndex = 0;
  const chapters: Chapter[] = [];

  $('h2').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');

    // Stop before the Gutenberg license footer
    if (text.startsWith('THE FULL PROJECT GUTENBERG')) return false;

    if (text.startsWith('PART ')) {
      currentPart = text;
      return; // just update state, no paragraphs to collect
    }

    if (text.startsWith('CHAPTER ') || text.startsWith('EPILOGUE')) {
      chapterIndex++;
      const paragraphs = $(el)
        .nextUntil('h2', 'p')
        .map((_, p) => $(p).text().trim().replace(/\s+/g, ' '))
        .get()
        .filter((p) => p.length > 0);

      chapters.push({
        book: 'Crime and Punishment',
        part: currentPart,
        chapterTitle: text,
        chapterIndex,
        paragraphs,
        sourceFile: filePath
      });
    }
  });

  return chapters;
}
