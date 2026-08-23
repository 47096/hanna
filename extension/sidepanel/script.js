// Side Panel script — Hanna

// Safe element accessor — returns element or null
const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  const setup = (fn) => { try { fn(); } catch (e) { console.error('[Hanna]', fn.name, e); } };
  setup(loadSettings);
  setup(setupToggle);
  setup(setupProviderTabs);
  setup(setupVoiceModes);
  setup(setupSettings);
  setup(setupMimoUpload);
  setup(setupElevenLabs);
  setup(setupFish);
  setup(setupTest);
  setup(setupReadPage);
  setup(setupConnectionTests);
});

// ── Settings ────────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const [data, local] = await Promise.all([
      chrome.storage.sync.get([
        'enabled', 'provider', 'voiceMode', 'elVoiceMode', 'fishVoiceMode',
        'mimoBaseUrl', 'mimoVoiceDescription', 'mimoPresetVoice',
        'elevenlabsVoiceId', 'elevenlabsModelId',
        'fishVoiceId', 'fishModel',
      ]),
      chrome.storage.local.get(
        ['mimoApiKey', 'elevenlabsApiKey', 'fishApiKey', 'mimoVoiceClone']
      ),
    ]);

    const toggle = $('toggle-enabled');
    if (toggle) toggle.checked = data.enabled !== false;

    const provider = data.provider || DEFAULT_PROVIDER;
    setProvider(provider);

    const mode = data.voiceMode || 'preset';
    setVoiceMode(mode);

    const elMode = data.elVoiceMode || 'preset';
    setElVoiceMode(elMode);

    const fishMode = data.fishVoiceMode || 'preset';
    setFishVoiceMode(fishMode);

    const baseUrl = $('mimo-base-url');
    if (baseUrl) baseUrl.value = data.mimoBaseUrl || 'https://token-plan-sgp.xiaomimimo.com';
    const presetVoice = $('mimo-preset-voice');
    if (presetVoice) presetVoice.value = data.mimoPresetVoice || 'confident-f';
    const voiceDesc = $('mimo-voice-description');
    if (voiceDesc) voiceDesc.value = data.mimoVoiceDescription || '';

    // Sync preset dropdown if saved voice matches a preset
    const elPreset = $('elevenlabs-preset');
    if (elPreset && data.elevenlabsVoiceId && elPreset.querySelector(`option[value="${CSS.escape(data.elevenlabsVoiceId)}"]`)) {
      elPreset.value = data.elevenlabsVoiceId;
    }

    // Set Fish voice - check if it matches a preset, otherwise put in text input
    const fishVoiceId = data.fishVoiceId || '536d3a5e000945adb7038665781a4aca';
    const fishSelect = $('fish-voice-id');
    if (fishSelect) {
      const fishPreset = fishSelect.querySelector(`option[value="${CSS.escape(fishVoiceId)}"]`);
      if (fishPreset) {
        fishSelect.value = fishVoiceId;
      } else {
        fishSelect.value = '';
        const fishInput = $('fish-voice-input');
        if (fishInput) fishInput.value = fishVoiceId;
      }
    }

    // Fish model selection
    const fishModelSelect = $('fish-model');
    if (fishModelSelect) {
      fishModelSelect.value = data.fishModel || 's2.1-pro-free';
    }

    // API keys
    const mimoKey = $('mimo-api-key');
    if (mimoKey) mimoKey.value = local.mimoApiKey || '';
    const elKey = $('elevenlabs-api-key');
    if (elKey) elKey.value = local.elevenlabsApiKey || '';
    const fishKey = $('fish-api-key');
    if (fishKey) fishKey.value = local.fishApiKey || '';

    // Disable action buttons if no API keys configured
    const hasAnyKey = local.mimoApiKey || local.elevenlabsApiKey || local.fishApiKey;
    const playBtn = $('test-btn');
    const readBtn = $('read-page-btn');
    const settingsBtn = $('btn-settings');
    if (playBtn) playBtn.disabled = !hasAnyKey;
    if (readBtn) readBtn.disabled = !hasAnyKey;
    if (!hasAnyKey) {
      // Show hint near buttons
      const hintEl = $('no-key-hint');
      if (hintEl) hintEl.style.display = 'block';
      // Highlight settings gear
      if (settingsBtn) settingsBtn.classList.add('highlight-pulse');
    }

    if (local.mimoVoiceClone) {
      const sizeKB = Math.round((local.mimoVoiceClone.length * 3 / 4) / 1024);
      const statusEl = $('mimo-voice-status');
      if (statusEl) {
        statusEl.textContent = `✓ ~${sizeKB}KB loaded`;
        statusEl.className = 'status-line ok';
      }
      const clearBtn = $('mimo-voice-clear');
      if (clearBtn) clearBtn.style.display = 'inline';
    }
  } catch (err) {
    console.error('[Hanna] Failed to load settings:', err);
    showStatus('Failed to load settings', 'error');
  }
}

