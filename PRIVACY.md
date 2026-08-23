# Privacy Policy — Hanna

_Last updated: 23 August 2026_

Hanna is a browser extension that reads text aloud using AI text-to-speech services. This policy explains exactly what data the extension handles and where it goes.

## The short version

Hanna has **no server of its own**. It does not collect, store, transmit, or sell any personal data anywhere except directly to the TTS provider **you choose and configure with your own API key**. All settings and keys stay in your browser's local storage on your machine.

## What data Hanna processes

| Data | Where it goes | Why |
|---|---|---|
| Text you select (Speak) or the article text on the page (Read Page) | Directly from your browser to your chosen TTS provider's API (MiMo, Fish Audio, or ElevenLabs) | The provider needs the text to generate speech audio |
| Voice clone audio you upload | Stored locally in your browser (`chrome.storage.local`); sent to MiMo only when generating speech | Cloning requires the provider to receive the reference audio |
| Your API key(s) for each provider | Stored locally in your browser only (`chrome.storage.local`) — never synced, never sent anywhere except to that same provider for authentication | Needed to call the provider you configured |
| Your settings (provider, voice, speed, language) | Stored locally in your browser (`chrome.storage.sync` / `local`) | So your preferences persist |

## What Hanna never does

- ❌ No analytics, telemetry, or tracking of any kind
- ❌ No account system; nothing is tied to an identity
- ❌ No servers, databases, or backend operated by us
- ❌ No reading of pages you haven't explicitly triggered Speak/Read Page on
- ❌ No sharing or selling of any data

## Third-party TTS providers

When you trigger a read, the page/selection text is transmitted to whichever provider is selected at that moment:

- **MiMo (Xiaomi)** — https://xiaomimimo.com — see their privacy policy for their handling practices
- **Fish Audio** — https://fish.audio
- **ElevenLabs** — https://elevenlabs.io

Your use of these providers is additionally governed by their own terms and privacy policies. You supply the API key, so you control (and pay for) that relationship directly.

## Audio cache

Generated audio is cached locally in your browser's session storage so repeated reads don't re-hit the API. The cache lives in memory/session storage only, is capped in size, and disappears when the browser closes.

## Data deletion

Uninstalling the extension removes everything: keys, settings, clone audio, and caches. Nothing survives outside your browser.

## Changes

Material changes to this policy will be noted with a new "last updated" date above.

## Contact

Questions about this policy: open an issue on the project repository.
