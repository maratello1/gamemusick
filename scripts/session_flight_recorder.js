/**
 * GameVibe Session Flight Recorder & Diagnostic Observer
 * Continuously records real-time telemetry, scene detections, song selections,
 * listening retention, and audio ducking performance during gameplay sessions.
 */
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'session-flight-log.jsonl');
const SUMMARY_FILE = path.join(__dirname, '..', 'data', 'session-summary.json');

const session = {
  startedAt: new Date().toISOString(),
  lastCheckTime: Date.now(),
  activeGame: 'Unknown',
  currentScene: 'EXPLORE',
  currentTrack: null,
  trackStartTime: Date.now(),
  events: [],
  trackHistory: [],
  sceneCounters: {
    EXPLORE: 0,
    COMBAT: 0,
    MAJESTIC: 0,
    DRAMA: 0,
    BOSSFIGHT: 0,
    STEALTH: 0,
  },
  totalSkips: 0,
  totalListens: 0,
};

function appendLog(event) {
  const line = JSON.stringify({ time: new Date().toISOString(), ...event }) + '\n';
  fs.appendFileSync(LOG_FILE, line, 'utf-8');
}

function saveSummary() {
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(session, null, 2), 'utf-8');
}

console.log('[FlightRecorder] GameVibe Telemetry & Playback Observer started.');
appendLog({ type: 'SESSION_START', message: 'Flight Recorder Initialized' });
saveSummary();

let prevScene = '';
let prevGame = '';
let prevTrackKey = '';
let lastTrackChangeTime = Date.now();

async function poll() {
  try {
    const [telRes, appRes] = await Promise.all([
      fetch('http://localhost:3000/api/telemetry').then((r) => (r.ok ? r.json() : null)),
      fetch('http://localhost:3000/api/app-state').then((r) => (r.ok ? r.json() : null)),
    ]);

    if (!telRes || !appRes) return;

    const game = telRes.detectedProcess || 'No Game';
    const scene = telRes.inferredVibe || 'EXPLORE';
    const motion = telRes.motionDelta || 0;
    const isCutscene = !!telRes.isCutscene;
    const isNewLocation = !!telRes.isNewLocation;
    const isAudioDucked = !!telRes.gameAudioDucked;
    const track = appRes.currentTrack || null;
    const now = Date.now();

    session.activeGame = game;
    session.lastCheckTime = now;

    // 1. Detect Game Process Change
    if (game !== prevGame && game !== 'No Game') {
      const msg = `Game changed to [${game}] (Title: "${telRes.activeWindowTitle || game}")`;
      console.log(`\n[FlightRecorder] 🎮 ${msg}`);
      appendLog({ type: 'GAME_CHANGE', game, title: telRes.activeWindowTitle });
      prevGame = game;
    }

    // 2. Detect In-Game Scene / Mood Transition
    if (scene !== prevScene) {
      session.sceneCounters[scene] = (session.sceneCounters[scene] || 0) + 1;
      const reason = isCutscene
        ? 'Cutscene dialogue / letterbox'
        : scene === 'COMBAT'
        ? `Attack cadence / motion ${motion}%`
        : isNewLocation
        ? 'Room transition / screen wipe'
        : 'Ambient exploration';

      const logMsg = `Scene Transition: ${prevScene || 'INIT'} ➔ ${scene} (${reason})`;
      console.log(`[FlightRecorder] ⚡ ${logMsg}`);
      appendLog({
        type: 'SCENE_TRANSITION',
        from: prevScene,
        to: scene,
        reason,
        motionDelta: motion,
        isCutscene,
        isNewLocation,
      });
      session.events.push({
        time: new Date().toLocaleTimeString(),
        type: 'SCENE_TRANSITION',
        scene,
        reason,
      });
      prevScene = scene;
      session.currentScene = scene;
    }

    // 3. Detect Track Change / Playback
    if (track) {
      const trackKey = `${track.artist} - ${track.title}`;
      if (trackKey !== prevTrackKey) {
        if (prevTrackKey) {
          const durationPlayedSec = Math.round((now - lastTrackChangeTime) / 1000);
          const wasFastSkip = durationPlayedSec < 20;
          if (wasFastSkip) session.totalSkips++;
          else session.totalListens++;

          session.trackHistory.push({
            track: prevTrackKey,
            listenedSec: durationPlayedSec,
            wasFastSkip,
            endedAt: new Date().toLocaleTimeString(),
          });

          console.log(
            `[FlightRecorder] ⏹ Finished/Skipped "${prevTrackKey}" after ${durationPlayedSec}s ${
              wasFastSkip ? '[Fast Skip]' : '[Good Listen]'
            }`
          );
        }

        console.log(`[FlightRecorder] 🎵 NOW PLAYING: "${trackKey}" [Scene: ${track.vibe}]`);
        appendLog({
          type: 'TRACK_START',
          title: track.title,
          artist: track.artist,
          album: track.album,
          vibe: track.vibe,
          duration: track.duration,
          game,
          ducked: isAudioDucked,
        });

        prevTrackKey = trackKey;
        lastTrackChangeTime = now;
        session.currentTrack = track;
      }
    }

    saveSummary();
  } catch (err) {
    // ignore
  }
}

setInterval(poll, 1200);
poll();