function setProvider(provider) {
  document.querySelectorAll('.provider-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.provider === provider);
  });
  const mimoMain = $('mimo-main');
  if (mimoMain) mimoMain.style.display = provider === 'mimo' ? 'block' : 'none';
  const elMain = $('elevenlabs-main');
  if (elMain) elMain.style.display = provider === 'elevenlabs' ? 'block' : 'none';
  const fishMain = $('fish-main');
  if (fishMain) fishMain.style.display = provider === 'fish' ? 'block' : 'none';
  const mimoSettings = $('mimo-settings');
  if (mimoSettings) mimoSettings.style.display = provider === 'mimo' ? 'block' : 'none';
  const elSettings = $('elevenlabs-settings');
  if (elSettings) elSettings.style.display = provider === 'elevenlabs' ? 'block' : 'none';
  const fishSettings = $('fish-settings');
  if (fishSettings) fishSettings.style.display = provider === 'fish' ? 'block' : 'none';
}

function setVoiceMode(mode) {
  document.querySelectorAll('.voice-mode').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const preset = $('mode-preset');
  if (preset) preset.style.display = mode === 'preset' ? 'block' : 'none';
  const design = $('mode-design');
  if (design) design.style.display = mode === 'design' ? 'block' : 'none';
  const clone = $('mode-clone');
  if (clone) clone.style.display = mode === 'clone' ? 'block' : 'none';
}

function setElVoiceMode(mode) {
  document.querySelectorAll('.voice-mode-el').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const preset = $('el-mode-preset');
  if (preset) preset.style.display = mode === 'preset' ? 'block' : 'none';
  const clone = $('el-mode-clone');
  if (clone) clone.style.display = mode === 'clone' ? 'block' : 'none';
}

function setFishVoiceMode(mode) {
  document.querySelectorAll('.voice-mode-fish').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const preset = $('fish-mode-preset');
  if (preset) preset.style.display = mode === 'preset' ? 'block' : 'none';
  const clone = $('fish-mode-clone');
  if (clone) clone.style.display = mode === 'clone' ? 'block' : 'none';
}

// ── Toggle ──────────────────────────────────────────────────────────────────

function setupToggle() {
  const toggle = $('toggle-enabled');
  if (!toggle) return;
  toggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ enabled: e.target.checked });
    showStatus(e.target.checked ? 'Enabled' : 'Disabled', 'success');
  });
}

// ── Provider Tabs ───────────────────────────────────────────────────────────

function setupProviderTabs() {
  document.querySelectorAll('.provider-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const provider = tab.dataset.provider;
      chrome.storage.sync.set({ provider });
      setProvider(provider);
    });
  });
}

// ── Voice Modes ─────────────────────────────────────────────────────────────

function setupVoiceModes() {
  // MiMo voice modes
  document.querySelectorAll('.voice-mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      chrome.storage.sync.set({ voiceMode: mode });
      setVoiceMode(mode);
    });
  });

  // ElevenLabs voice modes
  document.querySelectorAll('.voice-mode-el').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      chrome.storage.sync.set({ elVoiceMode: mode });
      setElVoiceMode(mode);
    });
  });

  // Fish voice modes
  document.querySelectorAll('.voice-mode-fish').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      chrome.storage.sync.set({ fishVoiceMode: mode });
      setFishVoiceMode(mode);
    });
  });


  const presetSelect = $('mimo-preset-voice');
  const presetDesc = $('mimo-preset-desc');

  function updatePresetDesc() {
    if (presetDesc && presetSelect) presetDesc.textContent = PRESET_DESCRIPTIONS[presetSelect.value] || '';
  }
  updatePresetDesc();

  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      chrome.storage.sync.set({ mimoPresetVoice: e.target.value });
      updatePresetDesc();
    });
  }

  const voicePreset = $('mimo-voice-preset');
  if (voicePreset) {
    voicePreset.addEventListener('change', (e) => {
      if (e.target.value) {
        const descEl = $('mimo-voice-description');
        if (descEl) descEl.value = e.target.value;
        chrome.storage.sync.set({ mimoVoiceDescription: e.target.value });
      }
    });
  }

  let voiceDescTimer;
  const voiceDescInput = $('mimo-voice-description');
  if (voiceDescInput) {
    voiceDescInput.addEventListener('input', (e) => {
      clearTimeout(voiceDescTimer);
      voiceDescTimer = setTimeout(() => chrome.storage.sync.set({ mimoVoiceDescription: e.target.value }), 500);
    });
  }
}

// ── Settings View ───────────────────────────────────────────────────────────

