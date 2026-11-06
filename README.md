<div align="center">

  <img src="public/banner.png" alt="GameVibe Banner" width="100%" style="max-width: 1200px; border-radius: 12px; margin-bottom: 16px;" />

  # GAMEVIBE v2.0
  ### AI Sound Director & Adaptive Gaming Soundtrack Platform

  **Умный саундтрек для любых игр: ИИ определяет ситуацию на экране и мгновенно переключает музыку между спокойным исследованием, яростными битвами и боссами — 100% бесплатно.**

  [![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-blue?style=for-the-badge&logo=windows)](https://github.com/Maratello2/gamevibe)
  [![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)
  [![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20Electron%20%7C%20TypeScript-purple?style=for-the-badge)](https://github.com/Maratello2/gamevibe)
  [![Free](https://img.shields.io/badge/Cost-100%25%20Free%20%26%20Zero--Token-red?style=for-the-badge)](https://github.com/Maratello2/gamevibe)

</div>

---

## ⚡ О проекте

**GameVibe** превращает любую игру в кинематографичный блокбастер с адаптивной музыкой (как в *DOOM*, *Witcher 3* или *Cyberpunk 2077*), даже если игра сама этого не поддерживает.

Вам больше не нужно вручную ставить музыку на паузу или терпеть неподходящие треки во время боссфайтов. GameVibe анализирует оптическую динамику кадра, сюжетные субтитры и поведение игрока — и плавно переключает треки под текущую сцену.

---

## 🎮 Ключевые возможности

### 1. 🎭 Пользовательские подборки со сценами (Scene-Based Playlists)
Создавайте собственные подборки и распределяйте треки по 6 игровым ситуациям:
- 🌿 **Спокойная сцена / Исследование (`EXPLORE`)**: мирные прогулки, сбор лута, отдых у костра.
- ⚔️ **Битва / Сражение (`COMBAT`)**: стычки с врагами, экшен, получение урона.
- 💀 **Битва с боссом / Апогей (`BOSSFIGHT`)**: кульминационные бои и тяжелые схватки.
- 🎬 **Драма и диалоги (`DRAMA`)**: сюжетные диалоги, катсцены, драматические моменты.
- 🌄 **Величественная панорама (`MAJESTIC`)**: открытие новых локаций, триумф, восходы.
- 🌙 **Скрытность и напряжение (`STEALTH`)**: темные подземелья, засады, подкрадывание.

> ИИ-режиссер выбирает трек именно из нужной сцены с **очередью анти-повторов на 50 треков** и интеллектуальной иерархией fallback-ов.

### 2. 🎵 100% Бесплатный Studio Master Engine (YouTube Audio)
- Никаких 30-секундных превью iTunes. Воспроизведение **полных треков** в студийном качестве через встроенный движок YouTube Audio.
- Быстрый поиск любых песен и OST прямо внутри программы в 1 клик.
- Поддержка вставки прямых ссылок (`https://youtu.be/...`).
- Опциональная интеграция с **Spotify Premium** и **Apple Music** для тех, кто предпочитает свои стриминги.

### 3. 👥 Система учетных записей (Multi-Account)
- Создание нескольких профилей игроков с кастомными аватарами и персональными вкусами.
- Мгновенное переключение между аккаунтами без паролей и облачных авторизаций.

### 4. 🧠 Двухуровневый ИИ-режиссер (AI Director)
- **Уровень 1: Локальный оптический Win32-сенсор 50 Гц**
  - Абсолютно безопасен для античитов (*Easy Anti-Cheat, BattlEye, VAC, Vanguard*) — **не внедряется в память игры**.
  - Оценивает динамику движения, яркость, красный спектр урона.
  - Локальное распознавание субтитров через встроенный Windows WinRT OCR.
- **Уровень 2: Визуальная модель Gemini Vision (Опционально, BYOK)**
  - Возможность подключить собственный бесплатный ключ Google Gemini Vision API для глубокого кинематографичного анализа происходящего на экране.

### 5. 🔊 Windows Audio Ducking (Приглушение звука игры)
- В моменты сюжетных катсцен и драматических диалогов звук фоновой музыки плавно приглушается, чтобы голос персонажей звучал разборчиво.

---

## 📸 Скриншоты интерфейса

<div align="center">
  <img src="docs/screenshots/desktop-scene-playlists.png" alt="Scene-Based Playlists Editor" width="100%" style="border-radius: 8px; margin-bottom: 12px;" />
  <p><em>Редактор подборок со сценами: разделение треков под исследование, битвы и боссов</em></p>
</div>

<div align="center">
  <img src="docs/screenshots/desktop-account-modal.png" alt="Multi-Account Switcher" width="100%" style="border-radius: 8px; margin-bottom: 12px;" />
  <p><em>Окно переключения учетных записей и палитра профилей</em></p>
</div>

---

## 🚀 Быстрый старт

### Вариант 1: Запуск готового `.exe` (Windows)
1. Скачайте последний релиз из вкладки [Releases](https://github.com/Maratello2/gamevibe/releases).
2. Запустите `GameVibe.exe` — программа готова к работе из коробки!

### Вариант 2: Запуск из исходного кода
Требования: [Node.js 18+](https://nodejs.org/) и Windows 10/11.

```bash
# Клонировать репозиторий
git clone https://github.com/Maratello2/gamevibe.git
cd gamevibe

# Установить зависимости
npm install

# Запустить десктопный клиент
npm run desktop

# Или веб-версию
npm run dev
```

---

## ⌨️ Глобальные горячие клавиши (In-Game Hotkeys)

Работают поверх любой полноэкранной или оконной игры:
- `Alt + 1` — Переключить сцену в **Спокойное исследование (Explore)**
- `Alt + 2` — Переключить сцену в **Скрытность (Stealth)**
- `Alt + 3` — Переключить сцену в **Сражение (Combat)**
- `Alt + 4` — Переключить сцену в **Битву с боссом (Bossfight)**
- `Alt + 5` — Переключить сцену в **Триумф (Victory / Majestic)**
- `Alt + P` — Включить / выключить компактный оверлей **поверх игры (Always on Top)**

---

## 🛡️ Безопасность и античиты (Anti-Cheat Invariant)

GameVibe **не является читом** и **не внедряет DLL в процессы игр**:
- Используется только стандартный Windows Desktop Duplication API / `BitBlt` для анализа кадра (аналогично Discord Overlay, OBS Studio и GeForce Experience).
- Нет чтения памяти (`ReadProcessMemory`), нет хуков DirectX.
- Безопасно для игр соревновательного уровня: *Counter-Strike 2, Apex Legends, Dota 2, Elden Ring, Valorant*.

---

## 📄 Лицензия

Распространяется под свободной лицензией [MIT](LICENSE).

---

<div align="center">
  <sub>Создано для геймеров, ценящих максимальное погружение и идеальный вайб.</sub>
</div>
