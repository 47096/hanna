# Hanna

Read beautifully. A Chrome extension that reads text aloud using AI voices — with voice design, voice cloning, and a library of premium voices.

## Setup

1. Open `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select the `extension/` folder
3. Click the Hanna icon → select a provider → enter your API key → hit **Test Connection**

## How to use

**Read selected text:**
Select text → right-click → **Hanna: Speak**

**Read entire page:**
Right-click anywhere → **Hanna: Read page**

**Stop playback:**
Press **Escape** or click **✕** on the indicator

**Playback controls:**
- Click the indicator to pause/resume
- Click the speed button to cycle: 1× → 1.25× → 1.5× → 1.75× → 2× → 3×
- Karaoke highlighting follows along as text is read

## Providers

| Provider | Preset Voices | Voice Design | Voice Clone | Models |
|----------|:-------------:|:------------:|:-----------:|--------|
| **MiMo TTS** | ✅ | ✅ | ✅ | mimo-v2.5-tts |
| **ElevenLabs** | ✅ | — | ✅ | eleven_multilingual_v2 |
| **Fish Audio** | ✅ | — | ✅ | s2.1-pro-free, s2.1-pro, s2.1-lite |

### MiMo TTS
- **Preset voices** — 28 curated voices across Professional, Expressive, Youthful, Character, and Accent categories
- **Voice design** — describe a voice in words ("a warm Australian female with a soothing tone") or pick from 28 design presets
- **Voice clone** — upload an audio clip (MP3, WAV, WebM, OGG, M4A, max 5MB)

### ElevenLabs
- **Preset voices** — 16 premium voices (7 female, 9 male)
- **Voice clone** — upload a voice sample, get a voice ID back

### Fish Audio
- **Preset voices** — 13 voices across General, Narrator, and Character categories
- **Voice clone** — upload a voice sample with a custom name
- **Model selection** — choose between free (s2.1-pro-free), paid (s2.1-pro), or fast (s2.1-lite)

## Architecture

```
Right-click → "Hanna: Speak" / "Hanna: Read page"
  → background.js ensures content script is injected
  → TTS request to MiMo / ElevenLabs / Fish Audio API
  → audio returned to content.js
  → content.js plays with karaoke highlighting
```

No local server. No external dependencies. Just the extension.

## Tech Stack

- Chrome Extension (Manifest V3)
- MiMo TTS v2.5 (Xiaomi) — preset, voice design, voice clone
- ElevenLabs API — TTS, voice cloning, voice library
- Fish Audio API — TTS, voice cloning, model selection
- Vanilla JS — no frameworks, no build step

## Storage

- **Settings** — `chrome.storage.sync` (syncs across devices)
- **API keys & voice clones** — `chrome.storage.local` (unlimited storage)
- **TTS cache** — `chrome.storage.session` (survives service worker restarts, clears on browser close)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Escape** | Stop playback |
