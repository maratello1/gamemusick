import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { DirectorScene, GsiStateSnapshot, TelemetrySnapshot, VibeStateId } from '@/types/vibe';
import { pollActiveNativeGameBridge } from '@/lib/game-telemetry-bridge';
import {
  detectGameArchetype,
  tickNeuralEvolution,
  recordPlayerFeedback,
  recordTrackSceneFeedback,
  getNeuralBrainState,
  executeBatchPretraining,
  isOnlineCompetitiveGame,
} from '@/lib/neural-evolution';
import {
  classifyTelemetryToSceneVector,
  legacyVibeToSceneTag,
  mapSceneTagToLegacyVibe,
  resolveSceneFromTextPrompt,
  SCENE_TAXONOMY,
} from '@/lib/scene-engine';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

const SENSOR_FILE = path.join(process.cwd(), 'data', 'live-sensor.json');
const SENSOR_EXE = path.join(process.cwd(), 'desktop', 'interactive_sensor.exe');
const DIRECTOR_FILE = path.join(process.cwd(), 'data', 'scene-director.json');
const DIRECTOR_PY = path.join(process.cwd(), 'desktop', 'local_director.py');
const DIALOGUE_FILE = path.join(process.cwd(), 'data', 'live-dialogue.json');
const GSI_FILE = path.join(process.cwd(), 'data', 'live-gsi.json');

let lastSnapshot: TelemetrySnapshot = {
  timestamp: Date.now(),
  activeWindowTitle: 'Ожидание игры',
  detectedProcess: 'Ожидание игры',
  runningWindows: [],
  motionDelta: 10,
  crimsonIndex: 0,
  luminance: 35,
  compositeIntensity: 10,
  inferredVibe: 'EXPLORE',
  sceneLabel: 'Ожидание запуска игры · Фоновый эмбиент',
  isCutscene: false,
  isNewLocation: false,
  gameAudioDucked: false,
  sensorMode: 'rust-win32-50hz-neural-synced',
};

let manualOverrideUntil = 0;
let lastSensorSpawnAttempt = 0;
let lastDirectorSpawnAttempt = 0;

