@echo off
chcp 65001 >nul
title GameVibe v2.0 — Autonomous AI Game Soundtrack Director
cd /d "%~dp0"

echo ============================================================
echo   GameVibe v2.0 — Автономный ИИ-режиссер музыки для игр
echo ============================================================

:: 1. Запускаем локальный ИИ-сенсор сцен (если установлен Python)
where python >nul 2>nul
if %errorlevel%==0 (
    echo [1/2] Запуск локального ИИ-режиссера сцен (local_director.py)...
    start "GameVibe Local AI Director" /min python desktop\local_director.py
)

:: 2. Если есть собранный GameVibe.exe — запускаем его, иначе запускаем веб-клиент
if exist "GameVibe.exe" (
    echo [2/2] Запуск клиента GameVibe.exe...
    start "" "GameVibe.exe"
) else (
    if not exist "node_modules" (
        echo Установка зависимостей (первый запуск)...
        call npm install
    )
    echo [2/2] Запуск сервера GameVibe на http://localhost:3000 ...
    start "" http://localhost:3000
    call npm run dev
)

