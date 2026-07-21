export interface Chapter {
  book: string; // "Crime and Punishment"
  part: string; // "PART I", "PART II", …
  chapterTitle: string; // "CHAPTER I", "CHAPTER II", …, "EPILOGUE"
  chapterIndex: number; // global counter: 1, 2, 3, … across the whole book
  paragraphs: string[]; // cleaned text of each <p> inside this chapter
  sourceFile: string; // the file path — useful if you ever add a second book
}