const SCENE_LABELS: Record<string, string> = {
  STANDBY: 'Ожидание запуска игры · Фоновый эмбиент',
  BOSSFIGHT: '🔥 Эпическая битва с Боссом',
  COMBAT: 'Сражение / Боевой экшен',
  DRAMA: 'Кинематографическая катсцена',
  MAJESTIC: 'Вход в новую локацию',
  STEALTH: 'Скрытное проникновение',
  EXPLORE: 'Атмосферное исследование',
  RESPAWN: '💀 Ожидание возрождения (Spectator Downtime)',
  CLUTCH: '⚡ Киберспорт: Решающий клатч / Дуэль',
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
  crimson: number,
  combatThresh: number = 42
): { vibe: VibeStateId; intensity: number } {
  if (energy >= 74 || crimson >= 50) {
    return { vibe: 'BOSSFIGHT', intensity: Math.min(100, Math.max(energy, 82)) };
  }
  if (energy >= combatThresh) {
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

      const rawProc = String(parsed.detectedProcess || 'Ожидание игры');
      const isInvalid =
        !rawProc ||
        rawProc === 'IDLE_STANDBY' ||
        rawProc === 'STANDBY' ||
        rawProc.toLowerCase().includes('electron') ||
        rawProc.toLowerCase().includes('gamemusick') ||
        rawProc.toLowerCase().includes('gamevibe') ||
        rawProc.toLowerCase().includes('antigravity') ||
        rawProc.toLowerCase().includes('cursor') ||
        rawProc.toLowerCase().includes('explorer');

      const proc = isInvalid ? 'Ожидание игры' : rawProc;
      const rawTitle = String(parsed.windowTitle || proc);
      const title = isInvalid || rawTitle === 'IDLE_STANDBY' ? 'Ожидание игры' : rawTitle;
      const rawIsStandby = proc === 'Ожидание игры';
      const isOnlineRaw = !rawIsStandby && (Boolean(parsed.isOnlineGame) || isOnlineCompetitiveGame(proc));

      // Check Official Dota 2 / CS2 Game State Integration first so even in borderless/alt-tab
      // or main menu GSI provides exact live match/lobby telemetry without false standby.
      let gsiSnap: GsiStateSnapshot | null = null;
      let gsiActive = false;
      try {
        if (fs.existsSync(GSI_FILE)) {
          const gStat = fs.statSync(GSI_FILE);
          if (now - gStat.mtimeMs < 12000) {
            const parsedGsi = JSON.parse(fs.readFileSync(GSI_FILE, 'utf8')) as GsiStateSnapshot;
            const procLower = proc.toLowerCase();
            const matchesProc =
              (parsedGsi.game === 'dota2' && procLower.includes('dota')) ||
              (parsedGsi.game === 'cs2' && (procLower.includes('cs2') || procLower.includes('csgo')));
            if (parsedGsi && (rawIsStandby || matchesProc || isOnlineRaw)) {
              gsiSnap = parsedGsi;
              gsiActive = true;
            }
          }
        }
      } catch {
        // ignore stale or partial GSI file
      }

      if (!gsiActive && !rawIsStandby) {
        try {
          const bridgeSnap = await pollActiveNativeGameBridge(proc);
          if (bridgeSnap) {
            gsiSnap = bridgeSnap;
            gsiActive = true;
          }
        } catch {
          // ignore native bridge timeout
        }
      }

      const activeProc = rawIsStandby && gsiActive && gsiSnap ? gsiSnap.game : proc;
      const activeTitle = rawIsStandby && gsiActive && gsiSnap ? gsiSnap.gameTitle : title;
      const isStandby = rawIsStandby && !gsiActive;

      const motion = isStandby ? 10 : Math.max(8, Math.min(100, Number(parsed.motionDelta) || 14));
      const crimson = isStandby ? 0 : Math.max(0, Math.min(100, Number(parsed.redAlertRatio) || 0));
      const luma = Math.max(5, Math.min(100, Number(parsed.brightness) || 35));
      const lumaVariance = isStandby ? 0 : Math.max(0, Math.min(100, Number(parsed.lumaVariance) || 18));
      const cursorTravel = isStandby ? 0 : Math.max(0, Number(parsed.cursorTravel) || 0);
      const attackApm = isStandby ? 0 : Math.max(0, Number(parsed.attackApm) || 0);
      const moveApm = isStandby ? 0 : Math.max(0, Number(parsed.moveApm) || 0);
      const gameAudioPeak = !isStandby && typeof parsed.gameAudioPeak === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.gameAudioPeak)))
        : undefined;
      const captureBlocked = !isStandby && Boolean(parsed.captureBlocked);
      const warmth = !isStandby && typeof parsed.warmth === 'number' ? Math.round(parsed.warmth) : undefined;
      const coolness = !isStandby && typeof parsed.coolness === 'number' ? Math.round(parsed.coolness) : undefined;
      const saturation = !isStandby && typeof parsed.saturation === 'number' ? Math.round(parsed.saturation) : undefined;
      const sceneHint = typeof parsed.sceneHint === 'string' ? parsed.sceneHint : '';

      const preBrain = getNeuralBrainState();
      const archetype = detectGameArchetype(activeProc, activeTitle);

      // 1. Neural OCR Dialogue Context reading (only when in actual non-GSI game)
      let dialogueText = '';
      let dialogueEmotion = '';
      let dialogueLabel = '';
      let isNeuralDialogueActive = false;

      if (!isStandby && fs.existsSync(DIALOGUE_FILE)) {
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
        if (!isStandby && fs.existsSync(DIRECTOR_FILE)) {
          const dd = JSON.parse(fs.readFileSync(DIRECTOR_FILE, 'utf8').replace(/^\uFEFF/, ''));
          if (dd && dd.ok && now - Number(dd.timestamp) < 45000) {
            director = dd as DirectorScene;
          }
        }
      } catch {
        // ignore
      }

      const isOnline = isOnlineRaw || gsiActive;
      const isRespawnSpectating = gsiActive
        ? Boolean(gsiSnap?.isRespawning)
        : !isStandby && Boolean(parsed.isRespawnSpectating);

      const {
        sceneVector: classifiedVectorRaw,
        inferredVibe: classifiedVibeRaw,
        intensity: intensityRaw,
      } = classifyTelemetryToSceneVector({
        isStandby,
        detectedProcess: activeProc,
        windowTitle: activeTitle,
        gameGenre: archetype.id,
        isOnlineGame: isOnline,
        motionDelta: motion,
        crimsonIndex: crimson,
        brightness: luma,
        lumaVariance,
        gameAudioPeak,
        captureBlocked,
        warmth,
        coolness,
        saturation,
        cursorTravel,
        attackApm,
        moveApm,
        isCutscene: Boolean(parsed.isCutscene),
        isNewLocation: Boolean(parsed.isNewLocation),
        isRespawnSpectating,
        sceneHint,
        combatThreshold: preBrain.learnedThresholds.combatMotionThreshold,
        bossSensitivity: preBrain.learnedThresholds.bossSensitivity,
        stealthLumaThreshold: preBrain.learnedThresholds.stealthLumaThreshold,
        dialogueText: isNeuralDialogueActive ? dialogueText : '',
        dialogueEmotion,
        director: director || null,
      });

      let classifiedVector = classifiedVectorRaw;
      let classifiedVibe = classifiedVibeRaw;
      let intensity = intensityRaw;

      if (gsiActive && gsiSnap) {
        const meta = SCENE_TAXONOMY[gsiSnap.sceneTag] || SCENE_TAXONOMY.explore_wander;
        classifiedVector = {
          sceneTag: gsiSnap.sceneTag,
          sceneNameRu: gsiSnap.sceneNameRu,
          energy: gsiSnap.energy,
          tension: gsiSnap.tension,
          valence: gsiSnap.valence,
          pacing: gsiSnap.pacing,
          musicBrief: meta.ostMoodKeywords,
          confidence: 99,
          source: 'gsi',
        };
        classifiedVibe = mapSceneTagToLegacyVibe(
          gsiSnap.sceneTag,
          gsiSnap.energy,
          gsiSnap.tension,
          gsiSnap.valence
        );
        intensity = Math.max(gsiSnap.energy, gsiSnap.tension);
      }

      const keepManualOverride = now < manualOverrideUntil && lastSnapshot.sceneVector;
      const finalSceneVector = keepManualOverride
        ? lastSnapshot.sceneVector!
        : classifiedVector;
      const finalVibe: VibeStateId = keepManualOverride
        ? lastSnapshot.inferredVibe
        : classifiedVibe;

      const resolvedSceneKey = typeof parsed.sceneKey === 'string' ? parsed.sceneKey : finalSceneVector.sceneTag.toUpperCase();
      const rawLabel = typeof parsed.sceneLabel === 'string' ? parsed.sceneLabel : '';
      let resolvedLabel = isStandby
        ? 'Ожидание запуска игры · Фоновый эмбиент'
        : finalSceneVector.sceneNameRu || SCENE_LABELS[rawLabel] || SCENE_LABELS[resolvedSceneKey] || 'Атмосферное исследование';

      if (!isStandby && gsiActive && gsiSnap && !keepManualOverride) {
        resolvedLabel = gsiSnap.sceneNameRu;
      } else if (!isStandby && isNeuralDialogueActive && dialogueText && !keepManualOverride) {
        resolvedLabel = `${dialogueLabel}: ${dialogueText.slice(0, 64).trim()}`;
      } else if (!isStandby && director && director.summary && director.process && !director.process.includes('Ожидание игры') && !keepManualOverride) {
        resolvedLabel = director.summary;
      }

      const neuralEvolution = tickNeuralEvolution({
        detectedProcess: activeProc,
        windowTitle: activeTitle,
        motionDelta: motion,
        crimsonIndex: crimson,
        luminance: luma,
        currentVibe: finalVibe,
      });

      lastSnapshot = {
        timestamp: now,
        activeWindowTitle: activeTitle,
        detectedProcess: activeProc,
        runningWindows: [
          {
            processName: activeProc,
            windowTitle: activeTitle,
            pid: 0,
          },
        ],
        motionDelta: motion,
        crimsonIndex: crimson,
        luminance: luma,
        lumaVariance,
        cursorTravel,
        attackApm,
        moveApm,
        sceneHint,
        compositeIntensity: intensity,
        inferredVibe: finalVibe,
        sceneVector: finalSceneVector,
        isOnlineGame: isOnline,
        isRespawnSpectating: isRespawnSpectating,
        gsiActive,
        gsiGame: gsiSnap?.game,
        gsiPhase: gsiSnap?.phase,
        gsiSummary: gsiSnap?.summary,
        nativeBridgeSource: gsiSnap ? `${gsiSnap.game}-api` : undefined,
        gameAudioPeak,
        captureBlocked,
        warmth,
        coolness,
        saturation,
        isCutscene:
          !isStandby &&
          (Boolean(parsed.isCutscene) ||
            isNeuralDialogueActive ||
            finalSceneVector.sceneTag === 'dialogue_story' ||
            finalSceneVector.sceneTag === 'tragedy_drama' ||
            (director ? ['cutscene', 'dialogue', 'tragedy'].includes(director.sceneType) : false)),
        isNewLocation: !isStandby && (Boolean(parsed.isNewLocation) || finalSceneVector.sceneTag === 'vista_wonder'),
        gameAudioDucked: !isStandby && Boolean(parsed.gameAudioDucked),
        sceneKey: isStandby ? '' : isNeuralDialogueActive ? `${dialogueEmotion}_DIALOGUE` : resolvedSceneKey,
        sceneEmotion: isStandby
          ? 'EXPLORE'
          : isNeuralDialogueActive
          ? dialogueEmotion
          : finalVibe,
        sceneLabel: resolvedLabel,
        dialogueText: isNeuralDialogueActive ? dialogueText : director?.onScreenText || undefined,
        dialogueEmotion: isNeuralDialogueActive ? dialogueEmotion : undefined,
        dialogueLabel: isNeuralDialogueActive ? dialogueLabel : undefined,
        sensorMode: typeof parsed.sensorMode === 'string' ? parsed.sensorMode : 'rust-win32-50hz-neural-synced',
        director,
        neuralEvolution,
      };
    } else {
      lastSnapshot.neuralEvolution = getNeuralBrainState();
    }
  } catch {
    // Keep lastSnapshot if mid-write
  }

  if (!lastSnapshot.neuralEvolution) {
    lastSnapshot.neuralEvolution = getNeuralBrainState();
  }

  return NextResponse.json(lastSnapshot);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'batch_pretrain') {
      const updatedBrain = executeBatchPretraining();
      lastSnapshot.neuralEvolution = updatedBrain;
      return NextResponse.json({
        ok: true,
        message: 'Batch pretraining completed on benchmark dataset',
        neuralEvolution: updatedBrain,
      });
    }

    if (body.action === 'track_feedback') {
      const updatedBrain = recordTrackSceneFeedback({
        detectedProcess: String(body.detectedProcess || lastSnapshot.detectedProcess || ''),
        windowTitle: String(body.windowTitle || lastSnapshot.activeWindowTitle || ''),
        sceneTag: String(body.sceneTag || lastSnapshot.sceneVector?.sceneTag || 'explore_wander'),
        sceneNameRu: String(body.sceneNameRu || lastSnapshot.sceneVector?.sceneNameRu || 'Исследование'),
        trackId: String(body.trackId || ''),
        trackTitle: String(body.trackTitle || ''),
        isPositive: Boolean(body.isPositive),
        energy: Number(body.energy ?? lastSnapshot.sceneVector?.energy ?? 30),
        tension: Number(body.tension ?? lastSnapshot.sceneVector?.tension ?? 25),
        motionDelta: Number(body.motionDelta ?? lastSnapshot.motionDelta ?? 20),
      });
      lastSnapshot.neuralEvolution = updatedBrain;
      return NextResponse.json({
        ok: true,
        neuralEvolution: updatedBrain,
      });
    }

    const {
      motionDelta = lastSnapshot.motionDelta,
      crimsonIndex = lastSnapshot.crimsonIndex,
      luminance = lastSnapshot.luminance,
      activeWindowTitle = lastSnapshot.activeWindowTitle,
      detectedProcess = lastSnapshot.detectedProcess,
      forceVibe,
      forceSceneTag,
      forceScenePrompt,
      holdMs = 10000,
    } = body;

    const brainState = getNeuralBrainState();
    const { vibe, intensity } = inferVibeFromMetrics(
      motionDelta,
      crimsonIndex,
      brainState.learnedThresholds.combatMotionThreshold
    );
    manualOverrideUntil = Date.now() + Number(holdMs || 10000);

    let customVector = forceScenePrompt
      ? resolveSceneFromTextPrompt(String(forceScenePrompt))
      : undefined;

    if (!customVector && forceSceneTag) {
      const tagStr = String(forceSceneTag);
      const { sceneVector: sv } = classifyTelemetryToSceneVector({
        isStandby: false,
        detectedProcess,
        windowTitle: activeWindowTitle,
        isOnlineGame: Boolean(lastSnapshot.isOnlineGame),
        motionDelta,
        crimsonIndex,
        brightness: luminance,
        combatThreshold: brainState.learnedThresholds.combatMotionThreshold,
        bossSensitivity: brainState.learnedThresholds.bossSensitivity,
        stealthLumaThreshold: brainState.learnedThresholds.stealthLumaThreshold,
        sceneHint: tagStr.toUpperCase(),
      });
      customVector = { ...sv, sceneTag: tagStr, source: 'manual' };
    }

    const userChosen = customVector
      ? mapSceneTagToLegacyVibe(
          customVector.sceneTag,
          customVector.energy,
          customVector.tension,
          customVector.valence
        )
      : ((forceVibe || vibe) as VibeStateId);
    let neuralEvolution = brainState;

    if (userChosen !== lastSnapshot.inferredVibe) {
      neuralEvolution = recordPlayerFeedback({
        detectedProcess,
        windowTitle: activeWindowTitle,
        aiPredictedVibe: lastSnapshot.inferredVibe,
        userChosenVibe: userChosen,
        motionDelta,
        crimsonIndex,
        luminance,
      });
    }

    const resolvedTag =
      customVector?.sceneTag || legacyVibeToSceneTag(userChosen, Boolean(lastSnapshot.isOnlineGame));
    const { sceneVector: fallbackVector } = classifyTelemetryToSceneVector({
      isStandby: false,
      detectedProcess,
      windowTitle: activeWindowTitle,
      isOnlineGame: Boolean(lastSnapshot.isOnlineGame),
      motionDelta,
      crimsonIndex,
      brightness: luminance,
      combatThreshold: brainState.learnedThresholds.combatMotionThreshold,
      bossSensitivity: brainState.learnedThresholds.bossSensitivity,
      stealthLumaThreshold: brainState.learnedThresholds.stealthLumaThreshold,
      sceneHint: resolvedTag.toUpperCase(),
    });

    lastSnapshot = {
      ...lastSnapshot,
      timestamp: Date.now(),
      activeWindowTitle,
      detectedProcess,
      motionDelta,
      crimsonIndex,
      luminance,
      compositeIntensity: intensity,
      inferredVibe: userChosen,
      sceneVector: customVector || fallbackVector,
      sceneLabel: (customVector || fallbackVector).sceneNameRu,
      neuralEvolution,
    };

    return NextResponse.json(lastSnapshot);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid telemetry payload', details: String(err) },
      { status: 400 }
    );
  }
}
