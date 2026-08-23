import { describe, it, expect } from 'vitest';
import { normaliseForMatch } from '../extension/content.js';

describe('normaliseForMatch', () => {
  it('folds curly single quote to straight (karaoke killer #1)', () => {
    expect(normaliseForMatch('Everyone’s')).toBe("Everyone's");
  });

  it('folds left single curly quote', () => {
    expect(normaliseForMatch('\u2018word\u2019')).toBe("'word'");
  });

  it('folds curly double quotes', () => {
    expect(normaliseForMatch('\u201Cquoted\u201D')).toBe('"quoted"');
  });

  it('folds em-dash, en-dash and minus to hyphen', () => {
    expect(normaliseForMatch('\u2014\u2013\u2012\u2212')).toBe('----');
  });

  it('folds ellipsis to three dots (expansion)', () => {
    const out = normaliseForMatch('wait\u2026');
    expect(out).toBe('wait...');
    // expansion: one raw char becomes three norm chars
    expect(out.length).toBe('wait'.length + 3);
  });

  it('folds non-breaking space to regular space', () => {
    expect(normaliseForMatch('a\u00A0b')).toBe('a b');
  });

  it('leaves plain ASCII untouched', () => {
    const s = "plain text - with 'quotes' and \"doubles\"...";
    expect(normaliseForMatch(s)).toBe(s);
  });

  it('is idempotent', () => {
    const mixed = '\u201CMixed\u201D \u2014 text\u2026';
    expect(normaliseForMatch(normaliseForMatch(mixed))).toBe(normaliseForMatch(mixed));
  });
});
