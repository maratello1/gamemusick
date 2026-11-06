export type VibeStateId =
  | 'EXPLORE'
  | 'MAJESTIC'
  | 'DRAMA'
  | 'STEALTH'
  | 'COMBAT'
  | 'BOSSFIGHT'
  | 'VICTORY';

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
  isCutscene?: boolean;
  isNewLocation?: boolean;
  gameAudioDucked?: boolean;
  sceneKey?: string;
  sceneEmotion?: string;
  sceneLabel?: string;
  brightness?: number;
  windowTitle?: string;
  sensorMode?: string;
  dialogueText?: string;
  dialogueEmotion?: string;
  dialogueLabel?: string;
  director?: DirectorScene;
}

/** Scene understanding produced by desktop/vision_director.py (Gemini vision). */
export interface DirectorScene {
  timestamp: number;
  game: string;
  sceneType: string;
  vibe: VibeStateId;
  mood: string;
  tension: number;
  location: string;
  summary: string;
  onScreenText: string;
  musicStyle: string;
  changeMusic: boolean;
  picks: { artist: string; title: string }[];
}
