# Hanna Testing Guide

## Setup

1. Open Chrome → go to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" → select `/Users/samuel/projects/hanna/extension`
4. Pin the extension to your toolbar (click puzzle icon → pin Hanna)
5. Open DevTools (F12) → go to Console tab (keep it open during testing)

---

## 1. First Run

### Test: Extension loads without errors
1. Go to `chrome://extensions`
2. Find "Hanna" in the list
3. Check there are no red error badges
4. Click the extension icon → side panel should open

**Expected:** No errors. Side panel opens with provider tabs (MiMo, ElevenLabs, Fish).

### Test: No console errors on fresh install
1. Open any webpage (e.g., `https://example.com`)
2. Press F12 → Console tab
3. Check for any red `[Hanna]` errors

**Expected:** No errors in console.

---

## 2. Speak (Right-click)

### Test: Basic speak
1. Go to any article (e.g., `https://en.wikipedia.org/wiki/Cat`)
2. Highlight a sentence (e.g., "The domestic cat is a species")
3. Right-click → select "Hanna: Speak"
4. Watch the indicator in bottom-right corner

**Expected:** 
- Indicator appears with "Loading" (rainbow shimmer)
- Changes to "Speaking" when audio starts
- Audio plays the selected text
- Indicator hides when done

### Test: Pause/Resume
1. While audio is playing, click the indicator text ("Speaking")
2. Audio should pause, indicator shows "Paused"
3. Click again → audio resumes, indicator shows "Speaking"

**Expected:** Smooth pause/resume toggle.

### Test: Works on styled text
1. Find text that crosses **bold** or *italic* formatting
2. Example: Select "The **domestic cat** is a species"
3. Right-click → "Hanna: Speak"

**Expected:** Audio plays full text. If karaoke is enabled, words highlight correctly across formatting boundaries.

### Test: Works on links
1. Find text that includes a hyperlink
2. Select text that crosses the link boundary
3. Right-click → "Hanna: Speak"

**Expected:** Audio plays. No errors.

### Test: Works with Chinese text
1. Go to a Chinese webpage (e.g., `https://zh.wikipedia.org/wiki/猫`)
2. Select some Chinese text
3. Right-click → "Hanna: Speak"

**Expected:** Audio plays Chinese text correctly.

---

## 3. Karaoke Highlighting

### Test: Words highlight one by one
1. Select a paragraph of text
2. Right-click → "Hanna: Speak"
3. Watch the text as audio plays

**Expected:** Each word gets a yellow highlight as it's spoken. Only one word highlighted at a time.

### Test: Highlighting stays in sync
1. Let audio play for 10-15 seconds
2. Check if highlighting is still matching the spoken word

**Expected:** No noticeable drift between audio and highlighting.

### Test: Auto-scroll
1. Select a long paragraph that extends below the viewport
2. Right-click → "Hanna: Speak"
3. Wait for audio to reach words below the screen

**Expected:** Page scrolls automatically to keep the highlighted word visible.

### Test: No text movement
1. Watch the text closely while highlighting changes
2. Check if text jumps or shifts position

**Expected:** Text stays perfectly still. Only background color changes.

### Test: Clean finish
1. Wait for audio to finish completely
2. Check the indicator pill and text after highlighting ends

**Expected:** Pill shows "Completed" in green for 1.5 seconds, then hides. All yellow highlights removed. Text returns to normal appearance.

---

## 4. Speed Control

### Test: Speed button appears
1. Start speaking any text
2. Look at the indicator in bottom-right

**Expected:** Indicator shows "Speaking" with a speed button (e.g., "1×").

### Test: Speed cycling
1. Click the speed button on the indicator
2. Watch the speed value change

**Expected:** Cycles through: 1× → 1.25× → 1.5× → 1.75× → 2× → 3× → 1× (loops)

### Test: Speed affects audio
1. Set speed to 2×
2. Speak some text
3. Audio should play noticeably faster

**Expected:** Audio plays at 2× speed.

### Test: Speed persists
1. Set speed to 1.5×
2. Reload the page (Ctrl+R or Cmd+R)
3. Speak some text again

**Expected:** Speed is still 1.5× (saved in storage).

---

## 4b. Stop Button

### Test: Stop button appears
1. Start speaking any text (right-click → "Hanna: Speak" or "Hanna: Read page")
2. Look at the indicator pill

**Expected:** Pill shows: `[Speaking | 1× | ✕]` — status, speed button, and stop button (✕) in red.

### Test: Stop button stops playback
1. Start speaking a long text
2. Click the ✕ button on the pill

**Expected:** Audio stops immediately. Indicator hides. No residual highlighting.

### Test: Stop button works during Read Page
1. Right-click → "Hanna: Read page" on an article
2. While it's reading, click ✕

**Expected:** Reading stops. Progress counter disappears. No more paragraphs are read.

### Test: Stop button doesn't trigger on drag
1. Start speaking text
2. Drag the pill to a new position
3. Release the pill

**Expected:** Dragging works normally. Stop is not triggered by the drag release.

---

## 5. Read Page

