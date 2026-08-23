// Test environment setup — shim the Chrome extension APIs and service-worker
// globals that content.js / background.js touch at load time. The extension
// code checks `typeof module` before exporting, so importing is safe.

globalThis.importScripts = () => {};

globalThis.chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
    onSuspend: { addListener: () => {} },
    sendMessage: () => {},
    getURL: (p) => `chrome-extension://hanna/${p}`,
  },
  storage: {
    sync: { get: async () => ({}), set: async () => {} },
    local: { get: async () => ({}), set: async () => {} },
    session: { get: async () => ({}), set: async () => {} },
    onChanged: { addListener: () => {} },
  },
  action: {
    onClicked: { addListener: () => {} },
  },
  sidePanel: {
    open: async () => {},
  },
  contextMenus: {
    create: () => {},
    removeAll: () => {},
    onClicked: { addListener: () => {} },
  },
  scripting: {
    executeScript: async () => {},
  },
  tabs: {
    sendMessage: async () => ({}),
    query: async () => [],
  },
};
