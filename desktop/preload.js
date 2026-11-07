const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gamevibeDesktop', {
  isDesktopApp: true,
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-aop'),
  setCompactOverlay: (compact) => ipcRenderer.invoke('window:set-compact', compact),
  toggleMiniHud: (forceState) => ipcRenderer.invoke('window:toggle-mini-hud', forceState),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onGlobalHotkeyVibe: (callback) => {
    ipcRenderer.on('hotkey:vibe', (_event, vibeId) => callback(vibeId));
  },
  onOverlayModeChange: (callback) => {
    ipcRenderer.on('window:aop-changed', (_event, isPinned) => callback(isPinned));
  },
  onMiniHudChange: (callback) => {
    ipcRenderer.on('window:mini-hud-changed', (_event, isMini) => callback(isMini));
  },
});
