import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RunningWindowProcess, TelemetrySnapshot, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

let lastSnapshot: TelemetrySnapshot = {
  timestamp: Date.now(),
  activeWindowTitle: 'Windows Desktop',
  detectedProcess: 'explorer.exe',
  runningWindows: [],
  motionDelta: 15,
  crimsonIndex: 8,
  luminance: 45,
  compositeIntensity: 20,
  inferredVibe: 'EXPLORE',
};

let lastLumaSample = 45;
let lastQueryTime = 0;

function inferVibeFromMetrics(
  motion: number,
  crimson: number,
  luminance: number
): { vibe: VibeStateId; intensity: number } {
  const composite = Math.min(100, Math.round(motion * 0.55 + crimson * 0.45));

  if (crimson >= 45 || composite >= 82) {
    return { vibe: 'BOSSFIGHT', intensity: Math.max(composite, 85) };
  }
  if (motion >= 52 || composite >= 60) {
    return { vibe: 'COMBAT', intensity: Math.max(composite, 65) };
  }
  if (luminance <= 25 && motion < 48) {
    return { vibe: 'STEALTH', intensity: Math.max(composite, 40) };
  }
  if (luminance >= 74 && crimson < 20 && motion >= 28 && motion < 52) {
    return { vibe: 'VICTORY', intensity: 46 };
  }
  return { vibe: 'EXPLORE', intensity: Math.max(14, composite) };
}

export async function GET() {
  const now = Date.now();

  if (now - lastQueryTime > 2000) {
    lastQueryTime = now;
    try {
      const psScript = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$procs = Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 8 Id, ProcessName, MainWindowTitle
$bmp = New-Object System.Drawing.Bitmap(1, 1)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$graphics.CopyFromScreen([int]($screen.Width / 2), [int]($screen.Height / 2), 0, 0, $bmp.Size)
$pixel = $bmp.GetPixel(0, 0)
$graphics.Dispose()
$bmp.Dispose()
$procJson = $procs | ConvertTo-Json -Compress
Write-Output "$($pixel.R)|$($pixel.G)|$($pixel.B)|$procJson"
      `
        .trim()
        .replace(/\r?\n/g, '; ');

      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
        { timeout: 1600 }
      );

      const firstPipe = stdout.indexOf('|');
      const secondPipe = stdout.indexOf('|', firstPipe + 1);
      const thirdPipe = stdout.indexOf('|', secondPipe + 1);

      if (firstPipe > 0 && secondPipe > 0 && thirdPipe > 0) {
        const r = parseInt(stdout.slice(0, firstPipe), 10) || 40;
        const g = parseInt(stdout.slice(firstPipe + 1, secondPipe), 10) || 45;
        const b = parseInt(stdout.slice(secondPipe + 1, thirdPipe), 10) || 55;
        const jsonPart = stdout.slice(thirdPipe + 1).trim();

        let runningWindows: RunningWindowProcess[] = [];
        try {
          const parsed = JSON.parse(jsonPart);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          runningWindows = arr
            .filter(Boolean)
            .map((p: { Id?: number; ProcessName?: string; MainWindowTitle?: string }) => ({
              pid: Number(p.Id || 0),
              processName: `${String(p.ProcessName || 'app')}.exe`,
              windowTitle: String(p.MainWindowTitle || 'Window'),
            }));
        } catch {
          // ignore parse error
        }

        const topWin = runningWindows[0];
        const luminance = Math.round(((0.299 * r + 0.587 * g + 0.114 * b) / 255) * 100);
        const crimsonIndex = Math.max(
          0,
          Math.min(100, Math.round(((r - (g + b) / 2) / 180) * 100 + 14))
        );
        const lumaDiff = Math.abs(luminance - lastLumaSample);
        lastLumaSample = luminance;
        const motionDelta = Math.min(100, Math.max(10, Math.round(lumaDiff * 2.5 + (r % 19))));

        const { vibe, intensity } = inferVibeFromMetrics(
          motionDelta,
          crimsonIndex,
          luminance
        );

        lastSnapshot = {
          timestamp: now,
          activeWindowTitle: topWin?.windowTitle || 'Windows Desktop',
          detectedProcess: topWin?.processName || 'explorer.exe',
          runningWindows,
          motionDelta,
          crimsonIndex,
          luminance,
          compositeIntensity: intensity,
          inferredVibe: vibe,
        };
      }
    } catch {
      // keep previous snapshot
    }
  }

  return NextResponse.json(lastSnapshot);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const motionDelta = Number(body.motionDelta ?? lastSnapshot.motionDelta);
    const crimsonIndex = Number(body.crimsonIndex ?? lastSnapshot.crimsonIndex);
    const luminance = Number(body.luminance ?? lastSnapshot.luminance);

    const { vibe, intensity } = inferVibeFromMetrics(motionDelta, crimsonIndex, luminance);

    lastSnapshot = {
      ...lastSnapshot,
      timestamp: Date.now(),
      motionDelta,
      crimsonIndex,
      luminance,
      compositeIntensity: body.compositeIntensity ?? intensity,
      inferredVibe: body.inferredVibe || vibe,
    };

    return NextResponse.json({ ok: true, snapshot: lastSnapshot });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
