import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TelemetrySnapshot, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

const SENSOR_FILE = path.join(process.cwd(), 'data', 'live-sensor.json');
const SENSOR_EXE = path.join(process.cwd(), 'desktop', 'interactive_sensor.exe');

let lastSnapshot: TelemetrySnapshot = {
  timestamp: Date.now(),
  activeWindowTitle: 'Ожидание игры',
  detectedProcess: 'Ожидание игры',
  runningWindows: [],
  motionDelta: 14,
  crimsonIndex: 0,
  luminance: 35,
  compositeIntensity: 14,
  inferredVibe: 'EXPLORE',
};

let manualOverrideUntil = 0;
let lastSensorSpawnAttempt = 0;

function inferVibeFromMetrics(
  energy: number,
  crimson: number
): { vibe: VibeStateId; intensity: number } {
  if (energy >= 74 || crimson >= 50) {
    return { vibe: 'BOSSFIGHT', intensity: Math.min(100, Math.max(energy, 82)) };
  }
  if (energy >= 42) {
    return { vibe: 'COMBAT', intensity: Math.min(100, Math.max(energy, 56)) };
  }
  if (energy >= 28) {
    return { vibe: 'STEALTH', intensity: Math.max(energy, 32) };
  }
  return { vibe: 'EXPLORE', intensity: Math.max(10, energy) };
}

export async function GET() {
  const now = Date.now();

  if (now < manualOverrideUntil) {
    return NextResponse.json({
      ...lastSnapshot,
      timestamp: now,
    });
  }

  try {
    let rawJson: string | null = null;

    if (fs.existsSync(SENSOR_FILE)) {
      const stat = fs.statSync(SENSOR_FILE);
      const ageMs = now - stat.mtimeMs;
      if (ageMs < 3500) {
        rawJson = fs.readFileSync(SENSOR_FILE, 'utf8');
      }
    }

    if (!rawJson) {
      // Sensor daemon is not running or stale — kick off interactive scheduled task and run --once
      if (now - lastSensorSpawnAttempt > 4000) {
        lastSensorSpawnAttempt = now;
        exec('schtasks /Run /TN "GameVibeInteractiveSensor"', () => {});
      }
      if (fs.existsSync(SENSOR_EXE)) {
        const { stdout } = await execAsync(`"${SENSOR_EXE}" --once`, { timeout: 1200 });
        if (stdout && stdout.trim().startsWith('{')) {
          rawJson = stdout.trim();
        }
      }
    }

    if (rawJson) {
      const clean = rawJson.replace(/^\uFEFF/, '').trim();
      const parsed = JSON.parse(clean);

      const motion = Math.max(8, Math.min(100, Number(parsed.motionDelta) || 14));
      const crimson = Math.max(0, Math.min(100, Number(parsed.redAlertRatio) || 0));
      const luma = Math.max(5, Math.min(100, Number(parsed.brightness) || 35));
      const proc = String(parsed.detectedProcess || 'Ожидание игры');
      const title = String(parsed.windowTitle || proc);

      const { vibe, intensity } = inferVibeFromMetrics(motion, crimson);

      lastSnapshot = {
        timestamp: now,
        activeWindowTitle: title,
        detectedProcess: proc,
        runningWindows: [
          {
            processName: proc,
            windowTitle: title,
            pid: 0,
          },
        ],
        motionDelta: motion,
        crimsonIndex: crimson,
        luminance: luma,
        compositeIntensity: intensity,
        inferredVibe: (parsed.inferredVibe as VibeStateId) || vibe,
      };
    }
  } catch {
    // Keep lastSnapshot if file is mid-write
  }

  return NextResponse.json(lastSnapshot);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      motionDelta = lastSnapshot.motionDelta,
      crimsonIndex = lastSnapshot.crimsonIndex,
      luminance = lastSnapshot.luminance,
      activeWindowTitle = lastSnapshot.activeWindowTitle,
      detectedProcess = lastSnapshot.detectedProcess,
      forceVibe,
      holdMs = 10000,
    } = body;

    const { vibe, intensity } = inferVibeFromMetrics(motionDelta, crimsonIndex);
    manualOverrideUntil = Date.now() + Number(holdMs || 10000);

    lastSnapshot = {
      ...lastSnapshot,
      timestamp: Date.now(),
      activeWindowTitle,
      detectedProcess,
      motionDelta,
      crimsonIndex,
      luminance,
      compositeIntensity: intensity,
      inferredVibe: forceVibe || vibe,
    };

    return NextResponse.json(lastSnapshot);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid telemetry payload', details: String(err) },
      { status: 400 }
    );
  }
}
