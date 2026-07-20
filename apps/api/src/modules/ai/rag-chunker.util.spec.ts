import { chunkRagText } from './rag-chunker.util';

describe('chunkRagText', () => {
  it('returns no chunks for blank input', () => {
    expect(chunkRagText('   \n\n')).toEqual([]);
  });

  it('keeps every chunk within the configured limit', () => {
    const chunks = chunkRagText('a'.repeat(250), 100, 10);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 100)).toBe(true);
  });

  it('preserves overlap between adjacent long chunks', () => {
    const chunks = chunkRagText('0123456789'.repeat(20), 60, 10);

    expect(chunks[0].slice(-10)).toBe(chunks[1].slice(0, 10));
  });
});