function setupSettings() {
  const btnSettings = $('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      const mainView = $('main-view');
      const settingsView = $('settings-view');
      if (mainView) mainView.style.display = 'none';
      if (settingsView) settingsView.style.display = 'block';
      // Sync provider selection in settings with current provider
      const currentProvider = document.querySelector('.provider-tab.active')?.dataset.provider || DEFAULT_PROVIDER;
      selectSettingsProvider(currentProvider);
    });
  }

  const btnBack = $('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      const settingsView = $('settings-view');
      const mainView = $('main-view');
      if (settingsView) settingsView.style.display = 'none';
      if (mainView) mainView.style.display = 'block';
    });
  }

  // Provider option selection in settings
  document.querySelectorAll('.provider-opt').forEach((opt) => {
    const selectProvider = () => {
      const settingsId = opt.dataset.settings;
      const providerName = opt.querySelector('.provider-opt-name')?.textContent || '';
      document.querySelectorAll('.provider-opt').forEach(o => o.classList.remove('sel'));
      opt.classList.add('sel');
      document.querySelectorAll('.settings-group').forEach(g => g.style.display = 'none');
      const settingsGroup = $(settingsId);
      if (settingsGroup) settingsGroup.style.display = 'block';
      const configTitle = $('configure-title');
      if (configTitle) configTitle.textContent = `Configure ${providerName}`;
      // Also update the main provider tabs
      const providerKey = settingsId.replace('-settings', '');
      chrome.storage.sync.set({ provider: providerKey });
      setProvider(providerKey);
    };
    opt.addEventListener('click', selectProvider);
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProvider(); }
    });
  });

  const mimoApiKey = $('mimo-api-key');
  if (mimoApiKey) {
    mimoApiKey.addEventListener('input', (e) => {
      chrome.storage.local.set({ mimoApiKey: e.target.value });
      clearNoKeyHint();
    });
  }

  const mimoBaseUrl = $('mimo-base-url');
  if (mimoBaseUrl) {
    mimoBaseUrl.addEventListener('change', (e) => {
      let url = e.target.value.trim();
      if (url && !url.startsWith('https://')) {
        showStatus('Base URL must use HTTPS', 'error');
        return;
      }
      chrome.storage.sync.set({ mimoBaseUrl: url });
    });
  }

  const elApiKey = $('elevenlabs-api-key');
  if (elApiKey) {
    elApiKey.addEventListener('input', (e) => {
      chrome.storage.local.set({ elevenlabsApiKey: e.target.value });
      clearNoKeyHint();
    });
  }

}

function clearNoKeyHint() {
  const hintEl = $('no-key-hint');
  if (hintEl) hintEl.style.display = 'none';
  const playBtn = $('test-btn');
  const readBtn = $('read-page-btn');
  const settingsBtn = $('btn-settings');
  if (playBtn) playBtn.disabled = false;
  if (readBtn) readBtn.disabled = false;
  if (settingsBtn) settingsBtn.classList.remove('highlight-pulse');
}

function selectSettingsProvider(provider) {
  const providerMap = {
    'mimo': 'mimo-settings',
    'elevenlabs': 'elevenlabs-settings',
    'fish': 'fish-settings',
  };
  const nameMap = {
    'mimo': 'Xiaomi MiMo',
    'elevenlabs': 'ElevenLabs',
    'fish': 'Fish Audio',
  };
  const targetId = providerMap[provider] || 'mimo-settings';

  document.querySelectorAll('.provider-opt').forEach((opt) => {
    opt.classList.toggle('sel', opt.dataset.settings === targetId);
  });
  document.querySelectorAll('.settings-group').forEach(g => g.style.display = 'none');
  const target = $(targetId);
  if (target) target.style.display = 'block';
  const title = $('configure-title');
  if (title) title.textContent = `Configure ${nameMap[provider] || 'Xiaomi MiMo'}`;
}

// ── MiMo Upload ─────────────────────────────────────────────────────────────

function setupMimoUpload() {
  const area = $('mimo-upload-area');
  const input = $('mimo-voice-file');
  if (!area || !input) return;

  area.addEventListener('click', () => input.click());
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleMimoFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', (e) => {
    if (e.target.files.length) handleMimoFile(e.target.files[0]);
  });

  const clearBtn = $('mimo-voice-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chrome.storage.local.remove('mimoVoiceClone');
      const status = $('mimo-voice-status');
      if (status) status.textContent = '';
      clearBtn.style.display = 'none';
      showStatus('Voice removed', 'success');
    });
  }
}

function handleMimoFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showStatus('File too large (max 5MB)', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    chrome.storage.local.set({ mimoVoiceClone: reader.result }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Storage error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      const statusEl = $('mimo-voice-status');
      if (statusEl) {
        statusEl.textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(0)}KB)`;
        statusEl.className = 'status-line ok';
      }
      const clearBtn = $('mimo-voice-clear');
      if (clearBtn) clearBtn.style.display = 'inline';
      showStatus('Voice saved', 'success');
    });
  };
  reader.onerror = () => showStatus('Failed to read file', 'error');
  reader.readAsDataURL(file);
}

// ── ElevenLabs ──────────────────────────────────────────────────────────────

function setupElevenLabs() {
  const cloneBtn = $('clone-voice');
  if (cloneBtn) cloneBtn.addEventListener('click', cloneElevenLabsVoice);

  // Preset voice selection
  const EL_PRESET_DESCRIPTIONS = {
    'cgSgspJ2msm6clMCkdW9': 'Playful, bright, warm. Great for friendly content and casual narration.',
    'EXAVITQu4vr4xnSDxMaL': 'Mature, reassuring tone. Ideal for guides, tutorials, and calming content.',
    'FGY2WhTYpPnrIDTdsKH5': 'Quirky, enthusiastic energy. Perfect for creative content and storytelling.',
    'Xb7hH8MSUJpSbSDYk0k2': 'Clear, engaging delivery. Works well for presentations and explainers.',
    'XrExE9yKIg1WjnnlVkGX': 'Professional, polished. Suited for corporate and business content.',
    'pFZP5JQG7iQjIQuC4Bku': 'Velvety, warm voice. Great for audiobooks and intimate narration.',
    'hpp4J3VqNfWAUOO0d1Us': 'Professional, bright tone. Ideal for news and formal presentations.',
    'pNInz6obpgDQGcFmaJgB': 'Dominant, firm presence. Strong voice for authority and impact.',
    'CwhRBWXzGAHq8TQ4Fs17': 'Laid-back, casual style. Perfect for conversational and relaxed content.',
    'IKne3meq5aSn9XLyUdCD': 'Deep, confident tone. Great for narration and professional content.',
    'JBFqnCBsd6RMkjVDRZzb': 'Warm, captivating delivery. Ideal for storytelling and audiobooks.',
    'nPczCjzI2devNBz1zQrb': 'Deep, comforting voice. Perfect for meditation, ASMR, and calm content.',
    'onwK4e9ZLuTAKqWW03F9': 'Steady broadcaster voice. Classic radio/news anchor quality.',
    'iP95p4xoKVk53GoZ742B': 'Charming, down-to-earth. Great for podcasts and friendly content.',
    'bIHbv24MWmeRgasZH58o': 'Relaxed optimist tone. Works well for casual narration and vlogs.',
    'pqHfZKP75CvOlQylNhV4': 'Wise, mature voice. Ideal for documentary and thoughtful content.',
  };

  const elPresetSelect = $('elevenlabs-preset');
  const elPresetDesc = $('el-preset-desc');

  function updateElPresetDesc() {
    if (elPresetDesc && elPresetSelect) elPresetDesc.textContent = EL_PRESET_DESCRIPTIONS[elPresetSelect.value] || '';
  }
  updateElPresetDesc();

  if (elPresetSelect) {
    elPresetSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        chrome.storage.sync.set({ elevenlabsVoiceId: e.target.value });
      }
      updateElPresetDesc();
    });
  }

  const area = $('el-upload-area');
  const input = $('el-voice-file');
  if (!area || !input) return;

  area.addEventListener('click', () => input.click());
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files.length) persistElFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', (e) => {
    if (e.target.files.length) persistElFile(e.target.files[0]);
  });

  // Clear button for ElevenLabs voice clone
  const elClearBtn = $('el-voice-clear');
  if (elClearBtn) {
    elClearBtn.addEventListener('click', () => {
      chrome.storage.local.remove(['elVoiceCloneData', 'elVoiceCloneName']);
      const status = $('el-clone-status');
      if (status) status.textContent = '';
      elClearBtn.style.display = 'none';
      showStatus('Voice removed', 'success');
    });
  }
}

function persistElFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showStatus('Voice sample must be under 5 MB', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    chrome.storage.local.set({
      elVoiceCloneData: reader.result,
      elVoiceCloneName: file.name,
    }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Storage error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      const statusEl = $('el-clone-status');
      if (statusEl) {
        statusEl.textContent = `Selected: ${file.name}`;
        statusEl.className = 'status-line';
      }
      const clearBtn = $('el-voice-clear');
      if (clearBtn) clearBtn.style.display = 'inline';
    });
  };
  reader.onerror = () => {
    showStatus('Failed to read file', 'error');
  };
  reader.readAsDataURL(file);
}

async function cloneElevenLabsVoice() {
  const apiKeyEl = $('elevenlabs-api-key');
  const apiKey = apiKeyEl ? apiKeyEl.value : '';
  const nameEl = $('el-voice-name');
  const name = nameEl ? (nameEl.value || 'Cloned Voice') : 'Cloned Voice';

  if (!apiKey) return showStatus('Enter API key in settings', 'error');

  const stored = await new Promise(r => chrome.storage.local.get(['elVoiceCloneData', 'elVoiceCloneName'], r));
  if (!stored.elVoiceCloneData) return showStatus('Select an audio file first', 'error');

  const statusEl = $('el-clone-status');
  if (statusEl) {
    statusEl.textContent = 'Cloning...';
    statusEl.className = 'status-line';
  }

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CLONE_ELEVENLABS',
        apiKey,
        name,
        fileData: stored.elVoiceCloneData,
        fileName: stored.elVoiceCloneName || 'reference.wav',
      }, resolve);
    });

    if (!response) throw new Error('Background service unavailable — try again');
    if (response.error) throw new Error(response.error);

    if (statusEl) {
      statusEl.textContent = `✓ ${response.voiceId.slice(0, 12)}…`;
      statusEl.className = 'status-line ok';
    }
    showStatus('Voice cloned', 'success');
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Error';
      statusEl.className = 'status-line fail';
    }
    showStatus(err.message, 'error');
  }
}

// ── Fish ────────────────────────────────────────────────────────────────────

function setupFish() {
  const fishApiKey = $('fish-api-key');
  if (fishApiKey) {
    fishApiKey.addEventListener('input', (e) => {
      chrome.storage.local.set({ fishApiKey: e.target.value });
      clearNoKeyHint();
    });
  }

  const FISH_PRESET_DESCRIPTIONS = {
    '536d3a5e000945adb7038665781a4aca': 'Default male voice. Clear, natural delivery for general use.',
    '933563129e564b19a115bedd57b7406a': 'Warm female voice. Friendly tone for casual content.',
    'bf322df2096a46f18c579d0baa36f41d': 'Clear male voice. Professional, steady for narration.',
    'e3cd384158934cc9a01029cd7d278634': 'Friendly female voice. Approachable, conversational.',
    '79d0bd3e4e5444b18f7b6d89b5927bf1': 'Conversational male voice. Natural, relaxed style.',
    '9a9cf47702da476aa4629e2506d4a857': 'Natural female voice. Versatile for most content.',
    '0327fdb5da9e4fd782899a8058c8ae2b': 'Deep male voice. Rich, commanding presence for audiobooks.',
    '5c8dc6a69c0b4edfb32634db6384bf34': 'Warm, inviting tone. Perfect for storytelling and narration.',
    '542fc7aab61e4561bae5ebd536d717c0': 'Casual, engaging delivery. Great for podcasts and vlogs.',
    '5212eb29e500460391d03af42af6552e': 'Relaxed, friendly style. Ideal for casual reads.',
    '6ab4c6b0f37f4243a99046478647be94': 'Expressive female voice. Animated, dynamic range for characters.',
    '7a18a1851d2649108c48ec9f2c80eb2c': 'Intense, theatrical. For dramatic readings and bold narration.',
    'c2623f0c075b4492ac367989aee1576f': 'Expressive female voice. Lively, character-driven performance.',
  };

  const fishPresetSelect = $('fish-voice-id');
  const fishPresetDesc = $('fish-preset-desc');

  function updateFishPresetDesc() {
    if (fishPresetDesc && fishPresetSelect) fishPresetDesc.textContent = FISH_PRESET_DESCRIPTIONS[fishPresetSelect.value] || '';
  }
  updateFishPresetDesc();

  if (fishPresetSelect) {
    fishPresetSelect.addEventListener('change', (e) => {
      chrome.storage.sync.set({ fishVoiceId: e.target.value });
      // Clear text input when dropdown is used
      const fishInput = $('fish-voice-input');
      if (fishInput) fishInput.value = '';
      // Reset hint text
      const hint = document.querySelector('#fish-mode-preset .hint-text');
      if (hint) {
        hint.textContent = 'Browse voices at fish.audio';
        hint.style.color = '';
      }
      updateFishPresetDesc();
    });
  }

  // Text input for custom Voice ID
  let fishInputTimer;
  const fishVoiceInput = $('fish-voice-input');
  if (fishVoiceInput) {
    fishVoiceInput.addEventListener('input', async (e) => {
      const modelId = e.target.value.trim();
      clearTimeout(fishInputTimer);
      if (modelId) {
        chrome.storage.sync.set({ fishVoiceId: modelId });
        const fishId = $('fish-voice-id');
        if (fishId) fishId.value = '';
        // Debounce API call — wait 500ms after user stops typing
        fishInputTimer = setTimeout(() => fetchFishVoiceInfo(modelId), 500);
      }
    });
  }

  // Fish model selection
  const fishModelSelect = $('fish-model');
  if (fishModelSelect) {
    fishModelSelect.addEventListener('change', (e) => {
      chrome.storage.sync.set({ fishModel: e.target.value });
    });
  }

  async function fetchFishVoiceInfo(modelId) {
    const apiKeyEl = $('fish-api-key');
    const apiKey = apiKeyEl ? apiKeyEl.value : '';
    if (!apiKey) return;

    const hint = document.querySelector('#fish-mode-preset .hint-text');
    try {
      const res = await fetch(`https://api.fish.audio/model/${modelId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      if (data.title && hint) {
        const tags = data.tags?.length ? ` · ${data.tags.slice(0, 3).join(', ')}` : '';
        const lang = data.languages?.length ? ` · ${data.languages[0]}` : '';
        hint.textContent = `✓ ${data.title}${tags}${lang}`;
        hint.style.color = '#1a1a1a';
      }
    } catch (err) {
      if (hint) {
        hint.textContent = 'Voice not found or inaccessible';
        hint.style.color = '#f44336';
      }
    }
  }

  // Fish clone upload
  const fishCloneBtn = $('fish-clone-btn');
  if (fishCloneBtn) fishCloneBtn.addEventListener('click', cloneFishVoice);

  const fishArea = $('fish-upload-area');
  const fishFileInput = $('fish-voice-file');

  if (fishArea && fishFileInput) {
    fishArea.addEventListener('click', () => fishFileInput.click());
    fishArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fishFileInput.click(); }
    });
    fishArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fishArea.classList.add('dragover');
    });
    fishArea.addEventListener('dragleave', () => fishArea.classList.remove('dragover'));
    fishArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fishArea.classList.remove('dragover');
      if (e.dataTransfer.files.length) persistFishFile(e.dataTransfer.files[0]);
    });
    fishFileInput.addEventListener('change', (e) => {
      if (e.target.files.length) persistFishFile(e.target.files[0]);
    });
  }

  // Clear button for Fish Audio voice clone
  const fishClearBtn = $('fish-voice-clear');
  if (fishClearBtn) {
    fishClearBtn.addEventListener('click', () => {
      chrome.storage.local.remove(['fishVoiceCloneData', 'fishVoiceCloneName']);
      const status = $('fish-clone-status');
      if (status) status.textContent = '';
      fishClearBtn.style.display = 'none';
      showStatus('Voice removed', 'success');
    });
  }
}

function persistFishFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showStatus('Voice sample must be under 5 MB', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    chrome.storage.local.set({
      fishVoiceCloneData: reader.result,
      fishVoiceCloneName: file.name,
    }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Storage error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      const statusEl = $('fish-clone-status');
      if (statusEl) {
        statusEl.textContent = `Selected: ${file.name}`;
        statusEl.className = 'status-line';
      }
      const clearBtn = $('fish-voice-clear');
      if (clearBtn) clearBtn.style.display = 'inline';
    });
  };
  reader.onerror = () => showStatus('Failed to read file', 'error');
  reader.readAsDataURL(file);
}

async function cloneFishVoice() {
  const apiKeyEl = $('fish-api-key');
  const apiKey = apiKeyEl ? apiKeyEl.value : '';
  const nameEl = $('fish-voice-name');
  const name = nameEl ? (nameEl.value || 'Cloned Voice') : 'Cloned Voice';
  const statusEl = $('fish-clone-status');

  if (!apiKey) return showStatus('Enter API key in settings', 'error');

  const stored = await new Promise(r => chrome.storage.local.get(['fishVoiceCloneData', 'fishVoiceCloneName'], r));
  if (!stored.fishVoiceCloneData) return showStatus('Upload an audio file first', 'error');

  if (statusEl) {
    statusEl.textContent = 'Cloning...';
    statusEl.className = 'status-line';
  }

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CLONE_FISH',
        apiKey,
        name,
        fileData: stored.fishVoiceCloneData,
        fileName: stored.fishVoiceCloneName || 'reference.wav',
      }, resolve);
    });

    if (!response) throw new Error('Background service unavailable — try again');
    if (response.error) throw new Error(response.error);

    const fishInput = $('fish-voice-input');
    if (fishInput) fishInput.value = response.voiceId;
    const fishId = $('fish-voice-id');
    if (fishId) fishId.value = '';
    if (statusEl) {
      statusEl.textContent = `✓ ${response.voiceId.slice(0, 12)}…`;
      statusEl.className = 'status-line ok';
    }
    showStatus('Voice cloned', 'success');
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Error';
      statusEl.className = 'status-line fail';
    }
    showStatus(err.message, 'error');
  }
}

