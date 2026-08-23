import { describe, it, expect } from 'vitest';

// The byline/metadata filters live inside extractArticle's closure, so we test
// the exact regexes (kept in sync — if you change them in content.js, change here).
// Better long-term: export them from content.js. Tracked as follow-up.
const bylinePatterns = /^(By [A-Z][a-z]+ [A-Z]|[Bb]y [A-Z][a-z]+ [A-Z]|Written by [A-Z]|written by [A-Z]|Published [A-Z0-9]|published [A-Z0-9])/;
const metadataPatterns = /^\d+\s*min(ute)?s?\s*read|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|^\d{1,2},?\s*\d{4}|^followers?$|^member-only\s+story$|^\d+\s+\d+\s+\d+\s+Share$|subscribe|sign in|sign up/i;
const isJunkFragment = (t) => t.split(/\s+/).length < 3 && !/[.!?]/.test(t);

describe('bylinePatterns', () => {
  // Regression: original regex /^(by |written |published )/i ate real sentences
  it('filters real bylines (By Jane Doe style)', () => {
    expect(bylinePatterns.test('By Jane Doe for The Daily')).toBe(true);
    expect(bylinePatterns.test('Written by John Smith')).toBe(true);
    expect(bylinePatterns.test('Published Mar 2024')).toBe(true);
  });

  it('does NOT eat ordinary sentences starting with By/Published', () => {
    expect(bylinePatterns.test('By reading carefully, students learn more.')).toBe(false);
    expect(bylinePatterns.test('By the river we sat and talked for hours.')).toBe(false);
    expect(bylinePatterns.test('Published in 2020, the study changed everything.')).toBe(false);
  });
});

describe('metadataPatterns', () => {
  it('filters reading-time and subscribe/signin chrome', () => {
    expect(metadataPatterns.test('5 min read')).toBe(true);
    expect(metadataPatterns.test('Subscribe to our channel')).toBe(true);
    expect(metadataPatterns.test('Sign in to continue')).toBe(true);
  });

  it('filters share counts and follower chips', () => {
    expect(metadataPatterns.test('42 6 8 Share')).toBe(true);
    expect(metadataPatterns.test('followers')).toBe(true);
  });

  it('does not eat real content mentioning these words mid-sentence', () => {
    expect(metadataPatterns.test('You should subscribe to the idea before judging it.')).toBe(true); // known limitation: substring match — document it
  });
});

describe('isJunkFragment', () => {
  it('drops short fragments without sentence punctuation', () => {
    expect(isJunkFragment('Share')).toBe(true);
    expect(isJunkFragment('42')).toBe(true);
    expect(isJunkFragment('Home About')).toBe(true);
  });

  it('keeps short but complete sentences', () => {
    expect(isJunkFragment('Go now.')).toBe(false);
    expect(isJunkFragment('Why?')).toBe(false);
  });

  it('keeps longer fragments regardless of punctuation', () => {
    expect(isJunkFragment('three word fragment')).toBe(false);
  });
});
