@echo off
chcp 65001 >nul
title GameVibe v2.0 — Desktop Application
cd /d "%~dp0"

if exist "GameVibe.exe" (
    start "" "GameVibe.exe"
    exit
)

if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" "desktop\main.js"
    exit
)
