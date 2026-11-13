import fs from 'fs';
import path from 'path';

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const REPO = 'maratello1/gamemusick';
const TAG = 'v3.0.0';

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

  const bodyText = `## 🎮 GameMusick v3.0.0 — Hybrid AI Director & Dota 2 / CS2 GSI

### 🏆 Что нового в v3.0:
- **Официальная интеграция Valve GSI (Dota 2 & CS2)**: игра сама сообщает точную фазу (Главное меню, Драфт, Линия, Замес, Низкое HP, Бомба на пленте, Респавн, Победа) — 100% точность и 0 квот облака. Автоустановка \`.cfg\` в 1 клик!
- **Непрерывный движок \`SceneVector\` (15+ сцен)** вместо жёстких 6 корзин + прямой промпт желаемой атмосферы + RL-оценка треков («В тему» / «Не под сцену»).
- **Универсальный выбор ИИ-режиссёра (4 режима)**:
  1. **Локальный 50 Гц Rust + WinRT OCR** (полностью офлайн)
  2. **Google Gemini (\`gemini-3.5-flash-lite\` Free Tier)** со смарт-фильтром смены кадра (экономит до 80% квоты)
  3. **Ollama (Локальная VLM)**: \`qwen3-vl:2b\`, \`qwen3.5:4b\`, \`gemma4:e4b\` без интернета и суточных лимитов
  4. **OpenRouter / LM Studio / OpenAI-compatible API**
- **Переработанный режим «Мои артисты»**: при выборе своих артистов игра больше не подмешивает левые OST и эмбиенты в меню и матчах.

### 📦 Файлы релиза:
- **\`GameMusick-Sensor-v3.0-Windows-x64.zip\`** (Рекомендуется) — пакет: \`interactive_sensor.exe\`, \`local_director.py\`, \`vision_director.py\`, \`.cfg\` файлы для Dota 2 и CS2 и \`README.txt\`.
- **\`interactive_sensor.exe\`** — нативный 50 Гц сенсор на Rust.
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
    { file: 'GameMusick-Sensor-v3.0-Windows-x64.zip', mime: 'application/zip' },
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
