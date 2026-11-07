const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeImage,
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let serverProcess = null;
let directorProcess = null;
let sensorProcess = null;
let isAlwaysOnTop = false;
let isCompactMode = false;
let isMiniHudMode = false;
let isQuitting = false;

const ROOT_DIR = path.join(__dirname, '..');
const PORT = 3001;
const APP_URL = `http://localhost:${PORT}`;
const ICON_ICO = path.join(ROOT_DIR, 'public', 'icon.ico');
const ICON_PNG = path.join(ROOT_DIR, 'public', 'icon.png');

// Ensure single instance of GameVibe Desktop App
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function checkGameVibeReady() {
  return new Promise((resolve) => {
    http
      .get(`${APP_URL}/api/app-state`, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          resolve(res.statusCode === 200 && body.includes('activeVibe'));
        });
      })
      .on('error', () => resolve(false));
  });
}

function startBackgroundSensors() {
  // 1. Local AI Scene, Boss & Subtitle Director (Python)
  const directorScript = path.join(__dirname, 'local_director.py');
  if (fs.existsSync(directorScript)) {
    try {
      directorProcess = spawn('python', [directorScript], {
        cwd: ROOT_DIR,
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      // ignore if python not installed
    }
  }

  // 2. 50Hz Win32 Sensor + CoreAudio Game Ducking
  const sensorExe = path.join(__dirname, 'interactive_sensor.exe');
  if (fs.existsSync(sensorExe)) {
    try {
      sensorProcess = spawn(sensorExe, [], {
        cwd: ROOT_DIR,
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      // ignore
    }
  }
}

async function ensureBackendServer() {
  const alreadyUp = await checkGameVibeReady();
  if (alreadyUp) return;

  const nextBin = path.join(ROOT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (fs.existsSync(nextBin)) {
    serverProcess = spawn(process.execPath, [nextBin, 'dev', '-p', String(PORT)], {
      cwd: ROOT_DIR,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    serverProcess = spawn('node', [nextBin, 'dev', '-p', String(PORT)], {
      cwd: ROOT_DIR,
      shell: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  }

  for (let i = 0; i < 45; i++) {
    const ready = await checkGameVibeReady();
    if (ready) break;
    await new Promise((r) => setTimeout(r, 500));
  }
}

function setMiniHudWindowGeometry(enableMini) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isMiniHudMode = Boolean(enableMini);
  if (isMiniHudMode) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setMinimumSize(420, 175);
    mainWindow.setSize(480, 188, true);
    isAlwaysOnTop = true;
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    mainWindow.setMinimumSize(390, 560);
    mainWindow.setSize(1460, 920, true);
    mainWindow.center();
  }
  mainWindow.webContents.send('window:mini-hud-changed', isMiniHudMode);
  mainWindow.webContents.send('window:aop-changed', isAlwaysOnTop);
}

function createSystemTray() {
  try {
    const iconPath = fs.existsSync(ICON_ICO) ? ICON_ICO : ICON_PNG;
    const image = nativeImage.createFromPath(iconPath);
    tray = new Tray(image);
    tray.setToolTip('GameVibe v2.0 — AI Game Soundtrack Director');

    const updateTrayMenu = () => {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Открыть GameVibe v2.0',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
        {
          label: isMiniHudMode ? '✓ Игровой Мини-HUD (Alt+M)' : 'Игровой Мини-HUD (Alt+M)',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              setMiniHudWindowGeometry(!isMiniHudMode);
            }
          },
        },
        {
          label: isAlwaysOnTop ? '✓ Закреплено поверх игры (Alt+P)' : 'Закрепить поверх игры (Alt+P)',
          click: () => {
            if (!mainWindow) return;
            isAlwaysOnTop = !isAlwaysOnTop;
            mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver');
            mainWindow.webContents.send('window:aop-changed', isAlwaysOnTop);
            updateTrayMenu();
          },
        },
        { type: 'separator' },
        {
          label: 'Сцена: Спокойная (Alt+1)',
          click: () => mainWindow?.webContents.send('hotkey:vibe', 'EXPLORE'),
        },
        {
          label: 'Сцена: Скрытность (Alt+2)',
          click: () => mainWindow?.webContents.send('hotkey:vibe', 'STEALTH'),
        },
        {
          label: 'Сцена: Сражение (Alt+3)',
          click: () => mainWindow?.webContents.send('hotkey:vibe', 'COMBAT'),
        },
        {
          label: 'Сцена: Босс (Alt+4)',
          click: () => mainWindow?.webContents.send('hotkey:vibe', 'BOSSFIGHT'),
        },
        {
          label: 'Сцена: Панорама / Триумф (Alt+5)',
          click: () => mainWindow?.webContents.send('hotkey:vibe', 'MAJESTIC'),
        },
        { type: 'separator' },
        {
          label: 'Выйти из GameVibe',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);
      tray.setContextMenu(contextMenu);
    };

    updateTrayMenu();
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch {
    // ignore tray error
  }
}

async function createDesktopWindow() {
  startBackgroundSensors();
  await ensureBackendServer();

  const iconPath = fs.existsSync(ICON_ICO) ? ICON_ICO : ICON_PNG;

  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 390,
    minHeight: 560,
    title: 'GameVibe v2.0 — Autonomous AI Soundtrack Director',
    icon: iconPath,
    backgroundColor: '#080809',
    frame: false,
    autoHideMenuBar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
  });

  mainWindow.setMenu(null);
  mainWindow.loadURL(APP_URL);

  // Open external links (e.g. music.youtube.com, spotify) in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes(`localhost:${PORT}`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createSystemTray();

  // Register Global In-Game Hotkeys
  const hotkeyMap = {
    'Alt+1': 'EXPLORE',
    'Alt+2': 'STEALTH',
    'Alt+3': 'COMBAT',
    'Alt+4': 'BOSSFIGHT',
    'Alt+5': 'MAJESTIC',
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

  // Alt+M toggles Ultra-Mini In-Game HUD Bar
  globalShortcut.register('Alt+M', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    setMiniHudWindowGeometry(!isMiniHudMode);
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
  const next = typeof forceState === 'boolean' ? forceState : !isMiniHudMode;
  setMiniHudWindowGeometry(next);
  return isMiniHudMode;
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:hide-to-tray', () => mainWindow?.hide());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});
ipcMain.handle('window:close', () => {
  isQuitting = true;
  app.quit();
});

app.whenReady().then(createDesktopWindow);

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  for (const proc of [serverProcess, directorProcess, sensorProcess]) {
    if (proc) {
      try {
        proc.kill();
      } catch {}
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