### Test: Read full article
1. Go to an article (e.g., `https://en.wikipedia.org/wiki/Cat`)
2. Don't select any text
3. Right-click → select "Hanna: Read page"

**Expected:**
- Indicator shows "Loading"
- Article starts reading (headlines + paragraphs)
- Indicator shows progress like "3/15 · 20%" instead of just "Speaking"
- Karaoke highlights each word
- Transitions smoothly between paragraphs
- Indicator hides when done

### Test: Read selected text
1. Select a few paragraphs of an article
2. Right-click → "Hanna: Read page"

**Expected:** Only reads the selected paragraphs, not the whole page.

### Test: Reads headlines
1. Find an article with h1, h2, h3 headings
2. Right-click → "Hanna: Read page"

**Expected:** Headlines are read aloud (not skipped).

### Test: Progress counter
1. Go to an article with multiple paragraphs
2. Right-click → "Hanna: Read page"
3. Watch the indicator pill during playback

**Expected:** Indicator shows "X/Y · Z%" format (e.g., "5/20 · 25%") during Read Page mode. Counter updates as each segment plays. Shows "Speaking" (no counter) for right-click Speak mode.

### Test: Works on non-article pages
1. Go to a dashboard or SPA (e.g., Gmail, GitHub)
2. Right-click → "Hanna: Read page"

**Expected:** Shows "Error" with message "No content found — try selecting text".

### Test: Long paragraph chunking
1. Go to an article with long paragraphs (e.g., a Medium post)
2. Right-click → "Hanna: Read page"
3. Observe the reading flow

**Expected:** Long paragraphs are split into sentence-bounded chunks (~900 chars max). Reading flows smoothly without scrambled/reordered phrases. No single segment exceeds ~900 characters.

### Test: Junk filtering on homepage
1. Go to a non-article page with nav menus (e.g., `https://github.com`, `https://news.ycombinator.com`)
2. Right-click → "Hanna: Read page"

**Expected:** Navigation items ("Home", "About", "Sign in", "Pricing") are filtered out. If no article content is found, shows "No content found" error. No reading of button labels or menu items.

### Test: Session survives one failed segment
1. Start reading an article
2. If a single TTS request fails (network hiccup), observe what happens

**Expected:** The failed segment is skipped and reading continues with the next segment. Reading only stops after 2 consecutive failures. No abrupt session termination on single failures.

### Test: Duplicate element deduplication
1. Go to a page where Readability might extract nested elements (e.g., a blog with nested lists)
2. Right-click → "Hanna: Read page"

**Expected:** No text is read twice in a row. Parent elements containing child `<p>` or `<li>` elements are not duplicated.

### Test: Stray selection ignored
1. Select just 1-2 words on a page
2. Right-click → "Hanna: Read page"

**Expected:** The small selection is ignored. Read Page falls through to article extraction and reads the full article (not the 1-2 selected words).

### Test: Karaoke highlights correct paragraph
1. Go to an article with similar paragraph openings (e.g., repeated headers or similar sentences)
2. Right-click → "Hanna: Read page"
3. Watch karaoke highlighting as it reads

**Expected:** Karaoke highlights the correct paragraph being read, even when multiple paragraphs share similar opening text. No jumping to wrong paragraphs.

---

## 6. Error Handling

### Test: No API key
1. Open side panel
2. Make sure no API key is entered for the current provider
3. Try to speak some text

**Expected:** Indicator shows error message (not crash). Message should say something like "MiMo API key not configured".

### Test: Network error
1. Disconnect from internet (turn off WiFi)
2. Try to speak some text

**Expected:** Indicator shows error message about network failure.

### Test: Text too long
1. Select a very long text (more than 10,000 characters)
2. Right-click → "Hanna: Speak"

**Expected:** Indicator shows "Text too long (XX,XXX chars) — select less".

### Test: Rate limiting
1. If you hit rate limits, indicator should show appropriate error
2. Should not crash or hang

**Expected:** Error message displayed. Can try again after waiting.

---

## 7. Draggable Indicator

### Test: Drag indicator
1. Start speaking some text
2. Click and hold on the indicator pill (not the speed button)
3. Drag to a new position on screen

**Expected:** Indicator follows mouse. Can place it anywhere on screen.

### Test: Stays in bounds
1. Drag indicator to the edge of the screen
2. Try to drag it outside the browser window

**Expected:** Indicator stops at screen edge. Doesn't disappear off-screen.

### Test: Controls still work after drag
1. Drag indicator to a new position
2. Click speed button → should still cycle
3. Click status text → should still pause/resume

**Expected:** All controls work normally after dragging.

---

## 8. Settings (Side Panel)

### Test: API key saves on paste
1. Open side panel → go to Settings (gear icon)
2. Click on the API key field
3. Paste your API key
4. Immediately click "TEST" button (without clicking elsewhere first)

**Expected:** Test succeeds (key was saved immediately on paste).

### Test: MiMo connection test
1. Select MiMo provider
2. Enter your MiMo API key
3. Click "TEST" button

**Expected:** Shows "● Connected" or appropriate status.