// ── Test ────────────────────────────────────────────────────────────────────

function setupTest() {
  let testAudio = null;

  const testBtn = $('test-btn');
  if (!testBtn) return;

  testBtn.addEventListener('click', async () => {
    const btn = $('test-btn');
    if (!btn) return;

    // If currently playing, stop it
    if (testAudio) {
      testAudio.stop();
      return;
    }

    const testText = "Hey, I'm Hanna. Pick a voice and let me show you how beautiful reading can be.";

    btn.textContent = 'LOADING...';
    btn.disabled = true;

    try {
      // Collect current settings from DOM
      const provider = document.querySelector('.provider-tab.active')?.dataset.provider || DEFAULT_PROVIDER;
      const settings = await collectTestSettings(provider);

      // Send to background for TTS (single source of truth)
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'TEST_TTS', text: testText, settings }, resolve);
      });

      if (!response) throw new Error('Background service unavailable — try again');
      if (response.error) throw new Error(response.error);

      const { audioBase64, mimeType } = response;
      if (!audioBase64) throw new Error('No audio returned');

      // Use Web Audio API to avoid CSP issues with blob/data URLs
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      let audioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
      } catch (err) {
        audioCtx.close();
        throw new Error('Failed to decode audio');
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      testAudio = {
        _source: source,
        _ctx: audioCtx,
        _stopped: false,
        stop() {
          if (!this._stopped) {
            this._stopped = true;
            try { source.stop(); } catch (e) {}
            audioCtx.close();
            testAudio = null;
            btn.textContent = 'PLAY';
            btn.disabled = false;
          }
        }
      };

      source.onended = () => {
        if (!testAudio?._stopped) {
          testAudio?.stop();
        }
      };

      source.start(0);
      btn.textContent = 'STOP';
      btn.disabled = false;
    } catch (err) {
      btn.textContent = 'ERROR';
      showStatus(err.message, 'error');
      setTimeout(() => { btn.textContent = 'PLAY'; btn.disabled = false; }, 2000);
      console.error('[Hanna] Test error:', err.message);
    }
  });
}

