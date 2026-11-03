import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TelemetrySnapshot, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

let lastSnapshot: TelemetrySnapshot = {
  timestamp: Date.now(),
  activeWindowTitle: 'Ожидание игры',
  detectedProcess: 'explorer.exe',
  runningWindows: [],
  motionDelta: 12,
  crimsonIndex: 5,
  luminance: 45,
  compositeIntensity: 15,
  inferredVibe: 'EXPLORE',
};

let prevColors: number[] = [45, 45, 45, 45, 45];
let rollingActionEnergy = 15;
let lastQueryTime = 0;

function inferVibeFromMetrics(
  energy: number,
  crimson: number,
  luminance: number
): { vibe: VibeStateId; intensity: number } {
  if (crimson >= 50 || energy >= 78) {
    return { vibe: 'BOSSFIGHT', intensity: Math.min(100, Math.max(energy, 84)) };
  }
  if (energy >= 44) {
    return { vibe: 'COMBAT', intensity: Math.min(100, Math.max(energy, 58)) };
  }
  if (luminance <= 22 && energy < 44) {
    return { vibe: 'STEALTH', intensity: Math.max(energy, 34) };
  }
  return { vibe: 'EXPLORE', intensity: Math.max(10, energy) };
}

export async function GET() {
  const now = Date.now();

  if (now - lastQueryTime > 1300) {
    lastQueryTime = now;
    try {
      const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32Sensor {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
"@
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$hwnd = [Win32Sensor]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[void][Win32Sensor]::GetWindowText($hwnd, $sb, 256)
$pidOut = 0
[void][Win32Sensor]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
$proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue

# Sample gaming keys & mouse buttons (LMB=0x01, RMB=0x02, W=0x57, A=0x41, S=0x53, D=0x44, Space=0x20, Shift=0x10)
$keys = @(0x01, 0x02, 0x57, 0x41, 0x53, 0x44, 0x20, 0x10)
$inputScore = 0
foreach ($k in $keys) {
  $state = [Win32Sensor]::GetAsyncKeyState($k)
  if ($state -ne 0) {
    if ($k -eq 0x01 -or $k -eq 0x02) { $inputScore += 28 } else { $inputScore += 14 }
  }
}

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
Write-Output "$($proc.ProcessName)|$($sb.ToString())|$($lumas -join ',')|$reds|$inputScore"
      `
        .trim()
        .replace(/\r?\n/g, '; ');

      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
        { timeout: 1300 }
      );

      const parts = stdout.trim().split('|');
      if (parts.length >= 5) {
        const procName = `${parts[0] || 'explorer'}.exe`;
        const winTitle = parts[1] || 'Windows';
        const lumaArr = parts[2].split(',').map((n) => parseInt(n, 10) || 40);
        const redScore = parseInt(parts[3], 10) || 0;
        const inputScore = parseInt(parts[4], 10) || 0;

        const avgLuma = Math.round(
          lumaArr.reduce((acc, v) => acc + v, 0) / Math.max(1, lumaArr.length)
        );

        let diffSum = 0;
        for (let i = 0; i < lumaArr.length; i++) {
          diffSum += Math.abs(lumaArr[i] - (prevColors[i] ?? lumaArr[i]));
        }
        prevColors = lumaArr;

        const opticalDelta = Math.min(100, Math.round(diffSum * 1.6));
        const rawInstantEnergy = Math.min(
          100,
          Math.max(10, Math.round(opticalDelta * 0.55 + inputScore * 0.8 + redScore * 0.35))
        );

        // Smooth rolling energy so brief pauses don't immediately drop combat state
        if (rawInstantEnergy > rollingActionEnergy) {
          rollingActionEnergy = Math.round(rollingActionEnergy * 0.4 + rawInstantEnergy * 0.6);
        } else {
          rollingActionEnergy = Math.max(10, Math.round(rollingActionEnergy * 0.78 + rawInstantEnergy * 0.22));
        }

        const crimsonIndex = Math.min(100, Math.max(5, redScore));
        const { vibe, intensity } = inferVibeFromMetrics(
          rollingActionEnergy,
          crimsonIndex,
          avgLuma
        );

        lastSnapshot = {
          timestamp: now,
          activeWindowTitle: winTitle,
          detectedProcess: procName,
          runningWindows: [{ pid: 0, processName: procName, windowTitle: winTitle }],
          motionDelta: rollingActionEnergy,
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

    rollingActionEnergy = motionDelta;
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
