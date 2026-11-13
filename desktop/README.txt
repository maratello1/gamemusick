=====================================================
 GameMusick Interactive Telemetry & Native Bridges Sensor v3.1
 50Hz CoreAudio WASAPI + WinRT OCR + 6-Game Bridges + Multi-AI Vision
=====================================================

1. ЧТО ВХОДИТ В АРХИВ:
- interactive_sensor.exe                 — нативный 50 Гц сенсор (Rust Win32 32x18 + CoreAudio WASAPI)
- local_director.py                      — гибридный ИИ-режиссёр + WinRT OCR + Gemini/Ollama/OpenRouter
- vision_director.py                     — автономный агент анализа сцен через Gemini 3.5 Flash Lite
- gamestate_integration_gamemusick.cfg   — официальный конфиг Valve GSI для Dota 2
- gamestate_integration_cs2_gamemusick.cfg — официальный конфиг Valve GSI для CS2

2. БЫСТРАЯ УСТАНОВКА GSI ДЛЯ DOTA 2 И CS2:
- Автоматически: откройте GameMusick -> «Связь с плеерами» -> кнопка «Автоустановить GSI в Steam».
- Либо вручную скопируйте содержимое в нужную папку Steam:
  * Dota 2:
    Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration_gamemusick.cfg
  * CS2:
    Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\gamestate_integration_gamemusick.cfg
  Перезапустите игру после копирования — GameMusick начнёт получать 100% точную телеметрию
  (главное меню, пик героев, фарм, тимфайт, бомба, респавн, победа) без единого запроса в облако.

3. БЕЗОПАСНОСТЬ И ПРЕДУПРЕЖДЕНИЯ ANTIVIRUS / SMARTSCREEN:
- Весь исходный код полностью открыт: https://github.com/maratello1/gamemusick
- Почему Chrome/Windows SmartScreen может показать предупреждение на .exe?
  1) Это бесплатный независимый open-source проект без платного коммерческого сертификата
     Microsoft Authenticode ($300–500/год).
  2) Сенсор использует Win32 API для чтения пикселей экрана и активности клавиш во время боя —
     эвристика антивирусов иногда помечает неподписанные .exe с таким API как Unknown/Suspicious.
- Решение: в окне SmartScreen нажмите «Подробнее» -> «Выполнить в любом случае», либо соберите
  проект и сенсор напрямую из исходного кода (npm install && npm run desktop).

4. АНТИЧИТЫ:
GameMusick НЕ внедряется в память игр (нет ReadProcessMemory / DLL-инъекций).
GSI — официальный документированный протокол Valve.
=====================================================
