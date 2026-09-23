/**
 * scoringUtils.ts — shared keyword-matching logic for scoreEval and diffEvals.
 *
 * All keyword checks go through keywordHit() so that scoring behaviour is
 * identical across both scripts and only needs to change in one place.
 *
 * Two improvements over a plain `answer.includes(keyword)` check:
 *
 *   1. Case-insensitive — avoids failures caused purely by capitalisation.
 *
 *   2. Alias map — lets a keyword pass when the model uses a recognised
 *      equivalent word instead of the exact expected string.
 *
 * Rules for adding an alias:
 *   ✓  Same name, different transliteration:  "sonya" → ["sonia"]
 *   ✓  Same concept, different word form:     "poor"  → ["poverty"]
 *   ✓  Direct synonym in this context:        "extraordinary" → ["exceptional", "superior"]
 *   ✓  Adjective / noun pair:                 "morality" → ["moral"]
 *   ✗  Loose conceptual overlap:              do NOT add "conscience" → "guilt" —
 *      different ideas; aliasing hides real gaps in the model's answer.
 */
const KEYWORD_ALIASES: Record<string, string[]> = {
  // "Sonya" is how the name is commonly written, but the Gutenberg translation
  // of Crime and Punishment spells it "Sonia" throughout. The model mirrors the
  // source text, so this alias will always be needed for this corpus.
  sonya: ['sonia'],

  // Raskolnikov's "ordinary / extraordinary men" theory. The model consistently
  // paraphrases the key adjective rather than quoting it verbatim.
  extraordinary: ['exceptional', 'superior'],

  // The model uses the noun "poverty" where the keyword is the adjective "poor".
  poor: ['poverty'],

  // The model describes Raskolnikov as the "protagonist of the novel" rather
  // than a "character".
  character: ['protagonist'],

  // The model says "moral message" / "moral principle" rather than "morality".
  // "moral" is a substring of "morality" so this only fires when the answer
  // contains "moral" but not "morality".
  morality: ['moral'],

  // When asked how the Epilogue "resolves" Raskolnikov's arc, the model consistently
  // uses "resolution", "resolved", or "reconciled" rather than "redemption". In the
  // context of a character's narrative arc these are direct synonyms — the Epilogue's
  // resolution IS the redemptive arc. This is not loose overlap (cf. conscience/guilt).
  redemption: ['resolution', 'resolved', 'reconciled'],
};

/**
 * Returns true if `answer` contains `keyword` (case-insensitive), OR if it
 * contains any registered alias for that keyword.
 */
export function keywordHit(answer: string, keyword: string): boolean {
  const answerLower = answer.toLowerCase();
  const kw = keyword.toLowerCase();
  if (answerLower.includes(kw)) return true;
  const aliases = KEYWORD_ALIASES[kw] ?? [];
  return aliases.some((alias) => answerLower.includes(alias.toLowerCase()));
}

/**
 * Returns true if every keyword in `keywords` hits in `answer`.
 */
export function allKeywordsHit(answer: string, keywords: string[]): boolean {
  return keywords.every((kw) => keywordHit(answer, kw));
}