### Test: ElevenLabs connection test
1. Select ElevenLabs provider
2. Enter your ElevenLabs API key
3. Click "TEST" button

**Expected:** Shows "● [tier name]" (e.g., "● free").

### Test: Fish Audio connection test
1. Select Fish Audio provider
2. Enter your Fish Audio API key
3. Click "TEST" button

**Expected:** Shows "● Connected".

### Test: Voice preset selection
1. Select MiMo provider
2. Click "Preset" mode
3. Select different voices from the dropdown

**Expected:** Description updates below dropdown. Voice changes when you speak.

### Test: Voice design
1. Select MiMo provider
2. Click "Design" mode
3. Type a voice description (e.g., "A warm British male voice")
4. Speak some text

**Expected:** Audio uses your custom voice description.

### Test: Voice clone upload
1. Select MiMo provider
2. Click "Clone" mode
3. Click upload area → select an audio file
4. File should upload and show status

**Expected:** File uploads. Status shows filename and size.

---

## 9. Edge Cases

### Test: Heavy pages
1. Go to a large Wikipedia article
2. Try speaking text

**Expected:** Works without hanging or crashing. May take a moment to inject.

### Test: Single Page Apps
1. Go to a SPA like Gmail or GitHub
2. Try speaking text

**Expected:** Works. Content script injects correctly.

### Test: Page navigation
1. Speak text on page A
2. Navigate to page B (click a link)
3. Try speaking text on page B

**Expected:** Works on page B. No stale state from page A.

### Test: Multiple rapid requests
1. Quickly select text and right-click "Speak" multiple times
2. Don't wait for previous audio to finish

**Expected:** Previous audio stops. New audio starts. No crash or overlap.

### Test: Stop mid-audio
1. Start speaking a long text
2. While audio is playing, right-click → "Hanna: Speak" on different text

**Expected:** Previous audio stops immediately. New audio starts.

---

## 10. Security

### Test: No user text in console
1. Open DevTools (F12) → Console
2. Speak some text (any text)
3. Check console logs

**Expected:** Logs show `[Hanna] speakText: length 42` (not the actual text).

### Test: CSP active
1. Go to `chrome://extensions`
2. Click "Details" on Hanna
3. Check for Content Security Policy

**Expected:** CSP is listed. No "eval" or inline scripts allowed.

### Test: API keys not in content script
1. Open DevTools on any page
2. Go to Console
3. Try: `document.querySelectorAll('script')`

**Expected:** No API keys visible in page context.

---

## Browser Console Commands (for debugging)

```javascript
// Check if content script is loaded
window.__hanna_injected

// Check current audio state (in content script context)
// (These won't work from regular console - content script has isolated context)

// Check storage (in extension context)
chrome.storage.sync.get(null, console.log)
chrome.storage.local.get(null, console.log)
```

---

## Test Results Template

| Test | Status | Notes |
|------|--------|-------|
| First Run | ⬜ | |
| Speak Basic | ⬜ | |
| Speak Pause/Resume | ⬜ | |
| Speak Styled Text | ⬜ | |
| Speak Links | ⬜ | |
| Speak Chinese | ⬜ | |
| Karaoke Sync | ⬜ | |
| Karaoke Scroll | ⬜ | |
| Karaoke No Movement | ⬜ | |
| Karaoke Clean Finish | ⬜ | |
| Speed Cycling | ⬜ | |
| Speed Affects Audio | ⬜ | |
| Speed Persists | ⬜ | |
| Stop Button Appears | ⬜ | |
| Stop Button Stops | ⬜ | |
| Stop Button Read Page | ⬜ | |
| Stop Button No Drag | ⬜ | |
| Read Full Article | ⬜ | |
| Read Selection | ⬜ | |
| Read Headlines | ⬜ | |
| Read Progress Counter | ⬜ | |
| Read Long Paragraph Chunking | ⬜ | |
| Read Junk Filtering | ⬜ | |
| Read Session Survives Failure | ⬜ | |
| Read Duplicate Element Dedupe | ⬜ | |
| Read Stray Selection Ignored | ⬜ | |
| Read Karaoke Correct Paragraph | ⬜ | |
| Error No API Key | ⬜ | |
| Error Network | ⬜ | |
| Error Text Too Long | ⬜ | |
| Drag Indicator | ⬜ | |
| Drag Bounds | ⬜ | |
| Drag Controls Work | ⬜ | |
| API Key Saves | ⬜ | |
| MiMo Connection | ⬜ | |
| ElevenLabs Connection | ⬜ | |
| Fish Connection | ⬜ | |
| Voice Preset | ⬜ | |
| Voice Design | ⬜ | |
| Voice Clone | ⬜ | |
| Heavy Pages | ⬜ | |
| SPA Pages | ⬜ | |
| Page Navigation | ⬜ | |
| Multiple Requests | ⬜ | |
| Stop Mid-Audio | ⬜ | |
| No Text in Console | ⬜ | |
| CSP Active | ⬜ | |

**Sign-off:**
- Tested by: _______________
- Date: _______________
- Version: _______________
- Result: ⬜ PASS / ⬜ FAIL (see notes)
