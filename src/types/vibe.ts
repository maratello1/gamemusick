export type VibeStateId = 'EXPLORE' | 'STEALTH' | 'COMBAT' | 'BOSSFIGHT' | 'VICTORY';

export interface VibeStateConfig {
  id: VibeStateId;
  label: string;
  shortLabel: string;
  description: string;
  bpmRange: string;
  energyThreshold: number;
  accentHex: string;
  defaultSearchQuery: string;
}

export interface TrackItem {
  videoId: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  vibe: VibeStateId;
  genreTag: string;
  bpm?: number;
  source: 'ytmusic' | 'community' | 'local';
}

export interface GamePreset {
  id: string;
  gameTitle: string;
  shortLabel: string;
  processNames: string[];
  presetName: string;
  author: string;
  authorHandle: string;
  likes: number;
  downloads: number;
  isOfficial?: boolean;
  isLiked?: boolean;
  coverGradient: string;
  category: string;
  description: string;
  vibeQueries: Record<VibeStateId, string>;
  triggers: {
    combatMotionThreshold: number;
    bossRedFlashThreshold: number;
    stealthDarknessThreshold: number;
    cooldownSeconds: number;
  };
  curatedTracks: Record<VibeStateId, TrackItem[]>;
}

export interface IntegrationPlugin {
  id: string;
  name: string;
  shortLabel: string;
  category: 'music' | 'sensor' | 'social';
  status: 'connected' | 'ready' | 'configurable';
  enabled: boolean;
  description: string;
  badgeText: string;
  endpointOrProtocol: string;
}

export interface TelemetrySnapshot {
  timestamp: number;
  activeWindowTitle: string;
  detectedProcess: string;
  matchedGamePresetId: string | null;
  motionDelta: number; // 0 - 100
  crimsonIndex: number; // 0 - 100 (Red HP/Damage/Boss flash)
  luminance: number; // 0 - 100 (Darkness vs Daylight)
  audioPeakDb: number; // 0 - 100
  compositeIntensity: number; // 0 - 100
  inferredVibe: VibeStateId;
  captureMode: 'live-screen' | 'auto-sim' | 'manual-override';
}

export interface UserProfile {
  id: string;
  username: string;
  handle: string;
  avatarColor: string;
  level: string;
  favoriteGenres: {
    EXPLORE: string[];
    STEALTH: string[];
    COMBAT: string[];
    BOSSFIGHT: string[];
    VICTORY: string[];
  };
  crossfadeDurationSec: number;
  autoSwitchEnabled: boolean;
  hysteresisCooldownSec: number;
  activePresetId: string;
  savedPresetIds: string[];
}
