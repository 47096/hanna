// Content script — plays TTS audio for Speak (selection) and Read Page (article)

(() => {
  'use strict';

  // Prevent double injection
  if (window.__hanna_injected) return;
  window.__hanna_injected = true;

  let currentAudio = null;
  let audioUnlocked = false;
  let highlightSpans = [];
  let highlightRaf = null;
  let speakGeneration = 0;  // Prevents stale TTS responses from playing
  let lastProgress = null;  // For restoring progress counter on pause/resume

  // Listen for messages from background (context menu)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ ok: true });
    } else if (msg.type === 'HAS_READABILITY') {
      sendResponse({ present: typeof Readability !== 'undefined' });
    } else if (msg.type === 'STOP') {
      stopSpeaking();
      sendResponse({ ok: true });
    } else if (msg.type === 'SPEAK') {
      unlockAudio();
      speakText(msg.text);
      sendResponse({ ok: true });
    } else if (msg.type === 'READ_PAGE') {
      unlockAudio();
      readPage();
      sendResponse({ ok: true });
    }
  });


  // Unlock audio on first user gesture (Chrome autoplay policy)
  function unlockAudio() {
    if (audioUnlocked) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      audioUnlocked = true;
      ctx.close();
    } catch (e) { /* ignore */ }
  }
  document.addEventListener('mousedown', unlockAudio, { once: true, passive: true });
  document.addEventListener('keydown', unlockAudio, { once: true, passive: true });

  // Stop playback on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') stopSpeaking();
  });

  // Map raw API/service errors to plain-English messages
  function friendlyError(msg) {
    const m = String(msg || '');
    if (/401|403|api key/i.test(m)) return 'Check your API key';
    if (/429/.test(m)) return 'Rate limited — try shortly';
    if (/502|503|504/.test(m)) return 'Service unavailable — try soon';
    if (/timeout|timed out|AbortError/i.test(m)) return 'Request timed out';
    if (/failed to fetch|networkerror/i.test(m)) return 'Network error — check connection';
    return msg;
  }

  function speakText(text) {
    speakGeneration++;
    const myGen = speakGeneration;

    stopSpeaking();

    // Cap text length to avoid excessive API costs and timeouts
    const MAX_CHARS = 10000;
    if (text.length > MAX_CHARS) {
      showIndicator('error', `Text too long (${text.length.toLocaleString()} chars) — select less`);
      return;
    }

    // Classic Loading shimmer while the TTS request runs (no progress — nothing
    // to be a percentage of until audio exists)
    showIndicator('loading');
    // Snapshot the DOM text for later karaoke matching
    const selectedText = text;

    chrome.runtime.sendMessage(
      { type: 'TTS_REQUEST', text },
      (response) => {
        // Stale response — another speakText() was called after this one
        if (myGen !== speakGeneration) return;

        if (chrome.runtime.lastError) {
          console.error('[Hanna]', chrome.runtime.lastError.message);
          showIndicator('error', friendlyError(chrome.runtime.lastError.message));
          return;
        }
        if (response?.error) {
          console.error('[Hanna] TTS error:', response.error);
          showIndicator('error', friendlyError(response.error));
          return;
        }
        if (response?.audioBase64) {
          const speed = SPEED_PRESETS[currentSpeedIndex];
          playAudioFromBase64(response.audioBase64, response.mimeType || 'audio/wav', selectedText, { speed })
            .catch((err) => showIndicator('error', err?.message || 'Playback failed'));
        } else {
          showIndicator('error', 'No audio returned');
        }
      }
    );
  }

  // ── Karaoke Highlighting ─────────────────────────────────────────────────

  const KARAOKE_STYLE_ID = 'hanna-karaoke-style';

  function injectKaraokeStyle() {
    if (document.getElementById(KARAOKE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = KARAOKE_STYLE_ID;
    style.textContent = `
      .hanna-word { transition: background 0.12s; border-radius: 2px; }
      .hanna-word-active { background: rgba(255, 200, 50, 0.45); }
      .hanna-word-spoken { background: rgba(255, 220, 100, 0.2); }
    `;
    document.head.appendChild(style);
  }

  function isCJK(char) {
    const code = char.charCodeAt(0);
    return (code >= 0x4e00 && code <= 0x9fff) ||   // CJK Unified Ideographs
           (code >= 0x3040 && code <= 0x309f) ||   // Hiragana
           (code >= 0x30a0 && code <= 0x30ff) ||   // Katakana
           (code >= 0x3400 && code <= 0x4dbf) ||   // CJK Extension A
           (code >= 0xff00 && code <= 0xffef);     // Fullwidth forms
  }

  function tokenize(text) {
    // Split text into words — CJK characters are individual tokens,
    // Latin/other text is split by whitespace
    const tokens = [];
    let current = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (isCJK(ch)) {
        // Flush any accumulated Latin word
        if (current.trim()) tokens.push(current.trim());
        current = '';
        // Each CJK character is its own token
        tokens.push(ch);
      } else if (/\s/.test(ch)) {
        // Whitespace — flush current word
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());
    return tokens.filter(Boolean);
  }

  // Fold typographic variants to their plain equivalents so TTS text matches
  // DOM text character-for-character during karaoke wrapping. Only used for
  // matching — the DOM itself is never modified apart from adding spans.
  function normaliseForMatch(s) {
    return s
      .replace(/[\u2018\u2019\u201B\u02BC]/g, "'")   // curly single quotes → '
      .replace(/[\u201C\u201D]/g, '"')               // curly double quotes → "
      .replace(/[\u2010-\u2015\u2212]/g, '-')        // all dash variants → -
      .replace(/\u2026/g, '...')                     // ellipsis → ...
      .replace(/\u00A0/g, ' ');                      // nbsp → space
  }

  function wrapSelectionWords(text, scope) {
    const words = tokenize(text).map(normaliseForMatch);
    if (words.length === 0) return [];

    // Use provided scope or fall back to document.body
    const searchRoot = scope || document.body;

    // Collect text nodes within scope
    const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_TEXT, null);
    const allNodes = [];
    let n;
    while (n = walker.nextNode()) allNodes.push(n);

    // Normalised text + index map per node: normText[i] corresponds to raw
    // text at rawIdx[i]. Matching runs on normalised text; spans wrap raw text.
    const nodes = allNodes.map(node => {
      const raw = node.textContent;
      const normParts = [];
      const rawIdx = [];
      for (let i = 0; i < raw.length; i++) {
        const folded = normaliseForMatch(raw[i]);
        normParts.push(folded);
        rawIdx.push(i);
        // expansions (… → ...) add extra norm chars pointing at same raw index
        for (let k = 1; k < folded.length; k++) rawIdx.push(i);
      }
      return { node, norm: normParts.join(''), rawIdx, raw };
    });

    // Find the starting node by searching for the first word
    let startNodeIdx = -1;
    let startOffset = 0;
    for (let i = 0; i < nodes.length; i++) {
      const idx = nodes[i].norm.indexOf(words[0]);
      if (idx !== -1) {
        startNodeIdx = i;
        startOffset = idx;
        break;
      }
    }

    if (startNodeIdx === -1) {
      console.warn('[Hanna] Could not find text in DOM for karaoke');
      return [];
    }

    // Wrap words by walking through nodes sequentially (matching on normalised text)
    const spans = [];
    let wordIdx = 0;
    let nodeIdx = startNodeIdx;
    let charOffset = startOffset;

    while (wordIdx < words.length && nodeIdx < nodes.length) {
      const entry = nodes[nodeIdx];

      // Try to find current word in this node starting from charOffset
      const word = words[wordIdx];
      const wordPos = entry.norm.indexOf(word, charOffset);

      if (wordPos !== -1) {
        // Word found — map normalised positions back to raw text positions
        const rawStart = entry.rawIdx[wordPos];
        const rawEnd = entry.rawIdx[Math.min(wordPos + word.length - 1, entry.rawIdx.length - 1)] + 1;

        // Wrap the RAW text (original characters preserved)
        const frag = document.createDocumentFragment();

        if (rawStart > 0 && nodeIdx === startNodeIdx && wordIdx === 0) {
          frag.appendChild(document.createTextNode(entry.raw.slice(0, rawStart)));
        } else if (rawStart > 0) {
          // text between words in the same node
          const prevEnd = spans.length > 0 ? rawStart : rawStart;
          frag.appendChild(document.createTextNode(entry.raw.slice(0, rawStart)));
        }

        const span = document.createElement('span');
        span.className = 'hanna-word';
        span.textContent = entry.raw.slice(rawStart, rawEnd);
        frag.appendChild(span);
        spans.push(span);

        // Store fragment with position info for final replacement
        if (!entry.node._pendingFrag) {
          entry.node._pendingFrag = { frag, consumed: rawEnd, raw: entry.raw };
        } else {
          entry.node._pendingFrag.frag.appendChild(frag);
          entry.node._pendingFrag.consumed = rawEnd;
        }
        charOffset = wordPos + word.length;
        wordIdx++;

        // Don't replace the node yet — more words may follow in this node
      } else {
        // Word not found in remainder of this node
        const remaining = entry.norm.slice(charOffset);
        if (remaining.length > 0 && word.startsWith(remaining.trim())) {
          // Word spans across nodes — skip this word, move to next
          wordIdx++;
        }

        // Apply any pending fragment for this node
        if (entry.node._pendingFrag) {
          const pf = entry.node._pendingFrag;
          if (pf.consumed < entry.raw.length) {
            pf.frag.appendChild(document.createTextNode(entry.raw.slice(pf.consumed)));
          }
          entry.node.parentNode.replaceChild(pf.frag, entry.node);
          delete entry.node._pendingFrag;
        }

        nodeIdx++;
        charOffset = 0;
      }
    }

    // Apply any remaining pending fragments
    for (const entry of nodes) {
      if (entry.node._pendingFrag) {
        const pf = entry.node._pendingFrag;
        if (pf.consumed < entry.raw.length) {
          pf.frag.appendChild(document.createTextNode(entry.raw.slice(pf.consumed)));
        }
        entry.node.parentNode.replaceChild(pf.frag, entry.node);
        delete entry.node._pendingFrag;
      }
    }

    return spans;
  }

  function startHighlightSync(audio, spans) {
    let lastActiveIndex = -1;

    // Cache bounding rects once — words don't move during playback
    const cachedRects = spans.map(s => s.getBoundingClientRect());

    // Build character-weighted timeline — longer words get more time,
    // words ending in punctuation get extra weight (speech pauses)
    const charCounts = spans.map(s => {
      const word = s.textContent;
      let weight = Math.max(word.length, 1);
      // Sentence-ending punctuation adds pause time
      if (/[.!?]$/.test(word)) weight += 3;
      // Comma/semicolon adds smaller pause
      else if (/[,;:]$/.test(word)) weight += 1;
      return weight;
    });
    const totalChars = charCounts.reduce((a, b) => a + b, 0);
    const cumulative = [];
    let sum = 0;
    for (let i = 0; i < charCounts.length; i++) {
      sum += charCounts[i] / totalChars;
      cumulative.push(sum);
    }

    function tick() {
      if (!currentAudio || currentAudio.paused || currentAudio.ended) return;

      const progress = audio.currentTime / audio.duration;

      // Binary search for the word whose cumulative range contains the progress
      let lo = 0, hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (progress <= cumulative[mid]) hi = mid;
        else lo = mid + 1;
      }
      const activeIndex = lo;

      if (activeIndex !== lastActiveIndex) {
        // Mark words before the active one as spoken (lighter highlight)
        for (let i = Math.max(lastActiveIndex + 1, 0); i < activeIndex; i++) {
          spans[i]?.classList.add('hanna-word-spoken');
        }
        // Remove highlight from previous word
        if (lastActiveIndex >= 0 && spans[lastActiveIndex]) {
          spans[lastActiveIndex].classList.remove('hanna-word-active');
          spans[lastActiveIndex].classList.add('hanna-word-spoken');
        }
        // Mark active word
        if (spans[activeIndex]) {
          spans[activeIndex].classList.add('hanna-word-active');
          // Auto-scroll proactively — keep word in center 60% of viewport
          const rect = cachedRects[activeIndex];
          const margin = window.innerHeight * 0.2;  // 20% from top/bottom
          if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
            spans[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Recalculate cached rects after scroll shifts positions
            for (let i = 0; i < spans.length; i++) {
              cachedRects[i] = spans[i].getBoundingClientRect();
            }
          }
        }
        lastActiveIndex = activeIndex;
      }

      highlightRaf = requestAnimationFrame(tick);
    }

    highlightRaf = requestAnimationFrame(tick);
  }

  function cleanupHighlights() {
    if (highlightRaf) {
      cancelAnimationFrame(highlightRaf);
      highlightRaf = null;
    }
    // Unwrap karaoke spans using tracked references, not global query
    const parents = new Set();
    for (const span of highlightSpans) {
      if (span.parentNode) {
        parents.add(span.parentNode);
        const text = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(text, span);
      }
    }
    // Only normalize the parent nodes we actually modified
    for (const p of parents) p.normalize();
    highlightSpans = [];
  }

  // ── Article Extraction ─────────────────────────────────────────────────────

  // Split long text into sentence-bounded chunks (max ~900 chars each)
  function splitIntoChunks(text, maxChars) {
    if (text.length <= maxChars) return [text];
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      if (current.length + sentence.length > maxChars && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += sentence;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  function extractArticle() {
    // Use Readability.js (Mozilla) to extract article content
    if (typeof Readability === 'undefined') {
      console.warn('[Hanna] Readability.js not loaded');
      return [];
    }

    try {
      const doc = document.cloneNode(true);

      // Rescue the subtitle/deck BEFORE Readability parses — it classifies short
      // header-adjacent elements (subtitle, byline, dateline) as page chrome and
      // strips them from article.content. Substack/Medium/Ghost all use .subtitle.
      let subtitle = '';
      const subtitleEl = doc.querySelector(
        '.subtitle, [class*="subtitle"], .post-subtitle, .page-subtitle, h3.subtitle'
      );
      if (subtitleEl) {
        subtitle = subtitleEl.textContent.replace(/\s+/g, ' ').trim();
        // Guard against grabbing something huge that merely contains "subtitle"
        if (subtitle.length > 300) subtitle = '';
      }

      // Strip non-content elements before Readability parses — menus and
      // footers otherwise win its heuristics on non-article pages
      const junkSelectors = 'nav, header, footer, aside, [role=navigation], [role=banner], [role=contentinfo]';
      for (const el of doc.querySelectorAll(junkSelectors)) {
        el.remove();
      }

      const reader = new Readability(doc);
      const article = reader.parse();

      if (!article || !article.content) return [];

      // Readability already extracted the title — use it directly.
      // It strips the headline from article.content, so searching for it there always fails.
      const title = (article.title || '').trim();

      // Parse the HTML content into text paragraphs
      const container = document.createElement('div');
      container.innerHTML = article.content;

      const allElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li');

      // Metadata patterns to skip. Bylines are matched with a separate CASE-SENSITIVE
      // regex (capitalised "By Jane Doe" style) so ordinary sentences starting with
      // "By reading..." or "Published in 2020..." are not eaten.
      const bylinePatterns = /^(By [A-Z][a-z]+ [A-Z]|[Bb]y [A-Z][a-z]+ [A-Z]|Written by [A-Z]|written by [A-Z]|Published [A-Z0-9]|published [A-Z0-9])/;
      const metadataPatterns = /^\d+\s*min(ute)?s?\s*read|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|^\d{1,2},?\s*\d{4}|^followers?$|^member-only\s+story$|^\d+\s+\d+\s+\d+\s+Share$|subscribe|sign in|sign up/i;

      // Short fragment filter — drop fragments under 3 words with no sentence punctuation
      const isJunkFragment = (t) => t.split(/\s+/).length < 3 && !/[.!?]/.test(t);

      const paragraphs = [];

      // Prepend the title, then the rescued subtitle (deck) right after it.
      // Title/subtitle live outside article.content, so they have no single
      // source element here — karaoke falls back to probing for them only.
      if (title.length > 0) {
        paragraphs.push({ text: title, el: null });
      }
      if (subtitle &&
          subtitle !== title &&
          !metadataPatterns.test(subtitle) &&
          !bylinePatterns.test(subtitle)) {
        paragraphs.push({ text: subtitle, el: subtitleEl });
      }

      for (const el of allElements) {
        // Skip parent elements that contain other collected elements (their text would be read twice)
        if (el.querySelector('h1,h2,h3,h4,h5,h6,p,li')) continue;

        const text = el.textContent.trim();
        if (text.length === 0) continue;

        // Skip metadata lines and junk fragments everywhere (menus, chips, share counts)
        if (metadataPatterns.test(text) || bylinePatterns.test(text)) continue;
        if (isJunkFragment(text)) continue;

        // Skip if this element is just the title repeated (Readability sometimes leaves a residual)
        if (title && text === title) continue;

        paragraphs.push({ text, el });
      }

      return paragraphs;
    } catch (err) {
      console.warn('[Hanna] Readability extraction failed:', err);
      return [];
    }
  }

  // ── Sequential Reading ────────────────────────────────────────────────────

  let readPageState = {
    paragraphs: [],
    currentIndex: 0,
    speed: 1.0,
    active: false,
  };
  // Failover state — when the primary provider fails repeatedly mid-session,
  // switch to the next provider that has a key. One switch per session max.
  let failoverProvider = null;   // null = using primary
  let failoverUsed = false;
  let failoverChecked = false;
  let providersWithKeys = [];
  // Rolling prefetch — chunks are fetched ahead of playback so reading never
  // stalls mid-page. PREFETCH_AHEAD chunks stay in flight beyond the current
  // index; WARMUP_AHEAD of them are launched eagerly at session start (the
  // user accepted a longer initial wait in exchange for zero mid-read gaps).
  const PREFETCH_AHEAD = 4;
  const WARMUP_AHEAD = 3;
  let warmupDone = false;        // eager warmup runs once per page load
  let prefetchMap = new Map();   // index → { index, audioBase64, mimeType } | { failed: true }
  let prefetchInFlight = new Set();

  // Ask background which providers have API keys, then pick the first one
  // that isn't the current provider
  function attemptFailover() {
    return new Promise((resolve) => {
      const proceed = () => {
        const primary = failoverProvider || 'mimo'; // approximate current; refine below
        const candidates = providersWithKeys.filter((p) => p !== readPageState.currentProvider);
        if (failoverUsed || candidates.length === 0) {
          resolve(null);
          return;
        }
        failoverUsed = true;
        failoverProvider = candidates[0];
        readPageState.currentProvider = failoverProvider;
        prefetchMap.clear();   // in-flight chunks belong to the dead provider
        prefetchInFlight.clear();
        showIndicator('loading', `Switching to ${failoverProvider}…`);
        resolve(failoverProvider);
      };
      if (failoverChecked) { proceed(); return; }
      chrome.runtime.sendMessage({ type: 'FAILOVER_CHECK' }, (res) => {
        providersWithKeys = res?.providersWithKeys || [];
        failoverChecked = true;
        proceed();
      });
    });
  }

  function fetchParagraphAudio(text, index) {
    return new Promise((resolve) => {
      // Skip segments exceeding the TTS limit (cannot occur after chunking — safety net)
      const MAX_CHARS = 10000;
      if (text.length > MAX_CHARS) {
        console.warn(`[Hanna] Segment ${index + 1} too long (${text.length} chars), skipping`);
        resolve(null);
        return;
      }
      const myGen = speakGeneration;  // Capture generation for stale check
      const msgPayload = { type: 'TTS_REQUEST', text };
      // Failover: route this request to the switched provider
      if (failoverProvider) msgPayload.failoverProvider = failoverProvider;
      chrome.runtime.sendMessage(
        msgPayload,
        (response) => {
          // Stale response — readPage was stopped or restarted
          if (myGen !== speakGeneration || !readPageState.active) {
            resolve(null);
            return;
          }
          if (chrome.runtime.lastError || response?.error || !response?.audioBase64) {
            resolve(null);
            return;
          }
          resolve({ index, audioBase64: response.audioBase64, mimeType: response.mimeType || 'audio/wav' });
        }
      );
    });
  }

  // Keep the next PREFETCH_AHEAD chunks fetched or in flight
  function prefetchWindow(eager = false) {
    if (!readPageState.active) return;
    const total = readPageState.paragraphs.length;
    const ahead = eager ? WARMUP_AHEAD : PREFETCH_AHEAD;
    for (let offset = 1; offset <= ahead; offset++) {
      const idx = readPageState.currentIndex + offset;
      if (idx >= total) break;
      if (prefetchMap.has(idx) || prefetchInFlight.has(idx)) continue;
      prefetchInFlight.add(idx);
      fetchParagraphAudio(readPageState.paragraphs[idx].text, idx).then((result) => {
        prefetchInFlight.delete(idx);
        if (result && readPageState.active && readPageState.paragraphs[result.index] === readPageState.paragraphs[idx]) {
          prefetchMap.set(idx, result);
        } else if (!result) {
          // Mark failed so we don't refetch forever; readNextParagraph handles skips
          prefetchMap.set(idx, { index: idx, failed: true });
        }
      });
    }
    // Trim entries behind the current index
    for (const key of prefetchMap.keys()) {
      if (key < readPageState.currentIndex) prefetchMap.delete(key);
    }
  }

  async function readPage() {
    speakGeneration++;  // Invalidate any in-flight TTS requests
    stopSpeaking();

    let paragraphs = [];

    // Only honour a selection if it reads like real content (>= 25 words),
    // otherwise a stray highlight would hijack Read Page
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const wordCount = selection.toString().trim().split(/\s+/).length;
      if (wordCount >= 25) {
        const selEl = selection.anchorNode?.nodeType === Node.TEXT_NODE
          ? selection.anchorNode.parentElement
          : selection.anchorNode;
        paragraphs = selection.toString().trim()
          .split(/\n\s*\n|\n/)
          .filter(p => p.trim().length > 0)
          .map(p => ({ text: p.trim(), el: selEl }));
      }
    }

    // Otherwise, try auto-extraction
    if (paragraphs.length === 0) {
      paragraphs = extractArticle();
    }

    if (paragraphs.length === 0) {
      showIndicator('error', 'No content found — try selecting text');
      console.warn('[Hanna] readPage: no paragraphs extracted');
      return;
    }

    // Split long paragraphs into sentence-bounded chunks — TTS models drop or
    // reorder phrases on long inputs, so keep every segment ~900 chars or less.
    // Each chunk keeps a reference to its source element for exact karaoke scoping.
    const MAX_CHUNK_CHARS = 900;
    const flatChunks = [];
    for (const para of paragraphs) {
      for (const piece of splitIntoChunks(para.text, MAX_CHUNK_CHARS)) {
        flatChunks.push({ text: piece, sourceEl: para.el });
      }
    }

    readPageState = {
      paragraphs: flatChunks,
      currentIndex: 0,
      speed: SPEED_PRESETS[currentSpeedIndex],
      active: true,
      consecutiveFailures: 0,
      currentProvider: null,  // resolved from settings on first fetch
    };
    // Fresh session — failover resets (per-session, not sticky by design)
    failoverProvider = null;
    failoverUsed = false;
    prefetchMap.clear();
    prefetchInFlight.clear();

    showIndicator('loading', null, { current: 1, total: flatChunks.length });
    readNextParagraph();
  }

  function playCurrentParagraph(audioBase64, mimeType, text) {
    playAudioFromBase64(audioBase64, mimeType, text, {
      speed: readPageState.speed,
      onEnd: () => {
        readPageState.currentIndex++;
        readNextParagraph();
      },
    }).catch((err) => showIndicator('error', err?.message || 'Playback failed'));
    // Keep the rolling prefetch window filled while this one plays
    prefetchWindow();
  }

  function readNextParagraph() {
    if (!readPageState.active) return;
    if (readPageState.currentIndex >= readPageState.paragraphs.length) {
      readPageState.active = false;
      prefetchMap.clear();
      prefetchInFlight.clear();
      showFinished();
      return;
    }

    const total = readPageState.paragraphs.length;
    const currentText = readPageState.paragraphs[readPageState.currentIndex].text;
    const prefetched = prefetchMap.get(readPageState.currentIndex);
    prefetchMap.delete(readPageState.currentIndex);

    // Ready in the window — play immediately (no network wait)
    if (prefetched && !prefetched.failed) {
      readPageState.consecutiveFailures = 0;  // Reset on success
      playCurrentParagraph(prefetched.audioBase64, prefetched.mimeType, currentText);
      return;
    }

    showIndicator('loading');

    if (prefetched && prefetched.failed) {
      // Prefetch already failed for this segment. Before counting a failure,
      // try switching providers — one switch per session.
      attemptFailover().then((switched) => {
        if (!readPageState.active) return;
        if (switched) {
          // Provider switched — retry THIS segment on the new provider
          fetchParagraphAudio(currentText, readPageState.currentIndex).then((result) => {
            if (!readPageState.active) return;
            if (!result) {
              showIndicator('error', 'Failover provider also failed — stopping');
              readPageState.active = false;
              return;
            }
            readPageState.consecutiveFailures = 0;
            playCurrentParagraph(result.audioBase64, result.mimeType, currentText);
          });
          return;
        }
        // No failover available — count and continue/stops as before
        readPageState.consecutiveFailures = (readPageState.consecutiveFailures || 0) + 1;
        if (readPageState.consecutiveFailures >= 2) {
          readPageState.active = false;
          prefetchMap.clear();
          prefetchInFlight.clear();
          showIndicator('error', 'Multiple failures — stopping');
          return;
        }
        readPageState.currentIndex++;
        readNextParagraph();
      });
      return;
    }

    // Not in the window yet — fetch now, and launch the eager warmup window
    // (WARMUP_AHEAD parallel fetches) so mid-read gaps never happen
    fetchParagraphAudio(currentText, readPageState.currentIndex).then((result) => {
      if (!readPageState.active) return;

      if (!result) {
        // Skip-and-continue: advance to the next segment; only give up after
        // 2 consecutive failures so one bad segment never kills the session.
        // On 2nd failure, try switching providers before giving up entirely.
        readPageState.consecutiveFailures = (readPageState.consecutiveFailures || 0) + 1;
        if (readPageState.consecutiveFailures >= 2) {
          attemptFailover().then((switched) => {
            if (!readPageState.active) return;
            if (!switched) {
              readPageState.active = false;
              prefetchMap.clear();
              prefetchInFlight.clear();
              showIndicator('error', 'Multiple failures — stopping');
              return;
            }
            // Switched — stay on this segment and retry with new provider
            readPageState.consecutiveFailures = 0;
            readNextParagraph();
          });
          return;
        }
        // Skip this segment and continue
        readPageState.currentIndex++;
        readNextParagraph();
        return;
      }

      readPageState.consecutiveFailures = 0;  // Reset on success
      playCurrentParagraph(result.audioBase64, result.mimeType, currentText);
    });
    // Eager warmup on the very first fetch of a session: launch WARMUP_AHEAD
    // parallel fetches immediately (user accepted longer initial load in
    // exchange for gapless playback). Later calls keep the rolling window topped.
    prefetchWindow(!warmupDone);
    if (!warmupDone) warmupDone = true;
  }

  function stopReading() {
    readPageState.active = false;
    readPageState.currentIndex = 0;
    prefetchMap.clear();
    prefetchInFlight.clear();
  }

  // ── Audio Playback ────────────────────────────────────────────────────────

  async function playAudioFromBase64(base64, mimeType, text, opts = {}) {
    const { speed = 1.0, onEnd = null } = opts;

    // Validate base64 data
    if (!base64 || base64.length < 100) {
      console.error('[Hanna] Invalid audio data:', { length: base64?.length, mimeType });
      throw new Error('Audio data is empty or too small');
    }

    // Validate MIME type
    const validMimes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp4'];
    if (!validMimes.includes(mimeType)) {
      console.warn('[Hanna] Unknown MIME type:', mimeType, '- falling back to audio/wav');
      mimeType = 'audio/wav';
    }

    // Convert base64 to blob URL
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Set up karaoke highlighting — find text in DOM dynamically
    let karaokeSpans = [];
    let wordCount = 0;
    if (text) {
      injectKaraokeStyle();

      // Find the scope element to search within
      // For Read Page: use the chunk's recorded source element — exact match,
      // no guessing. Probe-based search only if that element is gone (SPA rerender).
      // For Speak: search within the selection's parent element
      let scope = null;
      if (readPageState.active) {
        const sourceEl = readPageState.paragraphs[readPageState.currentIndex]?.sourceEl;
        if (sourceEl && sourceEl.isConnected) {
          scope = sourceEl;
        } else {
          // Fallback: probe the middle of the text — middles are more unique than
          // openings, which repeat across paragraphs and mis-match the highlight scope
          const midPoint = Math.floor(text.length / 2);
          const probe = text.slice(midPoint, midPoint + 50);
          for (const el of document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')) {
            if (el.textContent.includes(probe)) { scope = el; break; }
          }
        }
      } else {
        // Speak mode — use selection's parent element
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          scope = sel.getRangeAt(0).commonAncestorContainer;
          // If it's a text node, use its parent element
          if (scope.nodeType === Node.TEXT_NODE) scope = scope.parentElement;
        }
      }

      karaokeSpans = wrapSelectionWords(text, scope);
      wordCount = karaokeSpans.length;
      highlightSpans = karaokeSpans;
    }

    // Try Audio element first (supports preservesPitch for natural voice at speed)
    // Fall back to Web Audio API if CSP blocks blob URLs
    let useAudioElement = true;
    let audioCtx, source;

    currentAudio = new Audio(url);
    currentAudio.preservesPitch = true;  // Keep natural voice at any speed

    // Test if Audio element can load the blob URL
    const canPlay = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 1000);
      currentAudio.oncanplay = () => { clearTimeout(timeout); resolve(true); };
      currentAudio.onerror = () => { clearTimeout(timeout); resolve(false); };
      currentAudio.load();
    });

    // Set playbackRate AFTER load() — Chrome resets it during load()
    currentAudio.playbackRate = speed;

    if (!canPlay) {
      // CSP blocked blob URL — fall back to Web Audio API
      useAudioElement = false;
      currentAudio = null;
      URL.revokeObjectURL(url);

      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = bytes.buffer.slice(0);
      let audioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (err) {
        audioCtx.close();
        throw new Error('Failed to decode audio: ' + err.message);
      }

      source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = speed;
      source.connect(audioCtx.destination);

      // Create compatibility object for Web Audio API
      let isPaused = false;
      let pauseOffset = 0;

      currentAudio = {
        paused: false,
        ended: false,
        currentTime: 0,
        duration: audioBuffer.duration,
        playbackRate: speed,
        _source: source,
        _ctx: audioCtx,

        play() {
          if (isPaused) {
            const newSource = audioCtx.createBufferSource();
            newSource.buffer = audioBuffer;
            newSource.playbackRate.value = this.playbackRate;
            newSource.connect(audioCtx.destination);
            newSource.start(0, pauseOffset);
            this._source = newSource;
            this._startTime = audioCtx.currentTime - pauseOffset;
            isPaused = false;
            this.paused = false;
            if (this.onplay) this.onplay();
            return Promise.resolve();
          }
          source.start(0);
          this._startTime = audioCtx.currentTime;
          this.paused = false;
          if (this.onplay) this.onplay();
          return Promise.resolve();
        },

        pause() {
          if (!isPaused) {
            pauseOffset = audioCtx.currentTime - (this._startTime || 0);
            try { this._source.stop(); } catch (e) {}
            isPaused = true;
            this.paused = true;
            if (this.onpause) this.onpause();
          }
        },

        _tick() {
          if (!isPaused && !this.ended) {
            this.currentTime = audioCtx.currentTime - (this._startTime || 0);
          }
          if (!this.ended) {
            requestAnimationFrame(() => this._tick());
          }
        },

        _cleanup() {
          try { this._source.stop(); } catch (e) {}
          audioCtx.close();
          URL.revokeObjectURL(url);
        }
      };

      source.onended = () => {
        if (!isPaused && !currentAudio.ended) {
          currentAudio.ended = true;
          currentAudio.paused = true;
          currentAudio._cleanup();
          if (currentAudio.onended) currentAudio.onended();
        }
      };
    }

    // Set up event handlers
    currentAudio.onplay = () => {
      // Read Page: "Reading N%" (solid). Speak mode: "Reading" — the whole
      // selection plays at once, so there's no meaningful percentage to show
      if (readPageState.active) {
        const current = readPageState.currentIndex + 1;
        const total = readPageState.paragraphs.length;
        lastProgress = { current, total };
        showIndicator('speaking', null, lastProgress);
      } else {
        showIndicator('speaking');
      }
      if (wordCount > 0) {
        startHighlightSync(currentAudio, karaokeSpans);
      }
    };

    currentAudio.onpause = () => {
      if (!currentAudio.ended) {
        showIndicator('paused', null, lastProgress);
        if (highlightRaf) {
          cancelAnimationFrame(highlightRaf);
          highlightRaf = null;
        }
      }
    };

    currentAudio.onended = () => {
      if (highlightRaf) {
        cancelAnimationFrame(highlightRaf);
        highlightRaf = null;
      }
      karaokeSpans.forEach(s => {
        s.classList.remove('hanna-word-active', 'hanna-word-spoken');
      });
      cleanupHighlights();
      // Show "Finished" only for Speak mode (Read Page shows it when all paragraphs done)
      if (!onEnd) showFinished();
      if (!useAudioElement) currentAudio._cleanup();
      else URL.revokeObjectURL(url);
      currentAudio = null;
      if (onEnd) onEnd();
    };

    // Start playback
    if (useAudioElement) {
      await currentAudio.play().catch(() => showIndicator('error', 'Playback failed'));
    } else {
      await currentAudio.play();
      currentAudio._tick();
    }
  }

  function stopSpeaking() {
    stopReading();
    cleanupHighlights();
    if (currentAudio) {
      // Remove handlers before stopping to avoid state conflicts
      currentAudio.onpause = null;
      currentAudio.onended = null;
      // Cleanup based on type (Audio element vs Web Audio API compat object)
      if (currentAudio._cleanup) {
        try { currentAudio._cleanup(); } catch (e) {}
      } else if (currentAudio.pause) {
        currentAudio.pause();
        if (currentAudio.src && currentAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(currentAudio.src);
        }
      }
      currentAudio = null;
    }
    showIndicator('idle');
  }

  // Visual indicator — text status
  let indicatorEl = null;
  let wrapEl = null;
  let statusEl = null;
  let speedBtnEl = null;
  const SPEED_PRESETS = [1, 1.25, 1.5, 1.75, 2, 3];
  let currentSpeedIndex = 0;

  function cycleSpeed() {
    currentSpeedIndex = (currentSpeedIndex + 1) % SPEED_PRESETS.length;
    const speed = SPEED_PRESETS[currentSpeedIndex];
    if (speedBtnEl) speedBtnEl.textContent = `${speed}×`;

    // Apply speed to current audio if playing
    if (currentAudio) {
      currentAudio.playbackRate = speed;
      // For Web Audio API, also update the source
      if (currentAudio._source && currentAudio._source.playbackRate) {
        try {
          currentAudio._source.playbackRate.value = speed;
        } catch (e) { /* source might have ended */ }
      }
    }

    // Update readPageState if active
    if (readPageState.active) readPageState.speed = speed;
  }

  function showIndicator(state, errorMsg, progress) {
    if (!indicatorEl) {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes hanna-sweep { 0%{background-position:200% 50%} 100%{background-position:-200% 50%} }
        [data-read-aloud] .vc-wrap { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; display: none; }
        [data-read-aloud] .vc-pill { background: #0a0a0a; border: 1px solid #333; border-radius: 20px; padding: 6px 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 8px; cursor: grab; user-select: none; transition: box-shadow 0.15s; }
        [data-read-aloud] .vc-pill:hover { border-color: #555; }
        [data-read-aloud] .vc-pill.vc-dragging { cursor: grabbing; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border-color: #555; }
        [data-read-aloud] .vc-status { font-size: 11px; font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 400; cursor: pointer; }
        [data-read-aloud] .vc-status-rainbow {
          background: linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0088, #ff0000);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: hanna-sweep 1.5s linear infinite;
        }
        [data-read-aloud] .vc-divider { width: 1px; height: 12px; background: #333; }
        [data-read-aloud] .vc-speed { font-size: 11px; font-weight: 400; color: #fff; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; cursor: pointer; border: none; font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0; text-transform: none; transition: background 0.15s; }
        [data-read-aloud] .vc-speed:hover { background: rgba(255,255,255,0.2); }
        [data-read-aloud] .vc-stop { font-size: 11px; font-weight: 400; color: #fff; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; cursor: pointer; border: none; font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0; text-transform: none; transition: background 0.15s; }
        [data-read-aloud] .vc-stop:hover { background: rgba(255,255,255,0.2); }
        @media (prefers-reduced-motion: reduce) {
          [data-read-aloud] .vc-wrap { animation: none; }
          [data-read-aloud] .vc-status-rainbow { animation: none; -webkit-text-fill-color: #fff; }
        }
      `;
      document.head.appendChild(style);

      indicatorEl = document.createElement('div');
      indicatorEl.setAttribute('data-read-aloud', 'true');
      wrapEl = document.createElement('div');
      wrapEl.className = 'vc-wrap';
      const pill = document.createElement('div');
      pill.className = 'vc-pill';
      statusEl = document.createElement('span');
      statusEl.className = 'vc-status';
      const divider = document.createElement('div');
      divider.className = 'vc-divider';
      speedBtnEl = document.createElement('button');
      speedBtnEl.className = 'vc-speed';
      speedBtnEl.textContent = `${SPEED_PRESETS[currentSpeedIndex]}×`;
      const stopDivider = document.createElement('div');
      stopDivider.className = 'vc-divider';
      const stopBtnEl = document.createElement('button');
      stopBtnEl.className = 'vc-stop';
      stopBtnEl.textContent = '✕';
      pill.appendChild(statusEl);
      pill.appendChild(divider);
      pill.appendChild(speedBtnEl);
      pill.appendChild(stopDivider);
      pill.appendChild(stopBtnEl);
      wrapEl.appendChild(pill);
      indicatorEl.appendChild(wrapEl);
      document.body.appendChild(indicatorEl);

      // Click status to pause/resume (only if not dragged)
      statusEl.addEventListener('click', () => {
        if (hasMoved) return;
        if (!currentAudio) return;
        if (currentAudio.paused) {
          currentAudio.play();
          showIndicator('speaking', null, lastProgress);
        } else {
          currentAudio.pause();
          showIndicator('paused');
        }
      });

      // Click speed button to cycle speed (only if not dragged)
      speedBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (hasMoved) return;
        cycleSpeed();
      });

      // Click stop button to stop playback (only if not dragged)
      stopBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (hasMoved) return;
        stopSpeaking();
      });

      // Drag indicator
      let isDragging = false;
      let hasMoved = false;
      let dragStartX, dragStartY, dragStartLeft, dragStartTop;

      pill.addEventListener('mousedown', (e) => {
        if (e.target === speedBtnEl || e.target === stopBtnEl) return;
        isDragging = true;
        hasMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = pill.getBoundingClientRect();
        dragStartLeft = rect.left;
        dragStartTop = rect.top;
        pill.classList.add('vc-dragging');
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        let newLeft = dragStartLeft + dx;
        let newTop = dragStartTop + dy;
        const rect = pill.getBoundingClientRect();
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
        pill.style.position = 'fixed';
        pill.style.left = newLeft + 'px';
        pill.style.top = newTop + 'px';
        pill.style.right = 'auto';
        pill.style.bottom = 'auto';
        // Move wrap to match
        wrapEl.style.position = 'fixed';
        wrapEl.style.left = '0';
        wrapEl.style.top = '0';
        wrapEl.style.right = 'auto';
        wrapEl.style.bottom = 'auto';
      });

      document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        pill.classList.remove('vc-dragging');
      });
    }

    if (state === 'idle') {
      wrapEl.style.display = 'none';
    } else {
      wrapEl.style.display = 'block';

      // Read Page in-progress states share one label: "Reading N%".
      // The rainbow shimmer (loading) vs solid text (playing) distinguishes
      // fetching from playback — the percentage is the information, the verb
      // is constant. Paused prepends its state so audio state stays explicit.
      if ((state === 'speaking' || state === 'loading') && progress) {
        const percent = Math.min(100, Math.round((progress.current / progress.total) * 100));
        statusEl.textContent = `Reading ${percent}%`;
        statusEl.style.color = '#fff';
        statusEl.classList.toggle('vc-status-rainbow', state === 'loading');
        return;
      }
      // Fetching with no progress context (Speak mode) → classic Loading shimmer
      if (state === 'loading') {
        statusEl.textContent = 'Loading';
        statusEl.style.color = '#fff';
        statusEl.classList.add('vc-status-rainbow');
        return;
      }
      if (state === 'paused' && progress) {
        const percent = Math.min(100, Math.round((progress.current / progress.total) * 100));
        statusEl.textContent = `Paused ${percent}%`;
        statusEl.style.color = '#fff';
        statusEl.classList.remove('vc-status-rainbow');
        return;
      }

      const config = {
        loading: { text: 'Loading', color: '#fff', rainbow: true },
        speaking: { text: 'Reading', color: '#fff', rainbow: false },
        paused: { text: 'Paused', color: '#fff', rainbow: false },
        error: { text: 'Error', color: '#f87171', rainbow: false },
        finished: { text: 'Completed', color: '#4ade80', rainbow: false },
      };

      const { text, color, rainbow } = config[state] || config.loading;
      // Show error details if available, truncated to ~80 chars
      if (state === 'error' && errorMsg) {
        const truncated = errorMsg.length > 80 ? errorMsg.slice(0, 80) + '…' : errorMsg;
        statusEl.textContent = truncated;
      } else {
        statusEl.textContent = text;
      }
      statusEl.style.color = color;
      statusEl.classList.toggle('vc-status-rainbow', rainbow);
    }
  }

  // Show "Completed" for 1.5s then hide — confirms completion instead of abrupt vanish
  function showFinished() {
    showIndicator('finished');
    setTimeout(() => showIndicator('idle'), 1500);
  }

  // Test/CI export hook — `module` doesn't exist in content-script context,
  // so this is inert in the browser (same pattern Readability.js uses)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { tokenize, splitIntoChunks, normaliseForMatch };
  }
})();
