export type VibeStateId = 'EXPLORE' | 'STEALTH' | 'COMBAT' | 'BOSSFIGHT' | 'VICTORY';

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
  runningWindows: RunningWindowProcess[];
  motionDelta: number;
  crimsonIndex: number;
  luminance: number;
  compositeIntensity: number;
  inferredVibe: VibeStateId;
}
