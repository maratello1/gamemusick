import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

/**
 * Controls Windows Global Media Session (Play/Pause, Next, Prev, Volume)
 * or opens a native desktop protocol URI (spotify:, music.yandex.ru, music.youtube.com, soundcloud.com, vk.com).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const command = String(body.command || '');

    // 1. Native Windows Media Key injection (controls Spotify Desktop, Yandex Music Desktop, Browser, AIMP, etc.)
    const keyMap: Record<string, number> = {
      PLAY_PAUSE: 179, // VK_MEDIA_PLAY_PAUSE
      NEXT_TRACK: 176, // VK_MEDIA_NEXT_TRACK
      PREV_TRACK: 177, // VK_MEDIA_PREV_TRACK
      VOL_UP: 175,     // VK_VOLUME_UP
      VOL_DOWN: 174,   // VK_VOLUME_DOWN
      VOL_MUTE: 173,   // VK_VOLUME_MUTE
    };

    if (keyMap[command]) {
      const keyCode = keyMap[command];
      const ps = `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]${keyCode})`;
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
        timeout: 1500,
      });
      return NextResponse.json({ ok: true, executed: command });
    }

    // 2. Open track/search in native desktop app or browser platform
    if (command === 'OPEN_PLATFORM' && body.url) {
      const targetUrl = String(body.url).replace(/"/g, '');
      await execAsync(`cmd /c start "" "${targetUrl}"`, { timeout: 1500 });
      return NextResponse.json({ ok: true, opened: targetUrl });
    }

    return NextResponse.json({ ok: false, error: 'Unknown command' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
