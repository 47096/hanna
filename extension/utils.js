// Shared utilities — Hanna

const DEFAULT_PROVIDER = 'mimo';

const PRESET_DESCRIPTIONS = {
  'confident-f': 'A bold, confident female voice with authority and presence',
  'corporate-f': 'A polished, professional female voice for business presentations',
  'educator-f': 'A clear, patient female voice with an instructional quality',
  'news-m': 'A clear, professional news anchor voice',
  'professional-m': 'A polished, corporate male voice for presentations',
  'authoritative-m': 'A deep, authoritative male voice with crisp articulation',
  'broadcast-m': 'A smooth, trustworthy male radio host voice',
  'documentary-m': 'A measured, thoughtful male voice with gravitas',
  'narrator-m': 'A rich, cinematic audiobook narrator voice with deep resonance',
  'audiobook-f': 'A rich, expressive female voice with dramatic range',
  'audiobook-m': 'A deep, immersive male voice with character acting ability',
  'fierce-f': 'A powerful, intense female voice with commanding presence',
  'commanding-m': 'An authoritative, military-style male trailer voice',
  'bright-f': 'A young, energetic female voice with bubbly enthusiasm',
  'sweet-f': 'A cute, youthful, anime-inspired female voice',
  'friendly-f': 'A cheerful, approachable female voice with a smile in the tone',
  'charming-m': 'A smooth, charismatic male voice with warmth and charm',
  'sultry-f': 'A deep, husky female voice with a smooth, velvety quality',
  'whisper-f': 'A soft, intimate, ASMR-like female voice with breathy undertones',
  'mysterious-m': 'A low, enigmatic male voice with an air of secrecy',
  'robot': 'A synthetic, monotone robotic voice with metallic undertones',
  'pirate-m': 'A rough, boisterous male voice with a theatrical pirate accent',
  'aussie-f': 'A friendly, warm female voice with a clear Australian accent',
  'aussie-m': 'A laid-back male voice with a broad Australian accent',
  'brit-f': 'A refined, polished female voice with a posh British RP accent',
  'brit-m': 'A distinguished, eloquent male voice with a classic British accent',
  'irish-f': 'A warm, melodic female voice with a soft Irish lilt',
  'southern-f': 'A sweet, drawling female voice with a gentle Southern American accent',
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
