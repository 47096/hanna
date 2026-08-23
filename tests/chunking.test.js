import { describe, it, expect } from 'vitest';
import { splitIntoChunks } from '../extension/content.js';

const MAX = 900;

describe('splitIntoChunks', () => {
  it('returns short text as a single chunk', () => {
    const t = 'A short paragraph.';
    expect(splitIntoChunks(t, MAX)).toEqual([t]);
  });

  it('never exceeds the max length for normal prose', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} has some words here.`).join(' ');
    const chunks = splitIntoChunks(long, MAX);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(MAX);
  });

  it('splits on sentence boundaries, not mid-word', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Wordword${i}`).join('. ') + '.';
    const chunks = splitIntoChunks(long, MAX);
    // No chunk should end mid-token (e.g. "Wordwor" / "d3")
    for (const c of chunks) {
      expect(c.endsWith('Wordword') || !/[a-z]$/.test(c) || c.length < MAX).toBe(true);
    }
  });

  it('preserves all content — concatenation equals original (E1 regression)', () => {
    // Regression: earlier implementation dropped trailing text without terminal punctuation
    const text = 'First sentence ends here. Second sentence also ends. trailing text no period';
    const chunks = splitIntoChunks(text, MAX);
    expect(chunks.join(' ')).toBe(text);
  });

  it('keeps a single oversized sentence intact rather than dropping it (E2)', () => {
    const huge = 'x'.repeat(1500) + ' end.';
    const chunks = splitIntoChunks(huge, MAX);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.join('')).toContain('end.');
  });

  it('handles empty string (caller filters these first — returns single empty chunk)', () => {
    expect(splitIntoChunks('', MAX)).toEqual(['']);
  });

  it('produces chunks that reassemble into the original text', () => {
    const text =
      'The quick brown fox jumps over the lazy dog. '.repeat(50).trim();
    const chunks = splitIntoChunks(text, MAX);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });
});
