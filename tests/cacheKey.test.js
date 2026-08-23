import { describe, it, expect, beforeEach } from 'vitest';
import { buildCacheKey } from '../extension/background.js';

describe('buildCacheKey', () => {
  const base = { provider: 'mimo', voiceMode: 'preset', mimoPresetVoice: 'aussie-f' };

  it('formats as provider:voice', () => {
    expect(buildCacheKey('mimo', base)).toBe('mimo:aussie-f');
  });

  it('uses fishVoiceId for fish provider', () => {
    const s = { provider: 'fish', voiceMode: 'preset', fishVoiceId: 'abc123' };
    expect(buildCacheKey('fish', s)).toBe('fish:abc123');
  });

  it('uses elevenlabsVoiceId for elevenlabs provider', () => {
    const s = { provider: 'elevenlabs', voiceMode: 'preset', elevenlabsVoiceId: 'pNInz6' };
    expect(buildCacheKey('elevenlabs', s)).toBe('elevenlabs:pNInz6');
  });

  it('design mode wraps the description (regression: design voices must not collide with presets)', () => {
    const s = { ...base, voiceMode: 'design', mimoVoiceDescription: 'warm australian female' };
    expect(buildCacheKey('mimo', s)).toBe('mimo:design:warm australian female');
  });

  it('different descriptions produce different keys', () => {
    const a = buildCacheKey('mimo', { ...base, voiceMode: 'design', mimoVoiceDescription: 'deep male' });
    const b = buildCacheKey('mimo', { ...base, voiceMode: 'design', mimoVoiceDescription: 'soft female' });
    expect(a).not.toBe(b);
  });

  it('handles missing settings gracefully (empty voice)', () => {
    expect(buildCacheKey('mimo', {})).toBe('mimo:');
  });
});
