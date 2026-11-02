import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const script = `// ==UserScript==
// @name         GameVibe AI-DJ — YouTube Music Browser Tab Bridge
// @namespace    http://localhost:3000/
// @version      1.0.0
// @description  Автоматически синхронизирует открытую вкладку YouTube Music (music.youtube.com) с детектором игрового вайба GameVibe без платной подписки.
// @author       GameVibe Core
// @match        https://music.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  let currentVideoId = null;

  console.log('[GameVibe Bridge] Подключено к http://localhost:3000/api/presets');

  async function pollVibeEngine() {
    try {
      const res = await fetch('http://localhost:3000/api/presets');
      const data = await res.json();
      const target = data.activeBridgeTrack;
      if (!target || !target.videoId) return;

      const videoEl = document.querySelector('video');
      if (videoEl && typeof target.volume === 'number') {
        videoEl.volume = Math.max(0, Math.min(1, target.volume / 100));
      }

      if (currentVideoId !== target.videoId) {
        currentVideoId = target.videoId;
        const nextUrl = 'https://music.youtube.com/watch?v=' + target.videoId;
        if (!window.location.href.includes(target.videoId)) {
          window.location.href = nextUrl;
        }
      }
    } catch (e) {
      // Ожидание запуска локального ядра GameVibe
    }
  }

  setInterval(pollVibeEngine, 2500);
})();
`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Disposition': 'inline; filename="gamevibe-ytm-bridge.user.js"',
    },
  });
}
