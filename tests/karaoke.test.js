import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// wrapSelectionWords lives inside content.js's IIFE and needs DOM.
// We re-declare the exact algorithm here (kept in sync with content.js).
// If you change the walker in content.js, mirror changes here — or better,
// export the real one once DOM-dependent code is factored out (follow-up).

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

      const lastConsumed =
        spans.length && entry.node._pendingFrag ? entry.node._pendingFrag.consumed : null;
      if (lastConsumed !== null && rawStart > lastConsumed) {
        frag.appendChild(doc.createTextNode(entry.raw.slice(lastConsumed, rawStart)));
      } else if (lastConsumed === null && rawStart > 0) {
        frag.appendChild(doc.createTextNode(entry.raw.slice(0, rawStart)));
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

describe('wrapSelectionWords', () => {
  let dom, scope;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.NodeFilter = dom.window.NodeFilter;
    global.Node = dom.window.Node;
    scope = dom.window.document.body;
  });

  it('wraps every word of plain ASCII text', () => {
    scope.innerHTML = '<p>Here are the three big changes coming for us all.</p>';
    const spans = wrapSelectionWords('the three big changes', scope);
    expect(spans.length).toBe(4); // the|three|big|changes
    expect(scope.querySelectorAll('.hanna-word').length).toBe(4);
  });

  it('wraps across curly apostrophes (Substack killer regression)', () => {
    scope.innerHTML = '<p>Everyone’s about to know that you used AI</p>';
    const spans = wrapSelectionWords("Everyone's about to know", scope);
    expect(spans.length).toBe(4); // Everyone's|about|to|know
  });

  it('wraps across dash variants', () => {
    scope.innerHTML = '<p>watermark – the most controversial change ever</p>';
    const spans = wrapSelectionWords('watermark — the most controversial', scope);
    expect(spans.length).toBe(5);
  });

  it('preserves original typographic characters in the DOM', () => {
    scope.innerHTML = '<p>Everyone’s about to know</p>';
    wrapSelectionWords("Everyone's about", scope);
    // The curly quote must survive somewhere in the paragraph text
    expect(scope.querySelector('p').textContent).toContain('’');
  });

  it('handles ellipsis expansion mapping', () => {
    scope.innerHTML = '<p>Now wait for it… and more follows here afterwards</p>';
    const spans = wrapSelectionWords('wait for it...', scope);
    expect(spans.length).toBe(3); // wait|for|it... — 'it...' is one token matching DOM 'it…'
    // And the span preserves the raw ellipsis character
    const last = spans[spans.length - 1];
    expect(last.textContent).toBe('it…');
  });

  it('returns empty array when text is not in scope at all', () => {
    scope.innerHTML = '<p>Completely unrelated content lives here.</p>';
    const spans = wrapSelectionWords('totally absent words here', scope);
    expect(spans).toEqual([]);
  });

  it('handles CJK character-by-character highlighting', () => {
    scope.innerHTML = '<p>你好，今日天氣好好。</p>';
    const spans = wrapSelectionWords('你好，今日天氣好好。', scope);
    expect(spans.length).toBe(10); // each CJK char is a token
  });
});
