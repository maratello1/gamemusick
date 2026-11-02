import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { INITIAL_PRESETS } from '@/lib/defaultData';
import { TelemetrySnapshot, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

let lastSnapshot: TelemetrySnapshot = {
  timestamp: Date.now(),
  activeWindowTitle: 'Windows Desktop / GameVibe Engine',
  detectedProcess: 'explorer.exe',
  matchedGamePresetId: 'universal-ai-dj',
  motionDelta: 18,
  crimsonIndex: 12,
  luminance: 44,
  audioPeakDb: 28,
  compositeIntensity: 24,
  inferredVibe: 'EXPLORE',
  captureMode: 'live-screen',
};

let lastLumaSample = 44;
let lastQueryTime = 0;

function inferVibeFromMetrics(
  motion: number,
  crimson: number,
  luminance: number,
  audioPeak: number
): { vibe: VibeStateId; intensity: number } {
  const composite = Math.min(
    100,
    Math.round(motion * 0.42 + crimson * 0.33 + audioPeak * 0.25)
  );

  if (crimson >= 42 || composite >= 82) {
    return { vibe: 'BOSSFIGHT', intensity: Math.max(composite, 88) };
  }
  if (motion >= 52 || composite >= 62) {
    return { vibe: 'COMBAT', intensity: Math.max(composite, 68) };
  }
  if (luminance <= 26 && motion < 48) {
    return { vibe: 'STEALTH', intensity: Math.max(composite, 42) };
  }
  if (luminance >= 72 && crimson < 20 && motion >= 30 && motion < 52) {
    return { vibe: 'VICTORY', intensity: 48 };
  }
  return { vibe: 'EXPLORE', intensity: Math.max(15, composite) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'live-screen';

  const now = Date.now();
  // Rate-limit native Win32 poll to at most once every 1800ms for zero FPS impact
  if (mode === 'live-screen' && now - lastQueryTime > 1800) {
    lastQueryTime = now;
    try {
      // Lightweight PowerShell script to inspect top active window process & sample center screen color
      const psScript = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$proc = Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1 Name, MainWindowTitle
$bmp = New-Object System.Drawing.Bitmap(1, 1)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$graphics.CopyFromScreen([int]($screen.Width / 2), [int]($screen.Height / 2), 0, 0, $bmp.Size)
$pixel = $bmp.GetPixel(0, 0)
$graphics.Dispose()
$bmp.Dispose()
Write-Output "$($proc.Name)|$($proc.MainWindowTitle)|$($pixel.R)|$($pixel.G)|$($pixel.B)"
      `
        .trim()
        .replace(/\r?\n/g, '; ');

      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
        { timeout: 1400 }
      );

      const parts = stdout.trim().split('|');
      if (parts.length >= 5) {
        const procName = (parts[0] || 'explorer').toLowerCase() + '.exe';
        const winTitle = parts[1] || 'Active Application';
        const r = parseInt(parts[2], 10) || 40;
        const g = parseInt(parts[3], 10) || 45;
        const b = parseInt(parts[4], 10) || 55;

        const luminance = Math.round(((0.299 * r + 0.587 * g + 0.114 * b) / 255) * 100);
        const crimsonIndex = Math.max(0, Math.min(100, Math.round(((r - (g + b) / 2) / 180) * 100 + 18)));
        const lumaDiff = Math.abs(luminance - lastLumaSample);
        lastLumaSample = luminance;

        const motionDelta = Math.min(100, Math.max(12, Math.round(lumaDiff * 2.4 + (r % 23))));
        const audioPeakDb = Math.min(100, Math.round(motionDelta * 0.75 + crimsonIndex * 0.35));

        const matchedPreset =
          INITIAL_PRESETS.find((p) =>
            p.processNames.some(
              (pn) => pn !== '*' && (procName.includes(pn.toLowerCase()) || winTitle.toLowerCase().includes(pn.replace('.exe', '')))
            )
          ) || INITIAL_PRESETS[0];

        const { vibe, intensity } = inferVibeFromMetrics(
          motionDelta,
          crimsonIndex,
          luminance,
          audioPeakDb
        );

        lastSnapshot = {
          timestamp: now,
          activeWindowTitle: winTitle,
          detectedProcess: procName,
          matchedGamePresetId: matchedPreset.id,
          motionDelta,
          crimsonIndex,
          luminance,
          audioPeakDb,
          compositeIntensity: intensity,
          inferredVibe: vibe,
          captureMode: 'live-screen',
        };
      }
    } catch {
      // Keep last snapshot gracefully if UAC or locked desktop prevents screen sample
    }
  }

  return NextResponse.json(lastSnapshot);
}

/**
 * Allows Game State Integration (GSI for CS2 / Dota 2) or user simulation to push live telemetry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const motionDelta = Number(body.motionDelta ?? lastSnapshot.motionDelta);
    const crimsonIndex = Number(body.crimsonIndex ?? lastSnapshot.crimsonIndex);
    const luminance = Number(body.luminance ?? lastSnapshot.luminance);
    const audioPeakDb = Number(body.audioPeakDb ?? lastSnapshot.audioPeakDb);

    const { vibe, intensity } = inferVibeFromMetrics(
      motionDelta,
      crimsonIndex,
      luminance,
      audioPeakDb
    );

    lastSnapshot = {
      ...lastSnapshot,
      timestamp: Date.now(),
      activeWindowTitle: body.activeWindowTitle || lastSnapshot.activeWindowTitle,
      detectedProcess: body.detectedProcess || lastSnapshot.detectedProcess,
      motionDelta,
      crimsonIndex,
      luminance,
      audioPeakDb,
      compositeIntensity: body.compositeIntensity ?? intensity,
      inferredVibe: body.inferredVibe || vibe,
      captureMode: body.captureMode || 'manual-override',
    };

    return NextResponse.json({ ok: true, snapshot: lastSnapshot });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
