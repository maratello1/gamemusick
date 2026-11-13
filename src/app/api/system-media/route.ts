import { NextRequest, NextResponse } from 'next/server';
import { ChildProcessByStdio, exec, spawn } from 'child_process';
import { Writable } from 'stream';
import { promisify } from 'util';

const execAsync = promisify(exec);

const KEY_MAP: Record<string, number> = {
  PLAY_PAUSE: 179, // VK_MEDIA_PLAY_PAUSE
  PLAY: 179,
  PAUSE: 179,
  NEXT_TRACK: 176, // VK_MEDIA_NEXT_TRACK
  NEXT: 176,
  PREV_TRACK: 177, // VK_MEDIA_PREV_TRACK
  PREV: 177,
  STOP: 178, // VK_MEDIA_STOP
  VOL_UP: 175, // VK_VOLUME_UP
  VOL_DOWN: 174, // VK_VOLUME_DOWN
  MUTE: 173, // VK_VOLUME_MUTE
};

type MediaWorkerProc = ChildProcessByStdio<Writable, null, null>;
let mediaWorker: MediaWorkerProc | null = null;
let workerReady = false;

function getOrSpawnMediaWorker(): MediaWorkerProc | null {
  if (mediaWorker && !mediaWorker.killed && mediaWorker.exitCode === null) {
    return mediaWorker;
  }
  try {
    const psInit = [
      `$sig = '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);'`,
      `$kb = Add-Type -MemberDefinition $sig -Name 'GvMediaKey' -Namespace 'Win32' -PassThru`,
      `while (($line = [Console]::In.ReadLine()) -ne $null) {`,
      `  $vk = 0`,
      `  if ([int]::TryParse($line.Trim(), [ref]$vk) -and $vk -gt 0) {`,
      `    $kb::keybd_event([byte]$vk, 0, 0, [UIntPtr]::Zero)`,
      `    Start-Sleep -Milliseconds 15`,
      `    $kb::keybd_event([byte]$vk, 0, 2, [UIntPtr]::Zero)`,
      `  }`,
      `}`,
    ].join('; ');

    const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psInit], {
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    child.unref();
    child.on('exit', () => {
      if (mediaWorker === child) {
        mediaWorker = null;
        workerReady = false;
      }
    });
    mediaWorker = child;
    workerReady = true;
    return child;
  } catch {
    return null;
  }
}

async function dispatchMediaVirtualKey(keyCode: number): Promise<'worker' | 'oneshot'> {
  const worker = getOrSpawnMediaWorker();
  if (worker && workerReady && worker.stdin.writable) {
    try {
      worker.stdin.write(`${keyCode}\n`);
      return 'worker';
    } catch {
      // fall through to one-shot dispatch
    }
  }
  const ps = `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]${keyCode})`;
  await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
    timeout: 4000,
    windowsHide: true,
  });
  return 'oneshot';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawCmd = String(body.command || body.action || '').trim().toUpperCase();

    if (KEY_MAP[rawCmd]) {
      const keyCode = KEY_MAP[rawCmd];
      const via = await dispatchMediaVirtualKey(keyCode);
      return NextResponse.json({ ok: true, executed: rawCmd, keyCode, via });
    }

    if (rawCmd === 'OPEN_PLATFORM' && body.url) {
      const url = String(body.url);
      if (url.startsWith('https://') || url.startsWith('spotify:')) {
        await execAsync(`cmd /c start "" "${url}"`, { timeout: 3000, windowsHide: true });
        return NextResponse.json({ ok: true, opened: url });
      }
    }

    return NextResponse.json({ ok: false, error: 'Unknown command' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
