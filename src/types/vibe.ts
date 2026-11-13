export type VibeStateId =
  | 'EXPLORE'
  | 'MAJESTIC'
  | 'DRAMA'
  | 'STEALTH'
  | 'COMBAT'
  | 'BOSSFIGHT'
  | 'VICTORY';

export type SceneTagId =
  | 'standby'
  | 'menu_lobby'
  | 'cozy_hub'
  | 'explore_wander'
  | 'vista_wonder'
  | 'stealth_infiltrate'
  | 'horror_dread'
  | 'dialogue_story'
  | 'tragedy_drama'
  | 'respawn_downtime'
  | 'skirmish_combat'
  | 'teamfight_clash'
  | 'chase_escape'
  | 'boss_climax'
  | 'victory_triumph'
  | (string & {});

export type ScenePacing = 'still' | 'slow' | 'steady' | 'driving' | 'frantic';

export interface SceneVector {
  sceneTag: SceneTagId;
  sceneNameRu: string;
  energy: number;
  tension: number;
  valence: number;
  pacing: ScenePacing;
  musicBrief: string;
  confidence: number;
  source: 'standby' | 'sensor' | 'ocr' | 'vision' | 'gsi' | 'manual';
  accentHex?: string;
}

export interface CustomSceneRule {
  id: string;
  name: string;
  description: string;
  musicBrief: string;
  keywords: string[];
  targetEnergy: number;
  targetTension: number;
  targetValence: number;
  accentColor: string;
  tracks: TrackItem[];
}

export type MusicPlatformId =
  | 'builtin'
  | 'ytmusic'
  | 'spotify'
  | 'yandex'
  | 'soundcloud'
  | 'vkmusic'
  | 'local';

export interface VibeStateConfig {
  id: VibeStateId;
  label: string;
  shortLabel: string;
  description: string;
  accentHex: string;
  defaultSearchQuery: string;
}

export interface TrackItem {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbnail: string;
  previewUrl?: string;
  vibe: VibeStateId;
  genreTag: string;
  localPath?: string;
}

export interface GameRuleProfile {
  id: string;
  gameTitle: string;
  shortLabel: string;
  executable: string;
  genreFocus: string;
  vibeArtistSeeds: Record<VibeStateId, string>;
}

export interface RunningWindowProcess {
  pid: number;
  processName: string;
  windowTitle: string;
}

export interface TelemetrySnapshot {
  timestamp: number;
  activeWindowTitle: string;
  detectedProcess: string;
  runningWindows?: RunningWindowProcess[];
  motionDelta: number;
  crimsonIndex: number;
  luminance: number;
  compositeIntensity: number;
  inferredVibe: VibeStateId;
  sceneVector?: SceneVector;
  cursorTravel?: number;
  attackApm?: number;
  moveApm?: number;
  lumaVariance?: number;
  sceneHint?: string;
  activeAudioMode?: string;
  isCutscene?: boolean;
  isNewLocation?: boolean;
  gameAudioDucked?: boolean;
  isOnlineGame?: boolean;
  isRespawnSpectating?: boolean;
  gsiActive?: boolean;
  gsiGame?: string;
  gsiPhase?: string;
  gsiSummary?: string;
  sceneKey?: string;
  sceneEmotion?: string;
  sceneLabel?: string;
  brightness?: number;
  windowTitle?: string;
  sensorMode?: string;
  gameAudioPeak?: number;
  captureBlocked?: boolean;
  warmth?: number;
  coolness?: number;
  saturation?: number;
  nativeBridgeSource?: string;
  dialogueText?: string;
  dialogueEmotion?: string;
  dialogueLabel?: string;
  director?: DirectorScene;
  neuralEvolution?: NeuralEvolutionState;
}

export interface NeuralEvolutionState {
  enabled: boolean;
  isGeminiActive: boolean;
  mode: 'ONLINE_LEARNING' | 'GEMINI_CLOUD';
  statusMessage: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalEpochs: number;
  accuracy: number;
  totalCorrections: number;
  activeGame: string;
  gameAdaptationsCount: number;
  learnedThresholds: {
    combatMotionThreshold: number;
    bossSensitivity: number;
    stealthLumaThreshold: number;
    reactionSpeedMs: number;
  };
  recentLearnings: string[];
  weights: {
    motion: number;
    apm: number;
    redAlert: number;
    ocrKeywords: number;
    hysteresis: number;
  };
  lastUpdate: number;
  dislikedTrackIds?: string[];
  sceneFeedbackCount?: number;
}

/** Scene understanding produced by desktop/vision_director.py (Gemini vision). */
export interface DirectorScene {
  timestamp: number;
  process?: string;
  game: string;
  sceneType: string;
  vibe: VibeStateId;
  mood: string;
  tension: number;
  location: string;
  summary: string;
  onScreenText: string;
  musicStyle: string;
  sceneTag?: string;
  energy?: number;
  valence?: number;
  sceneLabel?: string;
  changeMusic: boolean;
  hasGeminiVision?: boolean;
  aiProvider?: string;
  picks: { artist: string; title: string }[];
}

export interface GsiStateSnapshot {
  timestamp: number;
  game: 'dota2' | 'cs2' | 'lol' | 'sc2' | 'poe' | 'minecraft';
  gameTitle: string;
  providerAppId: number;
  phase: string;
  sceneTag: SceneTagId;
  sceneNameRu: string;
  energy: number;
  tension: number;
  valence: number;
  pacing: ScenePacing;
  summary: string;
  location: string;
  isRespawning: boolean;
  respawnSeconds: number;
  inCombat: boolean;
}
