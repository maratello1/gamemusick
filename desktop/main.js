const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
let isAlwaysOnTop = false;
let isCompactMode = false;
let isMiniHudMode = false;

const APP_URL = 'http://localhost:3000';

function checkServerReady(url) {
  return new Promise((resolve) => {
    http
      .get(url, (res) => {
        resolve(res.statusCode === 200);
      })
      .on('error', () => resolve(false));
  });
}

async function ensureBackendServer() {
  const alreadyUp = await checkServerReady(APP_URL);
  if (alreadyUp) return;

  serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  for (let i = 0; i < 30; i++) {
    const ready = await checkServerReady(APP_URL);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 600));
  }
}

async function createDesktopWindow() {
  await ensureBackendServer();

  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 380,
    minHeight: 520,
    title: 'GameVibe v1.0 — AI-DJ Desktop Client',
    backgroundColor: '#07080A',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#07080A',
      symbolColor: '#FF6A00',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Open external links (e.g. music.youtube.com) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('localhost:3000')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register Global In-Game Hotkeys
  const hotkeyMap = {
    'Alt+1': 'EXPLORE',
    'Alt+2': 'STEALTH',
    'Alt+3': 'COMBAT',
    'Alt+4': 'BOSSFIGHT',
    'Alt+5': 'VICTORY',
  };

  Object.entries(hotkeyMap).forEach(([accel, vibeId]) => {
    globalShortcut.register(accel, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey:vibe', vibeId);
      }
    });
  });

  // Alt+P toggles Always-On-Top In-Game Overlay Pin
  globalShortcut.register('Alt+P', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    isAlwaysOnTop = !isAlwaysOnTop;
    mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver');
    mainWindow.webContents.send('window:aop-changed', isAlwaysOnTop);
  });

  // Alt+M toggles Ultra-Mini In-Game HUD Bar (420x104)
  globalShortcut.register('Alt+M', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    isMiniHudMode = !isMiniHudMode;
    if (isMiniHudMode) {
      mainWindow.setMinimumSize(360, 88);
      mainWindow.setSize(420, 104, true);
      isAlwaysOnTop = true;
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      mainWindow.setMinimumSize(380, 520);
      mainWindow.setSize(1460, 920, true);
    }
    mainWindow.webContents.send('window:mini-hud-changed', isMiniHudMode);
  });
}

ipcMain.handle('window:toggle-aop', () => {
  if (!mainWindow) return false;
  isAlwaysOnTop = !isAlwaysOnTop;
  mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver');
  return isAlwaysOnTop;
});

ipcMain.handle('window:set-compact', (_e, compact) => {
  if (!mainWindow) return false;
  isCompactMode = Boolean(compact);
  if (isCompactMode) {
    mainWindow.setSize(430, 720, true);
    isAlwaysOnTop = true;
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    mainWindow.setSize(1460, 920, true);
  }
  return isCompactMode;
});

ipcMain.handle('window:toggle-mini-hud', (_e, forceState) => {
  if (!mainWindow) return false;
  isMiniHudMode = typeof forceState === 'boolean' ? forceState : !isMiniHudMode;
  if (isMiniHudMode) {
    mainWindow.setMinimumSize(360, 88);
    mainWindow.setSize(420, 104, true);
    isAlwaysOnTop = true;
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    mainWindow.setMinimumSize(380, 520);
    mainWindow.setSize(1460, 920, true);
  }
  return isMiniHudMode;
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

app.whenReady().then(createDesktopWindow);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
