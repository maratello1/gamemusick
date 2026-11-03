import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TelemetrySnapshot, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

let lastSnapshot: TelemetrySnapshot = {
  timestamp: Date.now(),
  activeWindowTitle: 'Рабочий стол Windows',
  detectedProcess: 'explorer.exe',
  runningWindows: [],
  motionDelta: 14,
  crimsonIndex: 6,
  luminance: 46,
  compositeIntensity: 18,
  inferredVibe: 'EXPLORE',
};

let prevColors: number[] = [45, 45, 45, 45, 45];
let lastQueryTime = 0;

function inferVibeFromMetrics(
  motion: number,
  crimson: number,
  luminance: number
): { vibe: VibeStateId; intensity: number } {
  const composite = Math.min(100, Math.round(motion * 0.65 + crimson * 0.35));

  if (crimson >= 45 || composite >= 80) {
    return { vibe: 'BOSSFIGHT', intensity: Math.max(composite, 84) };
  }
  if (motion >= 48 || composite >= 55) {
    return { vibe: 'COMBAT', intensity: Math.max(composite, 62) };
  }
  if (luminance <= 24 && motion < 45) {
    return { vibe: 'STEALTH', intensity: Math.max(composite, 38) };
  }
  return { vibe: 'EXPLORE', intensity: Math.max(12, composite) };
}

export async function GET() {
  const now = Date.now();

  if (now - lastQueryTime > 1500) {
    lastQueryTime = now;
    try {
      const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$hwnd = [Win32Fg]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[void][Win32Fg]::GetWindowText($hwnd, $sb, 256)
$pidOut = 0
[void][Win32Fg]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
$proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$w = $screen.Width; $h = $screen.Height
$bmp = New-Object System.Drawing.Bitmap(1, 1)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$pts = @(
  @([int]($w*0.5), [int]($h*0.5)),
  @([int]($w*0.3), [int]($h*0.3)),
  @([int]($w*0.7), [int]($h*0.3)),
  @([int]($w*0.3), [int]($h*0.7)),
  @([int]($w*0.7), [int]($h*0.7))
)
$lumas = @(); $reds = 0
foreach ($pt in $pts) {
  $g.CopyFromScreen($pt[0], $pt[1], 0, 0, $bmp.Size)
  $c = $bmp.GetPixel(0, 0)
  $l = [int]((0.299*$c.R + 0.587*$c.G + 0.114*$c.B)/2.55)
  $lumas += $l
  if ($c.R -gt ($c.G + $c.B)*0.75 -and $c.R -gt 90) { $reds += 25 }
}
$g.Dispose(); $bmp.Dispose()
Write-Output "$($proc.ProcessName)|$($sb.ToString())|$($lumas -join ',')|$reds"
      `
        .trim()
        .replace(/\r?\n/g, '; ');

      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
        { timeout: 1400 }
      );

      const parts = stdout.trim().split('|');
      if (parts.length >= 4) {
        const procName = `${parts[0] || 'explorer'}.exe`;
        const winTitle = parts[1] || 'Активное окно Windows';
        const lumaArr = parts[2].split(',').map((n) => parseInt(n, 10) || 40);
        const redScore = parseInt(parts[3], 10) || 0;

        const avgLuma = Math.round(
          lumaArr.reduce((acc, v) => acc + v, 0) / Math.max(1, lumaArr.length)
        );

        let diffSum = 0;
        for (let i = 0; i < lumaArr.length; i++) {
          diffSum += Math.abs(lumaArr[i] - (prevColors[i] ?? lumaArr[i]));
        }
        prevColors = lumaArr;

        const motionDelta = Math.min(100, Math.max(8, Math.round(diffSum * 1.4)));
        const crimsonIndex = Math.min(100, Math.max(5, redScore));

        const { vibe, intensity } = inferVibeFromMetrics(
          motionDelta,
          crimsonIndex,
          avgLuma
        );

        lastSnapshot = {
          timestamp: now,
          activeWindowTitle: winTitle,
          detectedProcess: procName,
          runningWindows: [{ pid: 0, processName: procName, windowTitle: winTitle }],
          motionDelta,
          crimsonIndex,
          luminance: avgLuma,
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
