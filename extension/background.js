// Background service worker — Hanna
importScripts('utils.js');

// ── Open side panel on icon click ───────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// ── Context menu ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'hanna',
    title: 'Hanna: Speak',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'hanna-read-page',
    title: 'Hanna: Read Page',
    contexts: ['page', 'frame'],
  });
});

async function ensureContentScript(tabId, includeReadability = false) {
  let contentReady = false;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    contentReady = true;
  } catch (err) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  }

  // Readability is needed for Read Page but only injected alongside content.js.
  // If content.js was already injected (e.g. by an earlier Speak), probe for
  // Readability explicitly — otherwise article extraction silently fails.
  if (includeReadability) {
    let hasReadability = false;
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: 'HAS_READABILITY' });
      hasReadability = !!res?.present;
    } catch (err) { hasReadability = false; }
    if (!hasReadability) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['Readability.js'],
      });
    }
  }

  // Wait for content script to be ready by polling with PING
  if (!contentReady) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        return; // Script is ready
      } catch (e) {
        if (attempt === 2) throw e; // Last attempt failed
      }
    }
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'hanna' && info.selectionText) {
    try {
      await ensureContentScript(tab.id, false);
      await chrome.tabs.sendMessage(tab.id, { type: 'SPEAK', text: info.selectionText });
    } catch (err) {
      // Restricted pages (chrome://, edge://, etc.) can't be scripted
      console.warn('[Hanna] Cannot inject on this page:', err.message);
      // Show error via badge since content script can't run
      chrome.action.setBadgeText({ text: '!', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c', tabId: tab.id });
      setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 3000);
    }
  } else if (info.menuItemId === 'hanna-read-page') {
    try {
      await ensureContentScript(tab.id, true);
      await chrome.tabs.sendMessage(tab.id, { type: 'READ_PAGE' });
    } catch (err) {
      console.warn('[Hanna] Cannot inject on this page:', err.message);
      chrome.action.setBadgeText({ text: '!', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c', tabId: tab.id });
      setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 3000);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from our own extension
  if (sender.id !== chrome.runtime.id) return;

  if (msg.type === 'TTS_REQUEST') {
    (async () => {
      try {
        const overrides = msg.failoverProvider ? { failoverProvider: msg.failoverProvider } : null;
        const audioData = await handleTTS(msg.text, overrides);
        sendResponse(audioData);
      } catch (err) {
        console.error('[Hanna] TTS error:', err.message);
        sendResponse({ error: err.message });
      }
    })();
    return true; // async
  }
  // Failover support — report which providers have keys configured so the
  // content script knows where it can switch to when the current one fails
  if (msg.type === 'FAILOVER_CHECK') {
    (async () => {
      try {
        const settings = await getSettings();
        const providersWithKeys = [];
        if (settings.mimoApiKey) providersWithKeys.push('mimo');
        if (settings.fishApiKey) providersWithKeys.push('fish');
        if (settings.elevenlabsApiKey) providersWithKeys.push('elevenlabs');
        sendResponse({ providersWithKeys, currentProvider: settings.provider || DEFAULT_PROVIDER });
      } catch (err) {
        sendResponse({ providersWithKeys: [], currentProvider: DEFAULT_PROVIDER });
      }
    })();
    return true;
  }
  if (msg.type === 'TEST_TTS') {
    (async () => {
      try {
        const audioData = await handleTTS(msg.text, msg.settings);
        sendResponse(audioData);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async
  }
  if (msg.type === 'CLONE_ELEVENLABS') {
    (async () => {
      try {
        const result = await cloneElevenLabs(msg.apiKey, msg.name, msg.fileData, msg.fileName);
        sendResponse(result);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async
  }
  if (msg.type === 'CLONE_FISH') {
    (async () => {
      try {
        const result = await cloneFish(msg.apiKey, msg.name, msg.fileData, msg.fileName);
        sendResponse(result);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async
  }
  if (msg.type === 'READ_PAGE_FROM_SIDEPANEL') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab');
        await ensureContentScript(tab.id, true);
        await chrome.tabs.sendMessage(tab.id, { type: 'READ_PAGE' });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async
  }
});

// ── TTS Cache ────────────────────────────────────────────────────────────────
// Uses chrome.storage.session to persist across service worker restarts (MV3 dies after ~30s idle)
const ttsCache = new Map();  // key → { data, size }
const CACHE_MAX_BYTES = 1024 * 1024;  // 1MB cap (session storage limit)
let cacheSize = 0;
let cacheLoaded = false;
let cacheMutex = Promise.resolve();  // Serialize cache writes to prevent race conditions

// (cache keys are built by buildCacheKey below — provider:voice:text)

// Load cache from session storage on startup
async function loadCache() {
  if (cacheLoaded) return;
  try {
    const stored = await chrome.storage.session.get('ttsCache');
    if (stored.ttsCache) {
      const entries = stored.ttsCache;
      for (const [key, value] of Object.entries(entries)) {
        ttsCache.set(key, value);
        cacheSize += value.size || 0;
      }
    }
  } catch (e) {
    // session storage may not be available
  }
  cacheLoaded = true;
}

// Save cache to session storage — immediate, no debounce
async function saveCacheImmediate() {
  try {
    const entries = Object.fromEntries(ttsCache);
    await chrome.storage.session.set({ ttsCache: entries });
  } catch (e) {
    // Quota exceeded or session storage unavailable — silent fail is OK
  }
}

// Debounced save for normal operation (batches rapid writes)
let saveTimer = null;
function saveCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCacheImmediate, 500);
}

// Flush on service worker suspend (best-effort — the async set may not
// complete if the worker is killed mid-write, so this is opportunistic only)
chrome.runtime.onSuspend?.addListener(() => {
  clearTimeout(saveTimer);
  // Fire-and-forget write — if the worker dies mid-write, the debounced save
  // that already ran is our floor
  try {
    const entries = Object.fromEntries(ttsCache);
    chrome.storage.session.set({ ttsCache: entries });
  } catch (e) {
    // Best effort
  }
});

async function cacheSet(key, data) {
  await loadCache();
  const size = data.audioBase64 ? data.audioBase64.length : 0;

  // Serialize writes to prevent stale cacheSize race
  cacheMutex = cacheMutex.then(async () => {
    // Evict oldest entries until we have room
    while (cacheSize + size > CACHE_MAX_BYTES && ttsCache.size > 0) {
      const [oldestKey, oldest] = ttsCache.entries().next().value;
      cacheSize -= oldest.size;
      ttsCache.delete(oldestKey);
    }
    ttsCache.set(key, { data, size });
    cacheSize += size;
  });
  await cacheMutex;
  saveCache();
}

async function cacheGet(key) {
  await loadCache();
  const entry = ttsCache.get(key);
  return entry ? entry.data : null;
}

// Voice clone cache — avoid re-reading multi-MB from storage on every call
let cachedVoiceClone = null;
chrome.storage.onChanged.addListener((changes) => {
  if (changes.mimoVoiceClone) cachedVoiceClone = null;
});

// Voice key for the TTS cache — preset/design/clone all resolve to a stable string
function buildCacheKey(provider, settings) {
  const voiceMode = settings.voiceMode || 'preset';
  let voice = settings.mimoPresetVoice || settings.elevenlabsVoiceId || settings.fishVoiceId || '';
  if (provider === 'mimo' && voiceMode === 'design') {
    voice = `design:${settings.mimoVoiceDescription || ''}`;
  }
  return `${provider}:${voice}`;
}

async function handleTTS(text, overrides = null) {
  const settings = overrides || await getSettings();

  if (!overrides && settings.enabled === false) {
    throw new Error('Hanna is disabled');
  }

  // Failover: caller may override which provider handles this request
  const provider = overrides?.failoverProvider || settings.provider || DEFAULT_PROVIDER;
  if (overrides?.failoverProvider) {
    settings.provider = overrides.failoverProvider;
  }

  // Voice clone audio is stored in local storage (large data — don't pass via message)
  if (provider === 'mimo' && (!overrides || overrides.voiceMode === 'clone')) {
    if (cachedVoiceClone === null) {
      const localData = await chrome.storage.local.get(['mimoVoiceClone']);
      cachedVoiceClone = localData.mimoVoiceClone || '';
    }
    settings.mimoVoiceClone = cachedVoiceClone;
  }

  // Check cache (skip if overrides = test mode)
  if (!overrides) {
    const key = buildCacheKey(provider, settings) + ':' + text;
    const cached = await cacheGet(key);
    if (cached) return cached;
  }

  let result;
  if (provider === 'mimo') {
    result = await mimoTTS(text, settings);
  } else if (provider === 'elevenlabs') {
    result = await elevenLabsTTS(text, settings);
  } else if (provider === 'fish') {
    result = await fishTTS(text, settings);
  } else {
    throw new Error('Unknown provider: ' + provider);
  }

  // Store in cache (size-based LRU)
  if (!overrides && result) {
    const key = buildCacheKey(provider, settings) + ':' + text;
    await cacheSet(key, result);
  }

  return result;
}

// ── MiMo TTS ────────────────────────────────────────────────────────────────

async function mimoTTS(text, settings) {
  const apiKey = settings.mimoApiKey;
  if (!apiKey) throw new Error('MiMo API key not configured');

  const ALLOWED_MIMO_HOSTS = [
    'token-plan-sgp.xiaomimimo.com',
    'token-plan-cn.xiaomimimo.com',
    'api.xiaomimimo.com',
  ];
  const baseUrl = settings.mimoBaseUrl || 'https://token-plan-sgp.xiaomimimo.com';
  if (!baseUrl.startsWith('https://')) throw new Error('Base URL must use HTTPS');
  const parsedHost = new URL(baseUrl).host;
  if (!ALLOWED_MIMO_HOSTS.includes(parsedHost)) throw new Error('Unauthorised MiMo base URL');
  const voiceMode = settings.voiceMode || 'preset';
  const voiceCloneData = settings.mimoVoiceClone || '';
  const voiceDescription = settings.mimoVoiceDescription || '';
  const presetVoice = settings.mimoPresetVoice || '';

  // Map voice mode to model and user message
  let model = 'mimo-v2.5-tts';
  let userMessage = 'Read this text';
  let audioConfig = { format: 'wav' };

  if (voiceMode === 'preset' && presetVoice) {
    model = 'mimo-v2.5-tts-voicedesign';
    userMessage = PRESET_DESCRIPTIONS[presetVoice] || 'A clear, friendly female voice';
  } else if (voiceMode === 'design') {
    model = 'mimo-v2.5-tts-voicedesign';
    userMessage = voiceDescription || 'A clear, friendly female voice';
  } else if (voiceMode === 'clone') {
    if (!voiceCloneData) throw new Error('No voice clone audio uploaded');
    model = 'mimo-v2.5-tts-voiceclone';
    userMessage = 'Clone this voice';
    audioConfig = { voice: voiceCloneData, format: 'wav' };
  }

  const payload = {
    model,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: text },
    ],
    audio: audioConfig,
  };

  const res = await fetchWithRetry(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`MiMo API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();

  // Response format: { choices: [{ message: { audio: { data: "<base64>" } } }] }
  const audioBase64 = data?.choices?.[0]?.message?.audio?.data;
  if (!audioBase64) {
    throw new Error('MiMo returned no audio data');
  }

  return { audioBase64, mimeType: 'audio/wav' };
}

// ── ElevenLabs TTS ──────────────────────────────────────────────────────────

async function elevenLabsTTS(text, settings) {
  const apiKey = settings.elevenlabsApiKey;
  if (!apiKey) throw new Error('ElevenLabs API key not configured');

  const voiceId = settings.elevenlabsVoiceId || 'pNInz6obpgDQGcFmaJgB';
  const modelId = settings.elevenlabsModelId || 'eleven_multilingual_v2';

  const res = await fetchWithRetry(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`ElevenLabs error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  // Convert blob to base64 so content script can create blob URL in page context
  const blob = await res.blob();
  const base64 = await blobToBase64(blob);

  return { audioBase64: base64, mimeType: 'audio/mpeg' };
}

// ── Fish TTS ────────────────────────────────────────────────────────────────

async function fishTTS(text, settings) {
  const apiKey = settings.fishApiKey;
  if (!apiKey) throw new Error('Fish Audio API key not configured');

  const voiceId = settings.fishVoiceId;
  if (!voiceId) throw new Error('Fish Audio voice ID not configured');

  const model = settings.fishModel || 's2.1-pro-free';

  const res = await fetchWithRetry('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'model': model,
    },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: 'mp3',
      mp3_bitrate: 128,
      normalize: true,
      latency: 'normal',
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Fish API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const blob = await res.blob();
  const base64 = await blobToBase64(blob);

  return { audioBase64: base64, mimeType: 'audio/mpeg' };
}

function uint8ToBase64(uint8) {
  const chunks = [];
  const CHUNK = 8192;
  for (let i = 0; i < uint8.length; i += CHUNK) {
    chunks.push(String.fromCharCode.apply(null, uint8.subarray(i, i + CHUNK)));
  }
  return btoa(chunks.join(''));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithRetry(url, options = {}, timeoutMs = 30000) {
  const RETRYABLE = [429, 502, 503, 504];
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (!RETRYABLE.includes(res.status) || attempt === MAX_RETRIES) return res;
      // Respect Retry-After header, otherwise back off 1s/2s
      const retryAfter = parseInt(res.headers.get('Retry-After'), 10);
      const delay = retryAfter ? retryAfter * 1000 : (attempt + 1) * 1000;
      await new Promise(r => setTimeout(r, delay));
    } catch (err) {
      // Retry on network/timeout errors, rethrow on last attempt
      if (attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
    }
  }
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  return uint8ToBase64(new Uint8Array(buffer));
}

// ── Voice Cloning ─────────────────────────────────────────────────────────

async function cloneElevenLabs(apiKey, name, fileData, fileName) {
  if (!apiKey) throw new Error('Enter API key in settings');
  if (!fileData) throw new Error('Select an audio file first');

  // Extract MIME type from data URL (e.g., "data:audio/mp3;base64,...")
  const mimeMatch = fileData.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'audio/wav';

  // Convert data URL to blob
  const binary = atob(fileData.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  const formData = new FormData();
  formData.append('name', name || 'Cloned Voice');
  formData.append('files', blob, fileName || 'reference.wav');

  const res = await fetchWithRetry('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  if (data.voice_id) {
    chrome.storage.sync.set({ elevenlabsVoiceId: data.voice_id });
    return { voiceId: data.voice_id };
  }
  throw new Error(data.detail?.message || 'Clone failed');
}

async function cloneFish(apiKey, name, fileData, fileName) {
  if (!apiKey) throw new Error('Enter API key in settings');
  if (!fileData) throw new Error('Upload an audio file first');

  // Extract MIME type from data URL (e.g., "data:audio/mp3;base64,...")
  const mimeMatch = fileData.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'audio/wav';

  // Convert data URL to blob
  const binary = atob(fileData.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  const formData = new FormData();
  formData.append('type', 'tts');
  formData.append('title', name || 'Cloned Voice');
  formData.append('train_mode', 'fast');
  formData.append('visibility', 'private');
  formData.append('voices', blob, fileName || 'reference.wav');

  const res = await fetchWithRetry('https://api.fish.audio/model', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.message || `API error ${res.status}`);
  }

  const data = await res.json();
  if (data._id) {
    chrome.storage.sync.set({ fishVoiceId: data._id });
    return { voiceId: data._id };
  }
  throw new Error('Clone failed');
}

async function getSettings() {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get([
      'enabled',
      'provider',
      'voiceMode',
      'mimoBaseUrl',
      'mimoVoiceDescription',
      'mimoPresetVoice',
      'elevenlabsVoiceId',
      'elevenlabsModelId',
      'fishVoiceId',
      'fishModel',
    ]),
    chrome.storage.local.get(
      ['mimoApiKey', 'elevenlabsApiKey', 'fishApiKey']
    ),
  ]);
  return { ...syncData, ...localData };
}

// Test/CI export hook — `module` doesn't exist in service-worker context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildCacheKey };
}
