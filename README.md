<div align="center">

# 🎧 Hanna

**Read the web aloud with natural AI voices — and follow along, word by word.**

A Chrome extension that turns any article into a listening experience: karaoke-style
highlighting, designed or cloned voices, full-page reading that skips the clutter.

[Features](#-features) · [Quick start](#-quick-start) · [Providers](#-providers) · [How it works](#-how-it-works) · [Privacy](PRIVACY.md)

</div>

---

## ✨ Features

### Two ways to listen

| | |
|---|---|
| **Speak** — highlight any text, right-click, hear it instantly | **Read Page** — one click reads the entire article top to bottom, automatically skipping menus, ads, and page chrome |

### Karaoke highlighting

Words light up as they're spoken, with auto-scroll keeping the current word centred.
Works on English and Chinese text alike.

### Voices, your way

- **28 preset voices** — professional, expressive, character styles and more
- **Voice design** — describe any voice in words: *"a warm Australian female with a soothing tone"*
- **Voice cloning** — upload a sample clip; Hanna reads in that voice
- Speed control from 1× to 3× with natural pitch preservation

### Built for real reading sessions

- **Gapless playback** — upcoming paragraphs are fetched ahead while you listen
- **Provider failover** — if a TTS provider fails mid-article, Hanna switches to your backup and keeps reading
- **Smart caching** — repeated reads don't re-hit the API
- **Graceful everywhere** — clean messages on pages without articles, rate limits, or network drops

## 🚀 Quick start

1. Clone or download this repository
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Click the Hanna icon → pick a provider → paste your API key → **Test Connection**
5. Select some text, right-click → **Hanna: Speak** 🎉

> You'll need an API key from at least one provider (see below). Fish Audio has a free model.

## 🔌 Providers

| Provider | Presets | Voice Design | Cloning | Notes |
|---|:-:|:-:|:-:|---|
| **MiMo TTS** (Xiaomi) | 28 | ✅ | ✅ | Cantonese-capable dialect tags |
| **Fish Audio** | 13 | — | ✅ | Free tier available (`s2.1-pro-free`) |
| **ElevenLabs** | 16 | — | ✅ | Multilingual v2 model |

Hanna is *bring-your-own-key*: you configure providers directly, keys never leave your browser.

## 🧠 How it works

```text
Right-click → "Hanna: Speak" / "Hanna: Read Page"
      ↓
content.js extracts the text (bundled Readability.js for Read Page)
      ↓
long paragraphs split into sentence-bounded chunks (~900 chars)
      ↓
background.js requests audio from your chosen provider
   - rolling prefetch + eager warmup keep playback gapless
   - provider failover kicks in after repeated failures
      ↓
content.js plays audio with word-level highlighting
```

## 🛠 Development

```bash
npm install
npm test        # run the test suite (Vitest + jsdom)
```

Tests cover the tricky pure logic: text tokenisation (CJK-aware), sentence-bounded
chunking, typographic-character normalisation, karaoke wrapping, cache keys, and the
byline/junk filters. CI runs them on every push.

Project layout:

```
extension/
├── manifest.json       MV3 manifest
├── background.js       TTS requests, caching, failover, injection
├── content.js          extraction, playback, karaoke, pill UI
├── Readability.js      bundled Mozilla reader-mode library
├── utils.js            shared constants & voice presets
└── sidepanel/          settings & provider management UI
tests/                  Vitest suite (48 tests)
```

## ⌨️ Shortcuts

| Key | Action |
|---|---|
| `Esc` | Stop playback |
| Click pill | Pause / resume |
| Click speed chip | Cycle 1× → 3× |

## 🔒 Privacy

No analytics, no accounts, no servers. Text goes directly from your browser to the TTS
provider you configure; API keys stay in local storage. See [PRIVACY.md](PRIVACY.md).

## 📄 License

MIT
