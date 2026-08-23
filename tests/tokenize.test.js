import { describe, it, expect } from 'vitest';
import { tokenize } from '../extension/content.js';

describe('tokenize', () => {
  it('splits Latin text on whitespace', () => {
    expect(tokenize('the quick brown fox')).toEqual(['the', 'quick', 'brown', 'fox']);
  });

  it('collapses multiple spaces', () => {
    expect(tokenize('one  two   three')).toEqual(['one', 'two', 'three']);
  });

  it('handles newlines and tabs as separators', () => {
    expect(tokenize('one\ntwo\tthree')).toEqual(['one', 'two', 'three']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(tokenize('   \n\t ')).toEqual([]);
  });

  it('splits CJK text into individual characters', () => {
    expect(tokenize('你好')).toEqual(['你', '好']);
  });

  it('keeps CJK punctuation attached per character', () => {
    const t = tokenize('你好，今日。');
    // ，and 。 are full-width punctuation — treated as part of CJK flow
    expect(t.length).toBeGreaterThan(4);
    expect(t).toContain('你');
  });

  it('handles mixed CJK + Latin', () => {
    const t = tokenize('用 Claude 讀文章');
    expect(t).toContain('Claude');
    expect(t).toContain('讀');
    expect(t).toContain('文');
  });

  it('keeps punctuation attached to Latin words', () => {
    expect(tokenize("don't stop, go!")).toEqual(["don't", 'stop,', 'go!']);
  });

  it('preserves curly apostrophes inside words', () => {
    expect(tokenize('Everyone’s here')).toEqual(['Everyone’s', 'here']);
  });
});