async function collectTestSettings(provider) {
  const stored = await new Promise(r => chrome.storage.local.get(['mimoVoiceClone', 'mimoApiKey', 'elevenlabsApiKey', 'fishApiKey'], r));

  if (provider === 'mimo') {
    const mode = document.querySelector('.voice-mode.active')?.dataset.mode || 'preset';
    const mimoKey = $('mimo-api-key');
    const baseUrl = $('mimo-base-url');
    const presetVoice = $('mimo-preset-voice');
    const voiceDesc = $('mimo-voice-description');
    return {
      provider: 'mimo',
      mimoApiKey: (mimoKey ? mimoKey.value : '') || stored.mimoApiKey,
      mimoBaseUrl: baseUrl ? baseUrl.value : '',
      voiceMode: mode,
      mimoPresetVoice: presetVoice ? presetVoice.value : '',
      mimoVoiceDescription: voiceDesc ? voiceDesc.value.trim() : '',
      // Clone data read by background from storage (too large for message)
    };
  } else if (provider === 'elevenlabs') {
    const elKey = $('elevenlabs-api-key');
    const elPreset = $('elevenlabs-preset');
    return {
      provider: 'elevenlabs',
      elevenlabsApiKey: (elKey ? elKey.value : '') || stored.elevenlabsApiKey,
      elevenlabsVoiceId: (elPreset ? elPreset.value : '') || 'pNInz6obpgDQGcFmaJgB',
      elevenlabsModelId: 'eleven_multilingual_v2',
    };
  } else if (provider === 'fish') {
    const fishKey = $('fish-api-key');
    const fishId = $('fish-voice-id');
    const fishInput = $('fish-voice-input');
    return {
      provider: 'fish',
      fishApiKey: (fishKey ? fishKey.value : '') || stored.fishApiKey,
      fishVoiceId: (fishId ? fishId.value : '')
        || (fishInput ? fishInput.value : '')
        || '536d3a5e000945adb7038665781a4aca',
    };
  }
  throw new Error('Unknown provider: ' + provider);
}


// ── Read Page ──────────────────────────────────────────────────────────────

function setupReadPage() {
  const btn = $('read-page-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    // Loading state
    const originalText = btn.textContent;
    btn.textContent = 'Loading...';
    btn.disabled = true;

    // Safety timeout — restore button if no response after 5s
    const timeout = setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 5000);

    chrome.runtime.sendMessage({ type: 'READ_PAGE_FROM_SIDEPANEL' }, (response) => {
      clearTimeout(timeout);
      // Restore button
      btn.textContent = originalText;
      btn.disabled = false;

      if (chrome.runtime.lastError) {
        showStatus('Connection error', 'error');
        return;
      }
      if (response?.error) {
        showStatus('Cannot read this page — try a regular website', 'error');
      }
    });
  });
}

