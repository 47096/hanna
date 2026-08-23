import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Regression test for the GitHub-page duplication bug:
// "ReadRead beautifully.Read beautifully. A..." — each span's leading gap
// was sliced from position 0 instead of from the previous span's end.

function isCJK(ch) {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\uF900-\uFAFF]/.test(ch);
}
function tokenize(text) {
  const tokens = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (isCJK(ch)) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
      tokens.push(ch);
    } else if (/\s/.test(ch)) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens.filter(Boolean);
}
function normaliseForMatch(s) {
  return s
    .replace(/[\u2018\u2019\u201B\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ');
}

// Verbatim port of the FIXED wrapSelectionWords
function wrapSelectionWords(text, scope) {
  const doc = scope.ownerDocument;
  const words = tokenize(text).map(normaliseForMatch);
  if (words.length === 0) return [];

  const searchRoot = scope || doc.body;
  const walker = doc.createTreeWalker(searchRoot, 4, null);
  const allNodes = [];
  let n;
  while ((n = walker.nextNode())) allNodes.push(n);

  const nodes = allNodes.map((node) => {
    const raw = node.textContent;
    const normParts = [];
    const rawIdx = [];
    for (let i = 0; i < raw.length; i++) {
      const folded = normaliseForMatch(raw[i]);
      normParts.push(folded);
      rawIdx.push(i);
      for (let k = 1; k < folded.length; k++) rawIdx.push(i);
    }
    return { node, norm: normParts.join(''), rawIdx, raw };
  });

  let startNodeIdx = -1,
    startOffset = 0;
  for (let i = 0; i < nodes.length; i++) {
    const idx = nodes[i].norm.indexOf(words[0]);
    if (idx !== -1) {
      startNodeIdx = i;
      startOffset = idx;
      break;
    }
  }
  if (startNodeIdx === -1) return [];

  const spans = [];
  let wordIdx = 0,
    nodeIdx = startNodeIdx,
    charOffset = startOffset;

  while (wordIdx < words.length && nodeIdx < nodes.length) {
    const entry = nodes[nodeIdx];
    const word = words[wordIdx];
    const wordPos = entry.norm.indexOf(word, charOffset);

    if (wordPos !== -1) {
      const rawStart = entry.rawIdx[wordPos];
      const rawEnd =
        entry.rawIdx[Math.min(wordPos + word.length - 1, entry.rawIdx.length - 1)] + 1;
      const frag = doc.createDocumentFragment();

      // FIXED: leading gap slices from previous consumed position
      const prevConsumed = entry.node._pendingFrag ? entry.node._pendingFrag.consumed : 0;
      if (rawStart > prevConsumed) {
        frag.appendChild(doc.createTextNode(entry.raw.slice(prevConsumed, rawStart)));
      }

      const span = doc.createElement('span');
      span.className = 'hanna-word';
      span.textContent = entry.raw.slice(rawStart, rawEnd);
      frag.appendChild(span);
      spans.push(span);

      if (!entry.node._pendingFrag) {
        entry.node._pendingFrag = { frag, consumed: rawEnd, raw: entry.raw };
      } else {
        entry.node._pendingFrag.frag.appendChild(frag);
        entry.node._pendingFrag.consumed = rawEnd;
      }
      charOffset = wordPos + word.length;
      wordIdx++;
    } else {
      const remaining = entry.norm.slice(charOffset);
      if (remaining.length > 0 && word.startsWith(remaining.trim())) wordIdx++;

      if (entry.node._pendingFrag) {
        const pf = entry.node._pendingFrag;
        if (pf.consumed < pf.raw.length)
          pf.frag.appendChild(doc.createTextNode(pf.raw.slice(pf.consumed)));
        entry.node.parentNode.replaceChild(pf.frag, entry.node);
        delete entry.node._pendingFrag;
      }
      nodeIdx++;
      charOffset = 0;
    }
  }

  for (const entry of nodes) {
    if (entry.node._pendingFrag) {
      const pf = entry.node._pendingFrag;
      if (pf.consumed < pf.raw.length)
        pf.frag.appendChild(doc.createTextNode(pf.raw.slice(pf.consumed)));
      entry.node.parentNode.replaceChild(pf.frag, entry.node);
      delete entry.node._pendingFrag;
    }
  }
  return spans;
}

describe('karaoke duplication regression (GitHub page bug)', () => {
  let dom, scope;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.NodeFilter = dom.window.NodeFilter;
    scope = dom.window.document.body;
  });

  it('wraps multi-word text WITHOUT duplicating earlier content', () => {
    scope.innerHTML =
      '<p>Read beautifully. A Chrome extension that reads text aloud using AI voices.</p>';
    wrapSelectionWords(
      'Read beautifully. A Chrome extension that reads text aloud using AI voices.',
      scope
    );
    const p = scope.querySelector('p');
    const rendered = p.textContent;
    // The killer assertion: rendered text equals original — no cumulative duplication
    expect(rendered).toBe(
      'Read beautifully. A Chrome extension that reads text aloud using AI voices.'
    );
    // Each word appears exactly once (the bug rendered cumulative prefixes)
    expect(rendered.split('Read').length - 1).toBe(1);
    expect(rendered.split('beautifully').length - 1).toBe(1);
    expect(scope.querySelectorAll('.hanna-word').length).toBe(12);
  });

  it('preserves inter-word gaps exactly once', () => {
    scope.innerHTML = '<p>Alpha one sentence. Beta two sentence.</p>';
    wrapSelectionWords('Alpha one sentence. Beta', scope);
    const rendered = scope.querySelector('p').textContent;
    expect(rendered).toBe('Alpha one sentence. Beta two sentence.');
    expect(rendered.indexOf('Alpha')).toBe(rendered.lastIndexOf('Alpha'));
  });
});
