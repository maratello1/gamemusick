import fs from 'fs';
import path from 'path';

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const REPO = 'maratello1/gamemusick';
const TAG = 'v3.1.0';

async function run() {
  if (!TOKEN) {
    console.error('GITHUB_TOKEN or GH_TOKEN is required to publish GitHub Release assets.');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'User-Agent': 'GameMusick-Release-Uploader',
    Accept: 'application/vnd.github+json',
  };

  const bodyText = `## 🎮 GameMusick v3.1.0 — 6-Game Native Bridges, WASAPI Sensor & Bulletproof Audio

### 🏆 Что нового в v3.1:
- **Нативный Rust-сенсор v3.1 (CoreAudio WASAPI + 32×18 DIB)**: мониторинг звука самой игры по PID (\`gameAudioPeak\`), поддержка Per-Monitor DPI, в 48 раз меньше вызовов GDI и защита от ложных срабатываний на чёрных кадрах DX12.
- **Native Game Bridges 2.0 (6 игр без чтения памяти)**: Dota 2 & CS2 Valve GSI + автоматические мосты для **League of Legends (\`:2999\`)**, **StarCraft II (\`:6119\`)**, **Path of Exile 1/2 (\`Client.txt\`)** и **Minecraft (\`latest.log\`)**.
- **Неубиваемый аудиодвижок и RL-ранжирование**: авто-скип битых/заблокированных YouTube embed-видео (Error \`100/101/150\`) без штрафного понижения артиста в ИИ, fallback на локальную музыку / процедурный \`stemSynth\`, быстрый Win32 воркер медиа-клавиш, кроссфейд без гонок и учёт весов RL в \`/api/ytmusic\`.
- **Desktop Watchdog & Mini-HUD**: автоперезапуск фоновых сенсоров в Electron и быстрые кнопки 👍 / 👎 в оверлее \`Alt+M\`.

### 📦 Файлы релиза:
- **\`GameMusick-Sensor-v3.1-Windows-x64.zip\`** (Рекомендуется) — пакет: \`interactive_sensor.exe\`, \`local_director.py\`, \`vision_director.py\`, \`.cfg\` файлы для Dota 2 и CS2 и \`README.txt\`.
- **\`interactive_sensor.exe\`** — нативный 50 Гц сенсор на Rust (Windows CoreAudio WASAPI + 32×18 DIB).
- **\`gamestate_integration_gamemusick.cfg\` / \`gamestate_integration_cs2_gamemusick.cfg\`** — готовые конфиги для Steam.

> ℹ️ **Windows SmartScreen**: это бесплатный open-source проект без платной коммерческой ЭЦП ($400/год). Нажмите «Подробнее» -> «Выполнить в любом случае» либо запускайте полную версию из исходников: \`npm install && npm run desktop\`.`;

  // 1. Find existing release by tag or create it
  let release = null;
  const byTagRes = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`, { headers });
  if (byTagRes.ok) {
    release = await byTagRes.json();
    const patchRes = await fetch(`https://api.github.com/repos/${REPO}/releases/${release.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: TAG,
        name: `GameMusick ${TAG} — Hybrid AI & Dota 2 / CS2 GSI`,
        body: bodyText,
      }),
    });
    release = await patchRes.json();
  } else {
    const createRes = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: TAG,
        target_commitish: 'main',
        name: `GameMusick ${TAG} — Hybrid AI & Dota 2 / CS2 GSI`,
        body: bodyText,
        draft: false,
        prerelease: false,
      }),
    });
    if (!createRes.ok) {
      console.error('Failed to create release:', createRes.status, await createRes.text());
      process.exit(1);
    }
    release = await createRes.json();
  }

  const assetsToUpload = [
    { file: 'GameMusick-Sensor-v3.1-Windows-x64.zip', mime: 'application/zip' },
    { file: 'interactive_sensor.exe', mime: 'application/vnd.microsoft.portable-executable' },
    { file: 'gamestate_integration_gamemusick.cfg', mime: 'text/plain' },
    { file: 'gamestate_integration_cs2_gamemusick.cfg', mime: 'text/plain' },
  ];

  // Delete duplicates with the same asset name first
  for (const existing of release.assets || []) {
    if (assetsToUpload.some((a) => a.file === existing.name)) {
      await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${existing.id}`, {
        method: 'DELETE',
        headers,
      });
    }
  }

  // Upload assets
  for (const item of assetsToUpload) {
    const fullPath = path.join(process.cwd(), 'desktop', item.file);
    const bytes = fs.readFileSync(fullPath);
    console.log(`Uploading ${item.file} (${bytes.length} bytes)...`);
    const upRes = await fetch(
      `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(item.file)}`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': item.mime,
          'Content-Length': String(bytes.length),
        },
        body: bytes,
      }
    );
    if (!upRes.ok) {
      console.error(`Failed ${item.file}:`, upRes.status, await upRes.text());
      process.exit(1);
    }
  }

  console.log(`Published release ${TAG}: ${release.html_url}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