// ── Connection Tests ────────────────────────────────────────────────────────

function setupConnectionTests() {
  const mimoTest = $('mimo-test-connection');
  if (mimoTest) mimoTest.addEventListener('click', testMimoConnection);
  const elTest = $('el-test-connection');
  if (elTest) elTest.addEventListener('click', testElevenLabsConnection);
  const fishTest = $('fish-test-connection');
  if (fishTest) fishTest.addEventListener('click', testFishConnection);
}

async function testMimoConnection() {
  const statusEl = $('mimo-connection-status');
  const btn = $('mimo-test-connection');
  const apiKeyEl = $('mimo-api-key');
  const baseUrlEl = $('mimo-base-url');
  const apiKey = apiKeyEl ? apiKeyEl.value : '';
  const baseUrl = baseUrlEl ? baseUrlEl.value : '';

  if (!apiKey) {
    if (statusEl) {
      statusEl.textContent = 'Enter API key';
      statusEl.className = 'status-line fail';
    }
    return;
  }

  if (btn) {
    btn.textContent = '...';
    btn.disabled = true;
  }
  if (statusEl) {
    statusEl.textContent = 'Checking...';
    statusEl.className = 'status-line checking';
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-tts',
        messages: [
          { role: 'user', content: 'test' },
          { role: 'assistant', content: 'hi' },
        ],
      }),
    });

    if (statusEl) {
      if (res.ok) {
        statusEl.textContent = '● Connected';
        statusEl.className = 'status-line ok';
      } else {
        statusEl.textContent = `✗ ${res.status}`;
        statusEl.className = 'status-line fail';
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err.name === 'AbortError' ? '✗ Timeout' : '✗ Network error';
      statusEl.className = 'status-line fail';
    }
  } finally {
    if (btn) {
      btn.textContent = 'TEST';
      btn.disabled = false;
    }
  }
}

async function testElevenLabsConnection() {
  const statusEl = $('el-connection-status');
  const btn = $('el-test-connection');
  const apiKeyEl = $('elevenlabs-api-key');
  const apiKey = apiKeyEl ? apiKeyEl.value : '';

  if (!apiKey) {
    if (statusEl) {
      statusEl.textContent = 'Enter API key';
      statusEl.className = 'status-line fail';
    }
    return;
  }

  if (btn) {
    btn.textContent = '...';
    btn.disabled = true;
  }
  if (statusEl) {
    statusEl.textContent = 'Checking...';
    statusEl.className = 'status-line checking';
  }

  try {
    const res = await fetchWithTimeout('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
    });

    if (statusEl) {
      if (res.ok) {
        const data = await res.json();
        const tier = data.subscription?.tier || 'free';
        statusEl.textContent = `● ${tier}`;
        statusEl.className = 'status-line ok';
      } else {
        statusEl.textContent = `✗ ${res.status}`;
        statusEl.className = 'status-line fail';
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err.name === 'AbortError' ? '✗ Timeout' : '✗ Network error';
      statusEl.className = 'status-line fail';
    }
  } finally {
    if (btn) {
      btn.textContent = 'TEST';
      btn.disabled = false;
    }
  }
}

async function testFishConnection() {
  const statusEl = $('fish-connection-status');
  const btn = $('fish-test-connection');
  const apiKeyEl = $('fish-api-key');
  const apiKey = apiKeyEl ? apiKeyEl.value : '';

  if (!apiKey) {
    if (statusEl) {
      statusEl.textContent = 'Enter API key';
      statusEl.className = 'status-line fail';
    }
    return;
  }

  if (btn) {
    btn.textContent = '...';
    btn.disabled = true;
  }
  if (statusEl) {
    statusEl.textContent = 'Checking...';
    statusEl.className = 'status-line checking';
  }

  try {
    const res = await fetchWithTimeout('https://api.fish.audio/model?page_size=1', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (statusEl) {
      if (res.ok) {
        statusEl.textContent = '● Connected';
        statusEl.className = 'status-line ok';
      } else {
        statusEl.textContent = `✗ ${res.status}`;
        statusEl.className = 'status-line fail';
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err.name === 'AbortError' ? '✗ Timeout' : '✗ Network error';
      statusEl.className = 'status-line fail';
    }
  } finally {
    if (btn) {
      btn.textContent = 'TEST';
      btn.disabled = false;
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

let statusTimer;
function showStatus(message, type = '') {
  const el = $('status');
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`;
  el.classList.remove('hidden');
  clearTimeout(statusTimer);
  const duration = type === 'error' ? 8000 : 3000;
  statusTimer = setTimeout(() => el.classList.add('hidden'), duration);
}
