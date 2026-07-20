const DEFAULT_MAX_CHARS = 4_000;
const DEFAULT_OVERLAP_CHARS = 400;

/**
 * Split RAG input into bounded chunks while retaining a small overlap between
 * chunks. Character limits are used here so ingestion stays deterministic and
 * independent of a specific model tokenizer.
 */
export function chunkRagText(
  input: string,
  maxChars = DEFAULT_MAX_CHARS,
  overlapChars = DEFAULT_OVERLAP_CHARS,
): string[] {
  const text = input.replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  if (maxChars <= 0) throw new Error('maxChars must be greater than zero');
  if (overlapChars < 0 || overlapChars >= maxChars) {
    throw new Error('overlapChars must be between zero and maxChars - 1');
  }

  const chunks: string[] = [];
  const step = maxChars - overlapChars;

  for (let start = 0; start < text.length; start += step) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      const sentenceBreak = text.lastIndexOf('. ', end);
      const candidateBreak = Math.max(paragraphBreak, sentenceBreak);

      if (candidateBreak > start + Math.floor(maxChars * 0.6)) {
        end = candidateBreak + (candidateBreak === paragraphBreak ? 2 : 1);
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;

    // Keep the configured overlap relative to the actual break point.
    start = Math.max(start, end - overlapChars - step);
  }

  return chunks;
}
