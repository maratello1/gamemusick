import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { DirectorScene, TelemetrySnapshot, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

const SENSOR_FILE = path.join(process.cwd(), 'data', 'live-sensor.json');
const SENSOR_EXE = path.join(process.cwd(), 'desktop', 'interactive_sensor.exe');
const DIRECTOR_FILE = path.join(process.cwd(), 'data', 'scene-director.json');
const DIRECTOR_PY = path.join(process.cwd(), 'desktop', 'local_director.py');
const DIALOGUE_FILE = path.join(process.cwd(), 'data', 'live-dialogue.json');

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
let lastDirectorSpawnAttempt = 0;

const SCENE_LABELS: Record<string, string> = {
  DRAMA_CUTSCENE: 'Трагическая катсцена / Драма',
  MAJESTIC_CUTSCENE: 'Воодушевляющая катсцена / Панорама',
  NEW_LOCATION_MAJESTIC: 'Новая локация / Величественная панорама',
  NEW_LOCATION_DRAMA: 'Новая локация / Мрачная атмосфера',
  COMBAT_ACTION: 'Сражение / Боевой экшен',
  STEALTH_NIGHT: 'Таинственная ночь / Скрытность',
  MAJESTIC_VISTA: 'Красивая локация / Панорама',
  DRAMA_TENSION: 'Мрачная локация / Напряжение',
  EXPLORE_PEACE: 'Спокойное исследование',
};

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

  // 0. Auto-supervise Local Director (100% Free WinRT OCR + Computer Vision daemon)
  if (now - lastDirectorSpawnAttempt > 5000) {
    let isDirectorStale = true;
    if (fs.existsSync(DIRECTOR_FILE)) {
      try {
        const dStat = fs.statSync(DIRECTOR_FILE);
        if (now - dStat.mtimeMs < 4500) {
          isDirectorStale = false;
        }
      } catch {
        // ignore
      }
    }
    if (isDirectorStale && fs.existsSync(DIRECTOR_PY)) {
      lastDirectorSpawnAttempt = now;
      try {
        const child = spawn('python', [DIRECTOR_PY], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.unref();
      } catch {
        // ignore
      }
    }
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

      const resolvedSceneKey = typeof parsed.sceneKey === 'string' ? parsed.sceneKey : '';
      let resolvedLabel =
        SCENE_LABELS[resolvedSceneKey] ||
        (typeof parsed.sceneLabel === 'string' && parsed.sceneLabel.length > 0
          ? parsed.sceneLabel
          : undefined);

      // 1. Neural OCR Dialogue Context reading
      let dialogueText = '';
      let dialogueEmotion = '';
      let dialogueLabel = '';
      let isNeuralDialogueActive = false;

      if (fs.existsSync(DIALOGUE_FILE)) {
        try {
          const dStat = fs.statSync(DIALOGUE_FILE);
          if (now - dStat.mtimeMs < 5000) {
            const dData = JSON.parse(fs.readFileSync(DIALOGUE_FILE, 'utf8'));
            if (dData && dData.isDialogueActive && dData.text) {
              dialogueText = dData.text;
              dialogueEmotion = dData.emotion || 'DRAMA';
              dialogueLabel = dData.label || 'Сюжетный диалог';
              isNeuralDialogueActive = true;
            }
          }
        } catch {
          // ignore
        }
      }

      // 2. Vision Director Context
      let director: DirectorScene | undefined;
      try {
        if (fs.existsSync(DIRECTOR_FILE)) {
          const dd = JSON.parse(fs.readFileSync(DIRECTOR_FILE, 'utf8').replace(/^\uFEFF/, ''));
          if (dd && dd.ok && now - Number(dd.timestamp) < 45000) {
            director = dd as DirectorScene;
          }
        }
      } catch {
        // ignore
      }

      const inferredVibeFinal =
        isNeuralDialogueActive && (dialogueEmotion === 'DRAMA' || dialogueEmotion === 'MAJESTIC')
          ? (dialogueEmotion as VibeStateId)
          : (parsed.inferredVibe as VibeStateId) || vibe;

      const sensorSaysCombat = parsed.inferredVibe === 'COMBAT' || parsed.inferredVibe === 'BOSSFIGHT';
      const finalVibe: VibeStateId =
        director && !sensorSaysCombat ? director.vibe : inferredVibeFinal;

      if (isNeuralDialogueActive && dialogueText) {
        resolvedLabel = `🎬 ${dialogueLabel}: "${dialogueText.slice(0, 45)}..."`;
      }
      if (director && director.summary) {
        resolvedLabel = director.summary;
      }

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
        inferredVibe: finalVibe,
        isCutscene:
          Boolean(parsed.isCutscene) ||
          isNeuralDialogueActive ||
          (director ? ['cutscene', 'dialogue', 'tragedy'].includes(director.sceneType) : false),
        isNewLocation: Boolean(parsed.isNewLocation),
        gameAudioDucked: Boolean(parsed.gameAudioDucked),
        sceneKey: isNeuralDialogueActive ? `${dialogueEmotion}_DIALOGUE` : resolvedSceneKey,
        sceneEmotion: isNeuralDialogueActive
          ? dialogueEmotion
          : typeof parsed.sceneEmotion === 'string'
          ? parsed.sceneEmotion
          : undefined,
        sceneLabel: resolvedLabel,
        dialogueText: isNeuralDialogueActive ? dialogueText : director?.onScreenText || undefined,
        dialogueEmotion: isNeuralDialogueActive ? dialogueEmotion : undefined,
        dialogueLabel: isNeuralDialogueActive ? dialogueLabel : undefined,
        director,
      };
    }
  } catch {
    // Keep lastSnapshot if mid-write
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
