import fs from 'fs';
import path from 'path';

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const REPO = 'maratello1/gamemusick';
const RELEASE_ID = 437557242;

async function run() {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'User-Agent': 'GameMusick-Release-Uploader',
  };

  // 1. Get existing assets
  const relRes = await fetch(`https://api.github.com/repos/${REPO}/releases/${RELEASE_ID}`, { headers });
  const release = await relRes.json();
  console.log('Current release tag:', release.tag_name);

  for (const asset of release.assets || []) {
    if (asset.name === 'interactive_sensor.exe' || asset.name === 'GameMusick-Sensor-v2.0-Windows-x64.zip') {
      console.log(`Deleting existing asset ${asset.name} (ID: ${asset.id})...`);
      await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`, {
        method: 'DELETE',
        headers,
      });
      console.log(`Deleted ${asset.name}`);
    }
  }

  // 2. Upload interactive_sensor.exe
  const exePath = path.join(process.cwd(), 'desktop', 'interactive_sensor.exe');
  const exeBytes = fs.readFileSync(exePath);
  console.log(`Uploading interactive_sensor.exe (${exeBytes.length} bytes)...`);
  const uploadExeRes = await fetch(
    `https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets?name=interactive_sensor.exe`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.microsoft.portable-executable',
        'Content-Length': String(exeBytes.length),
      },
      body: exeBytes,
    }
  );
  if (uploadExeRes.ok) {
    console.log('Successfully uploaded interactive_sensor.exe!');
  } else {
    console.error('Failed to upload exe:', await uploadExeRes.text());
  }

  // 3. Upload GameMusick-Sensor-v2.0-Windows-x64.zip
  const zipPath = path.join(process.cwd(), 'desktop', 'GameMusick-Sensor-v2.0-Windows-x64.zip');
  const zipBytes = fs.readFileSync(zipPath);
  console.log(`Uploading GameMusick-Sensor-v2.0-Windows-x64.zip (${zipBytes.length} bytes)...`);
  const uploadZipRes = await fetch(
    `https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets?name=GameMusick-Sensor-v2.0-Windows-x64.zip`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/zip',
        'Content-Length': String(zipBytes.length),
      },
      body: zipBytes,
    }
  );
  if (uploadZipRes.ok) {
    console.log('Successfully uploaded GameMusick-Sensor-v2.0-Windows-x64.zip!');
  } else {
    console.error('Failed to upload zip:', await uploadZipRes.text());
  }

  // 4. Update release description
  const bodyText = `## 🎮 GameMusick Desktop v2.0 — Adaptive AI Soundtrack System

### 🏆 Что нового в v2.0:
- **Выделенный режим для онлайн и киберспорта**: автоматическая адаптация для CS2, Dota 2, Valorant, Apex Legends, League of Legends, Deadlock, R6 Siege.
- **Damping кликов перемещения (APM)**: нормализация непрерывных кликов ходьбы в MOBA и наведения прицела в шутерах.
- **Фокус на шагах (Clutch Ducking)**: автоматическое приглушение музыки до 28% во время перестрелок в онлайн-играх.
- **Режим возрождения (Respawn Downtime)**: при гибели в онлайн-матчах включаются медитативные Lo-Fi / Chill биты.
- **Эмбеддинг ресурсов Windows**: официальные метаданные приложения (FileVersion, Company, Copyright, XML Manifest).

### 📦 Файлы для скачивания:
- **\`GameMusick-Sensor-v2.0-Windows-x64.zip\`** (Рекомендуется) — архив с сенсором и инструкцией (без блокировки браузером).
- **\`interactive_sensor.exe\`** — автономный 50Hz сенсор на Rust.
- **\`GameMusick.exe\`** — десктопное приложение.

> ℹ️ **Примечание о ложных срабатываниях (False Positive)**:
> Проект имеет полностью открытый исходный код (MIT). Так как проект является некоммерческим open-source и не использует платную корпоративную цифровую подпись Microsoft Authenticode ($400/год), браузер или Windows SmartScreen могут показать предупреждение. Сенсор безопасен и считывает клавиши игры исключительно для распознавания боевых стычек.
> В окне SmartScreen нажмите **«Подробнее» -> «Выполнить в любом случае»**.`;

  await fetch(`https://api.github.com/repos/${REPO}/releases/${RELEASE_ID}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: bodyText }),
  });
  console.log('Release notes updated successfully!');
}

run().catch(console.error);
