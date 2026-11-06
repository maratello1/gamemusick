import { TrackItem, VibeStateId } from './vibe';

export type SceneBucketId =
  | 'EXPLORE'
  | 'COMBAT'
  | 'BOSSFIGHT'
  | 'DRAMA'
  | 'MAJESTIC'
  | 'STEALTH';

export interface SceneBucketInfo {
  id: SceneBucketId;
  label: string;
  shortLabel: string;
  shortHint: string;
  description: string;
  icon: string;
  accentColor: string;
}

export const SCENE_BUCKET_CONFIGS: Record<SceneBucketId, SceneBucketInfo> = {
  EXPLORE: {
    id: 'EXPLORE',
    label: 'Спокойная сцена / Исследование',
    shortLabel: 'Спокойная сцена',
    shortHint: 'Исследование, лут, отдых',
    description: 'Когда игрок ходит по миру, исследует локации, лутается или отдыхает.',
    icon: 'Compass',
    accentColor: '#10B981', // emerald
  },
  COMBAT: {
    id: 'COMBAT',
    label: 'Битва / Ожесточенное сражение',
    shortLabel: 'Сражение',
    shortHint: 'Стычки, атаки, динамика',
    description: 'Когда игрок атакует врагов, получает урон или участвует в динамичной драке.',
    icon: 'Swords',
    accentColor: '#EF4444', // red
  },
  BOSSFIGHT: {
    id: 'BOSSFIGHT',
    label: 'Битва с боссом / Апогей',
    shortLabel: 'Босс',
    shortHint: 'Кульминация, боссы',
    description: 'Кульминационные сражения с боссами и ключевыми противниками.',
    icon: 'Skull',
    accentColor: '#DC2626', // dark red
  },
  DRAMA: {
    id: 'DRAMA',
    label: 'Драма / Сюжетный диалог / Катсцена',
    shortLabel: 'Драма и диалоги',
    shortHint: 'Катсцены, диалоги, сюжет',
    description: 'Сюжетные катсцены, диалоги персонажей, драматические и трагические моменты.',
    icon: 'Film',
    accentColor: '#8B5CF6', // purple
  },
  MAJESTIC: {
    id: 'MAJESTIC',
    label: 'Величественная панорама / Триумф',
    shortLabel: 'Панорама',
    shortHint: 'Красивые виды, триумф',
    description: 'Красивые виды, восходы, открытие новых масштабных областей и триумфы.',
    icon: 'Sun',
    accentColor: '#F59E0B', // amber
  },
  STEALTH: {
    id: 'STEALTH',
    label: 'Скрытность / Мрачное напряжение',
    shortLabel: 'Скрытность',
    shortHint: 'Засады, скрытность',
    description: 'Темные подземелья, подкрадывание, засады и осторожное перемещение.',
    icon: 'EyeOff',
    accentColor: '#06B6D4', // cyan
  },
};

export interface ScenePlaylist {
  id: string;
  name: string;
  gameTag: string; // e.g. "Castlevania", "Dark Souls", "Для любых игр"
  description: string;
  createdAt: number;
  updatedAt: number;
  scenes: Record<SceneBucketId, TrackItem[]>;
}

export interface UserAccount {
  id: string;
  username: string;
  avatarColor: string;
  createdAt: number;
  favoriteGenres: string[];
  favoriteArtists: string[];
  customArtistsText: string;
  gameGenres: string[];
  driveMode: 'immersion' | 'balanced' | 'high-drive';
  languagePref: 'all' | 'foreign' | 'ru';
  vocalPref: 'vocal' | 'mixed' | 'instrumental';
  playlists: ScenePlaylist[];
  selectedPlaylistId?: string;
  useCustomPlaylistInAutopilot: boolean;
  playlistsCount?: number;
}

export interface AccountsStore {
  activeAccountId: string;
  accounts: UserAccount[];
}
