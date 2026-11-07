'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Pin,
  Search,
  Radio,
  FolderOpen,
  Sliders,
  ExternalLink,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  ListMusic,
  User,
  Key,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Cpu,
  Music,
  Compass,
  Swords,
  Skull,
  Film,
  Sun,
  UserPlus,
  Users,
  Link,
  ChevronDown,
  X,
  Download,
  Upload,
  Share2,
  Minimize2,
  Maximize2,
  Copy,
} from 'lucide-react';
import { FALLBACK_REAL_TRACKS, VIBE_STATES } from '@/lib/defaultData';
import { DirectorScene, TelemetrySnapshot, TrackItem, VibeStateId } from '@/types/vibe';
import {
  AccountsStore,
  SCENE_BUCKET_CONFIGS,
  SceneBucketId,
  ScenePlaylist,
  UserAccount,
} from '@/types/account';

interface UserAccountProfile {
  username: string;
  favoriteGenres: string[];
  favoriteArtists: string[];
  customArtistsText: string;
  gameGenres: string[];
  driveMode: 'immersion' | 'balanced' | 'high-drive';
  languagePref: 'all' | 'foreign' | 'ru';
  vocalPref: 'vocal' | 'mixed' | 'instrumental';
  createdAt: number;
}

interface UserPlaylist {
  id: string;
  name: string;
  gameTag: string;
  tracks: TrackItem[];
  createdAt: number;
}

type ActiveSection =
  | 'autopilot'
  | 'account'
  | 'search'
  | 'user-playlist'
  | 'local'
  | 'integrations';

const GENRE_OPTIONS = [
  {
    id: 'rock',
    label: 'Рок и Альтернатива',
    desc: 'Alternative Rock, Shoegaze, Post-Punk, Grunge',
  },
  {
    id: 'metal',
    label: 'Метал и Тяжелый звук',
    desc: 'Nu-Metal, Industrial, Heavy Metal, Metalcore',
  },
  {
    id: 'rap',
    label: 'Рэп, Трэп и Хип-Хоп',
    desc: 'Rage Trap, Cloud Rap, RU Rap, Melodic Rap',
  },
  {
    id: 'phonk',
    label: 'Фонк и Ночной драйв',
    desc: 'Drift Phonk, Dark Phonk, Wave, Witch House',
  },
  {
    id: 'electronic',
    label: 'Электроника и Синт',
    desc: 'Synthwave, Darksynth, Drum & Bass, Cyberpunk',
  },
  {
    id: 'indie',
    label: 'Инди и Атмосфера',
    desc: 'Indie Rock, Post-Rock, Lo-Fi, Trip-Hop',
  },
  {
    id: 'ambient',
    label: 'Эмбиент и Неоклассика',
    desc: 'Ambient, Post-Rock, Neo-Classical, Drone, OST Instrumental',
  },
];

const POPULAR_ARTIST_CHIPS = [
  'Brian Eno',
  'Hans Zimmer',
  'Max Richter',
  'M83',
  'Ludovico Einaudi',
  'Sigur Rós',
  'Hammock',
  'C418',
  'Keiichi Okabe',
  'Deftones',
  'Travis Scott',
  'Playboi Carti',
  'Скриптонит',
  'Кино',
  'Linkin Park',
  'Rammstein',
  'BONES',
  '$uicideboy$',
  'The Prodigy',
  'Kavinsky',
  'Slipknot',
  'System Of A Down',
  'Arctic Monkeys',
  'DVRST',
  'Miyagi',
  'Crystal Castles',
  'Pendulum',
  'Nirvana',
  'Metallica',
  'Kanye West',
  'Radiohead',
  'PHARAOH',
  'Big Baby Tape',
  'Gesaffelstein',
  'Tame Impala',
  'Bring Me The Horizon',
  'Denzel Curry',
];

const GAME_GENRE_OPTIONS = [
  'Шутеры / Соревновательные',
  'Гонки и Дрифт',
  'RPG и Открытый мир',
  'Экшен и Слэшеры',
  'Мрачные / Хорроры',
  'Стратегии и Выживание',
];

function parseDurationStringToSec(dur?: string): number {
  if (!dur || !dur.includes(':')) return 220;
  const parts = dur.split(':').map((n) => parseInt(n, 10));
  if (parts.some((n) => Number.isNaN(n))) return 220;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 220;
}

export default function GameVibeSpotifyApp() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('autopilot');
  const [activeVibe, setActiveVibe] = useState<VibeStateId>('EXPLORE');

  // Account & Taste Profile State
  const [accountProfile, setAccountProfile] = useState<UserAccountProfile | null>(null);
  const [draftUsername, setDraftUsername] = useState<string>('');
  const [draftGenres, setDraftGenres] = useState<string[]>(['rock', 'rap', 'electronic']);
  const [draftArtists, setDraftArtists] = useState<string[]>([
    'Deftones',
    'Travis Scott',
    'Кино',
    'Kavinsky',
  ]);
  const [draftCustomArtists, setDraftCustomArtists] = useState<string>('');
  const [draftGameGenres, setDraftGameGenres] = useState<string[]>([
    'Шутеры / Соревновательные',
    'RPG и Открытый мир',
  ]);
  const [draftDriveMode, setDraftDriveMode] = useState<
    'immersion' | 'balanced' | 'high-drive'
  >('balanced');
  const [draftLanguagePref, setDraftLanguagePref] = useState<'all' | 'foreign' | 'ru'>(
    'all'
  );
  const [draftVocalPref, setDraftVocalPref] = useState<
    'vocal' | 'mixed' | 'instrumental'
  >('mixed');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  // Autonomous Autopilot state
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(true);
  const [sensitivity, setSensitivity] = useState<number>(34); // Sensible default: triggers combat fast on real game actions
  const [alwaysOnTop, setAlwaysOnTop] = useState<boolean>(false);
  const [systemMediaSync, setSystemMediaSync] = useState<boolean>(false);
  const [userMoodHint, setUserMoodHint] = useState<string>('');
  const [resolvedMoodQuery, setResolvedMoodQuery] = useState<string>(
    'Автономный поток под игру'
  );
  const [liveStreamTracks, setLiveStreamTracks] = useState<TrackItem[]>(FALLBACK_REAL_TRACKS);
  const [loadingStream, setLoadingStream] = useState<boolean>(false);

  // Preloaded decks for instant zero-latency scene switching (EXPLORE, MAJESTIC, DRAMA, STEALTH, COMBAT, BOSSFIGHT)
  const decksRef = useRef<Record<VibeStateId, TrackItem[]>>({
    EXPLORE: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'EXPLORE'),
    MAJESTIC: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'MAJESTIC'),
    DRAMA: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'DRAMA'),
    STEALTH: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'STEALTH'),
    COMBAT: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'COMBAT'),
    BOSSFIGHT: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'BOSSFIGHT'),
    VICTORY: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'VICTORY' || t.vibe === 'EXPLORE'),
  });

  // Playback state (Full-length audio stream)
  const [currentTrack, setCurrentTrack] = useState<TrackItem>(FALLBACK_REAL_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [progressSec, setProgressSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(
    parseDurationStringToSec(FALLBACK_REAL_TRACKS[0].duration)
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<TrackItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // User-created playlists & Multi-Account System
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [useCustomPlaylistInAutopilot, setUseCustomPlaylistInAutopilot] =
    useState<boolean>(false);
  const useCustomPlaylistInAutopilotRef = useRef<boolean>(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');

  // Multi-Account & Scene-Based Playlists State
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<UserAccount | null>(null);
  const activeAccountRef = useRef<UserAccount | null>(null);
  const [scenePlaylists, setScenePlaylists] = useState<ScenePlaylist[]>([]);
  const [activeScenePlaylist, setActiveScenePlaylist] = useState<ScenePlaylist | null>(null);
  const activeScenePlaylistRef = useRef<ScenePlaylist | null>(null);
  const [selectedSceneBucket, setSelectedSceneBucket] = useState<SceneBucketId>('EXPLORE');

  // Account & Playlist Modals State
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState<boolean>(false);
  const [newAccountUsername, setNewAccountUsername] = useState<string>('');
  const [newAccountColor, setNewAccountColor] = useState<string>('#6E1D2F');
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState<boolean>(false);
  const [newPlaylistGameTag, setNewPlaylistGameTag] = useState<string>('');

  // Adding track to specific scene bucket
  const [sceneSearchQuery, setSceneSearchQuery] = useState<string>('');
  const [sceneSearchResults, setSceneSearchResults] = useState<TrackItem[]>([]);
  const [isSearchingSceneTrack, setIsSearchingSceneTrack] = useState<boolean>(false);
  const [sceneDirectYtUrl, setSceneDirectYtUrl] = useState<string>('');
  const [isResolvingUrl, setIsResolvingUrl] = useState<boolean>(false);
  const [sceneActionFeedback, setSceneActionFeedback] = useState<{
    bucket: SceneBucketId;
    msg: string;
    ok: boolean;
  } | null>(null);

  // Audio Mode: 'game-vibe' (Atmospheric Ambient/Game-Matched OST) vs 'custom' (User's Favorite Artists)
  const [audioMode, setAudioMode] = useState<'game-vibe' | 'custom'>('game-vibe');
  const audioModeRef = useRef<'game-vibe' | 'custom'>('game-vibe');
  useEffect(() => {
    audioModeRef.current = audioMode;
  }, [audioMode]);

  // Local PC folder state
  const [localFolderPath, setLocalFolderPath] = useState<string>('C:\\Users\\Public\\Music');
  const [localTracks, setLocalTracks] = useState<TrackItem[]>([]);
  const [scanningLocal, setScanningLocal] = useState<boolean>(false);

  // Integrations & BYOK State (Spotify, Apple Music, Gemini Vision API)
  const [integrationsConfig, setIntegrationsConfig] = useState<{
    playbackEngine: 'youtube' | 'spotify' | 'apple';
    geminiEnabled: boolean;
    geminiApiKey: string;
    geminiModel: string;
    geminiMaskedKey: string;
    geminiHasKey: boolean;
    geminiIsValidated: boolean;
    spotifyClientId: string;
    appleDeveloperToken: string;
  }>({
    playbackEngine: 'youtube',
    geminiEnabled: false,
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    geminiMaskedKey: '',
    geminiHasKey: false,
    geminiIsValidated: false,
    spotifyClientId: '',
    appleDeveloperToken: '',
  });
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [testingGemini, setTestingGemini] = useState<boolean>(false);
  const [geminiStatusMsg, setGeminiStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingIntegrations, setSavingIntegrations] = useState<boolean>(false);

  const loadIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrationsConfig((prev) => ({
          ...prev,
          playbackEngine: data.playbackEngine || 'youtube',
          geminiEnabled: Boolean(data.gemini?.enabled),
          geminiModel: data.gemini?.model || 'gemini-2.5-flash',
          geminiMaskedKey: data.gemini?.maskedKey || '',
          geminiHasKey: Boolean(data.gemini?.hasKey),
          geminiIsValidated: Boolean(data.gemini?.isValidated),
          spotifyClientId: data.spotify?.maskedClientId || '',
          appleDeveloperToken: data.appleMusic?.hasToken ? '••••••••••••' : '',
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveIntegrations = async (updates?: any) => {
    setSavingIntegrations(true);
    try {
      const payload = {
        playbackEngine: updates?.playbackEngine || integrationsConfig.playbackEngine,
        gemini: {
          enabled: updates?.geminiEnabled !== undefined ? updates.geminiEnabled : integrationsConfig.geminiEnabled,
          apiKey: updates?.geminiApiKey !== undefined ? updates.geminiApiKey : integrationsConfig.geminiApiKey,
          model: updates?.geminiModel || integrationsConfig.geminiModel,
          intervalSec: 10,
        },
        spotify: {
          clientId: updates?.spotifyClientId !== undefined ? updates.spotifyClientId : integrationsConfig.spotifyClientId,
        },
        appleMusic: {
          developerToken: updates?.appleDeveloperToken !== undefined ? updates.appleDeveloperToken : integrationsConfig.appleDeveloperToken,
        },
      };
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await loadIntegrations();
        setGeminiStatusMsg({ ok: true, text: 'Настройки успешно сохранены!' });
      }
    } catch {
      setGeminiStatusMsg({ ok: false, text: 'Ошибка сохранения настроек' });
    } finally {
      setSavingIntegrations(false);
      setTimeout(() => setGeminiStatusMsg(null), 4000);
    }
  };

  const handleTestGeminiKey = async () => {
    const keyToTest = integrationsConfig.geminiApiKey.trim();
    if (!keyToTest && !integrationsConfig.geminiHasKey) {
      setGeminiStatusMsg({ ok: false, text: 'Введите API-ключ Gemini' });
      return;
    }
    setTestingGemini(true);
    setGeminiStatusMsg(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testGeminiKey: true, geminiApiKey: keyToTest }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setGeminiStatusMsg({ ok: true, text: '✓ API-ключ успешно проверен и подключен!' });
        await handleSaveIntegrations({ geminiApiKey: keyToTest, geminiEnabled: true });
      } else {
        setGeminiStatusMsg({ ok: false, text: `Ошибка проверки: ${data.error || 'Неверный ключ'}` });
      }
    } catch (e: any) {
      setGeminiStatusMsg({ ok: false, text: `Сетевая ошибка: ${e?.message || 'Не удалось связаться с сервером'}` });
    } finally {
      setTestingGemini(false);
    }
  };

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    timestamp: Date.now(),
    activeWindowTitle: "Castlevania Belmont's Curse",
    detectedProcess: "Castlevania Belmont's Curse",
    runningWindows: [],
    motionDelta: 14,
    crimsonIndex: 0,
    luminance: 25,
    compositeIntensity: 14,
    brightness: 25,
    inferredVibe: 'EXPLORE',
    sensorMode: 'win32-interactive-50hz',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytPlayerReadyRef = useRef<boolean>(false);
  const pendingVideoIdRef = useRef<string>('');
  const skipTrackRef = useRef<(dir?: 1 | -1) => void>(() => {});
  const activeVibeRef = useRef<VibeStateId>('EXPLORE');
  const activeMacroModeRef = useRef<'EXPLORE' | 'COMBAT'>('EXPLORE');
  const currentTrackStartTimeRef = useRef<number>(Date.now());
  const autopilotRef = useRef<boolean>(true);
  const sensitivityRef = useRef<number>(34);
  const currentTrackRef = useRef<TrackItem>(FALLBACK_REAL_TRACKS[0]);
  const isPlayingRef = useRef<boolean>(false);
  const lastCombatSpikeRef = useRef<number>(0);
  const recentlyPlayedIdsRef = useRef<string[]>([]);
  const cutsceneStreakRef = useRef<number>(0);
  const prevDetectedProcessRef = useRef<string>('');

  // v2.0 Pro Audio Engine: Smooth Crossfade, Explore Timecode Memory, Smart Dialogue Ducking, Mini-HUD & Playlist Share
  const [crossfadeEnabled, setCrossfadeEnabled] = useState<boolean>(true);
  const crossfadeEnabledRef = useRef<boolean>(true);
  const [resumeExplorePosition, setResumeExplorePosition] = useState<boolean>(true);
  const resumeExplorePositionRef = useRef<boolean>(true);
  const savedExploreBookmarkRef = useRef<{
    track: TrackItem;
    timeSec: number;
    savedAt: number;
  } | null>(null);
  const [lastResumedTimecode, setLastResumedTimecode] = useState<string | null>(null);

  const [autoDialogueDucking, setAutoDialogueDucking] = useState<boolean>(true);
  const autoDialogueDuckingRef = useRef<boolean>(true);
  const [isDialogueDucked, setIsDialogueDucked] = useState<boolean>(false);
  const isDialogueDuckedRef = useRef<boolean>(false);

  const [isMiniHudMode, setIsMiniHudMode] = useState<boolean>(false);
  const [showImportPlaylistModal, setShowImportPlaylistModal] = useState<boolean>(false);
  const [importPlaylistCode, setImportPlaylistCode] = useState<string>('');
  const [playlistShareFeedback, setPlaylistShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    crossfadeEnabledRef.current = crossfadeEnabled;
  }, [crossfadeEnabled]);

  useEffect(() => {
    resumeExplorePositionRef.current = resumeExplorePosition;
  }, [resumeExplorePosition]);

  useEffect(() => {
    autoDialogueDuckingRef.current = autoDialogueDucking;
  }, [autoDialogueDucking]);

  // Keep refs synchronized
  useEffect(() => {
    activeVibeRef.current = activeVibe;
  }, [activeVibe]);

  useEffect(() => {
    autopilotRef.current = autopilotEnabled;
  }, [autopilotEnabled]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    activeAccountRef.current = activeAccount;
  }, [activeAccount]);

  useEffect(() => {
    activeScenePlaylistRef.current = activeScenePlaylist;
  }, [activeScenePlaylist]);

  useEffect(() => {
    useCustomPlaylistInAutopilotRef.current = useCustomPlaylistInAutopilot;
  }, [useCustomPlaylistInAutopilot]);

  // Load accounts and scene playlists from unified API
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
        if (data.activeAccount) {
          const acc: UserAccount = data.activeAccount;
          setActiveAccount(acc);
          activeAccountRef.current = acc;

          const pls: ScenePlaylist[] = acc.playlists || [];
          setScenePlaylists(pls);

          const activePl =
            pls.find((p) => p.id === acc.selectedPlaylistId) || pls[0] || null;
          setActiveScenePlaylist(activePl);
          activeScenePlaylistRef.current = activePl;

          const useCust = Boolean(acc.useCustomPlaylistInAutopilot);
          setUseCustomPlaylistInAutopilot(useCust);
          useCustomPlaylistInAutopilotRef.current = useCust;

          // Legacy bridge if userPlaylists is checked
          setUserPlaylists(
            pls.map((p) => ({
              id: p.id,
              name: p.name,
              gameTag: p.gameTag,
              tracks: Object.values(p.scenes || {}).flat(),
              createdAt: p.createdAt,
            }))
          );
          setSelectedPlaylistId(activePl?.id || null);

          // Update user taste profile
          const p: UserAccountProfile = {
            username: acc.username,
            favoriteGenres: acc.favoriteGenres || [],
            favoriteArtists: acc.favoriteArtists || [],
            customArtistsText: acc.customArtistsText || '',
            gameGenres: acc.gameGenres || [],
            driveMode: acc.driveMode || 'balanced',
            languagePref: acc.languagePref || 'all',
            vocalPref: acc.vocalPref || 'mixed',
            createdAt: acc.createdAt || Date.now(),
          };
          setAccountProfile(p);
          setDraftUsername(p.username || '');
          setDraftGenres(p.favoriteGenres || []);
          setDraftArtists(p.favoriteArtists || []);
          setDraftCustomArtists(p.customArtistsText || '');
          setDraftGameGenres(p.gameGenres || []);
          setDraftDriveMode(p.driveMode || 'balanced');
          setDraftLanguagePref(p.languagePref || 'all');
          setDraftVocalPref(p.vocalPref || 'mixed');
          preloadAllDecks(p);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Preload track decks for all scenes (EXPLORE, STEALTH, COMBAT, BOSSFIGHT)
   * so combat switching is 100% instant (< 100ms) with zero network waiting.
   */
  const preloadAllDecks = useCallback(
    async (
      profileToUse?: UserAccountProfile | null,
      modeOverride?: 'game-vibe' | 'custom',
      gameOverride?: string
    ) => {
      const activeMode = modeOverride || audioModeRef.current;
      const activeGame = gameOverride !== undefined ? gameOverride : (telemetry.detectedProcess || '');
      const prof = profileToUse !== undefined ? profileToUse : accountProfile;
      const genresList = prof?.favoriteGenres || draftGenres;
      const customExtra = (prof?.customArtistsText || draftCustomArtists)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const artistsList = [...(prof?.favoriteArtists || draftArtists), ...customExtra];
      const scenes: VibeStateId[] = [
        'EXPLORE',
        'MAJESTIC',
        'DRAMA',
        'COMBAT',
        'BOSSFIGHT',
        'STEALTH',
      ];

      await Promise.all(
        scenes.map(async (sc) => {
          try {
            const params = new URLSearchParams({
              mode: 'autopilot',
              audioMode: activeMode,
              vibe: sc,
              genres: genresList.join(','),
              artists: artistsList.join(','),
              lang: prof?.languagePref || draftLanguagePref,
              vocal: prof?.vocalPref || draftVocalPref,
              game: activeGame,
            });
            const res = await fetch(`/api/ytmusic?${params.toString()}`);
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data.tracks) && data.tracks.length > 0) {
              decksRef.current[sc] = data.tracks;
              if (sc === activeVibeRef.current) {
                setLiveStreamTracks(data.tracks);
                if (!isPlayingRef.current && data.tracks[0]) {
                  const initialTrack = data.tracks[0];
                  setCurrentTrack(initialTrack);
                  currentTrackRef.current = initialTrack;
                  setResolvedMoodQuery(
                    activeMode === 'game-vibe'
                      ? `Вайб игры: ${initialTrack.artist} — ${initialTrack.title}`
                      : `Мои вкусы: ${initialTrack.artist} — ${initialTrack.title}`
                  );
                }
              }
            }
          } catch {
            // Keep fallback deck
          }
        })
      );
    },
    [
      accountProfile,
      draftGenres,
      draftArtists,
      draftCustomArtists,
      draftLanguagePref,
      draftVocalPref,
      telemetry.detectedProcess,
    ]
  );

  const handleToggleAudioMode = async (newMode: 'game-vibe' | 'custom') => {
    setAudioMode(newMode);
    audioModeRef.current = newMode;
    setLoadingStream(true);
    await preloadAllDecks(accountProfile, newMode);
    const newDeck = decksRef.current[activeVibeRef.current] || [];
    if (newDeck.length > 0) {
      setLiveStreamTracks(newDeck);
      executePlayTrack(newDeck[0]);
    }
    setLoadingStream(false);
  };

  /**
   * Unified Audio Playback Execution:
   * Uses YouTube Official Studio Master engine for instant, uncompressed, authentic full-length tracks
   * with smooth volume crossfade, exploration timecode bookmarking, and smart dialogue ducking.
   */
  const executePlayTrack = useCallback(
    async (
      track: TrackItem,
      options?: { resumeSec?: number; skipCrossfade?: boolean }
    ) => {
      // 0. Save current EXPLORE track timecode before switching to Combat/Boss/Drama
      const prevTrack = currentTrackRef.current;
      if (
        prevTrack &&
        prevTrack.vibe === 'EXPLORE' &&
        track.vibe !== 'EXPLORE' &&
        resumeExplorePositionRef.current &&
        ytPlayerRef.current?.getCurrentTime
      ) {
        try {
          const curSec = ytPlayerRef.current.getCurrentTime();
          if (typeof curSec === 'number' && curSec >= 8) {
            savedExploreBookmarkRef.current = {
              track: prevTrack,
              timeSec: Math.floor(curSec),
              savedAt: Date.now(),
            };
          }
        } catch {
          // ignore
        }
      }

      const targetVol = isMuted
        ? 0
        : isDialogueDuckedRef.current && autoDialogueDuckingRef.current
        ? Math.max(8, Math.round(volume * 0.42))
        : volume;

      // Smooth fade-out if already playing and crossfade is enabled
      if (
        isPlayingRef.current &&
        crossfadeEnabledRef.current &&
        !options?.skipCrossfade &&
        ytPlayerRef.current?.setVolume &&
        !isMuted
      ) {
        try {
          const steps = [0.7, 0.45, 0.2, 0.08];
          for (const factor of steps) {
            ytPlayerRef.current.setVolume(Math.max(4, Math.round(targetVol * factor)));
            await new Promise((r) => setTimeout(r, 70));
          }
        } catch {
          // ignore
        }
      }

      const startSec =
        options?.resumeSec && options.resumeSec >= 5 ? Math.floor(options.resumeSec) : 0;

      currentTrackStartTimeRef.current = Date.now();
      activeMacroModeRef.current =
        track.vibe === 'COMBAT' || track.vibe === 'BOSSFIGHT' ? 'COMBAT' : 'EXPLORE';
      currentTrackRef.current = track;
      setCurrentTrack(track);
      setDurationSec(parseDurationStringToSec(track.duration));
      setProgressSec(startSec);
      setIsPlaying(true);
      isPlayingRef.current = true;

      // Sync with App State for Windows in-game audio ducking & Flight Recorder
      fetch('/api/app-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPlaying: true,
          duckingEnabled: true,
          activeVibe: track.vibe,
          currentTrack: {
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            vibe: track.vibe,
            videoId: track.videoId,
            startedAt: Date.now(),
          },
        }),
      }).catch(() => {});

      // 1. If local file on disk:
      if (
        track.previewUrl &&
        (track.previewUrl.startsWith('blob:') ||
          track.previewUrl.startsWith('file:') ||
          track.localPath)
      ) {
        if (ytPlayerRef.current?.pauseVideo) {
          ytPlayerRef.current.pauseVideo();
        }
        if (audioRef.current) {
          audioRef.current.src = track.previewUrl;
          audioRef.current.currentTime = startSec;
          audioRef.current.volume = targetVol / 100;
          audioRef.current.play().catch(() => {});
        }
        return;
      }

      // 2. Official YouTube Studio Master engine:
      let vId = track.videoId;
      if (!vId || vId.length !== 11) {
        try {
          const res = await fetch(
            `/api/yt-resolve?artist=${encodeURIComponent(
              track.artist
            )}&title=${encodeURIComponent(track.title)}`
          );
          if (res.ok) {
            const d = await res.json();
            if (d.videoId) {
              vId = d.videoId;
              track.videoId = d.videoId;
            }
          }
        } catch {
          // ignore
        }
      }

      if (vId) {
        if (audioRef.current) audioRef.current.pause();
        if (ytPlayerRef.current?.loadVideoById) {
          if (startSec > 0) {
            ytPlayerRef.current.loadVideoById({
              videoId: vId,
              startSeconds: startSec,
            });
          } else {
            ytPlayerRef.current.loadVideoById(vId);
          }

          if (crossfadeEnabledRef.current && !options?.skipCrossfade && !isMuted) {
            ytPlayerRef.current.setVolume(Math.max(6, Math.round(targetVol * 0.15)));
            ytPlayerRef.current.playVideo();
            // Smooth fade-in ramp
            const rampSteps = [0.35, 0.55, 0.78, 1.0];
            for (const factor of rampSteps) {
              await new Promise((r) => setTimeout(r, 95));
              try {
                ytPlayerRef.current?.setVolume(Math.round(targetVol * factor));
              } catch {
                // ignore
              }
            }
          } else {
            ytPlayerRef.current.setVolume(targetVol);
            ytPlayerRef.current.playVideo();
          }
        } else {
          pendingVideoIdRef.current = vId;
        }
      }
    },
    [isMuted, volume]
  );

  /**
   * Smooth Intelligent Scene Switcher:
   * Transitions between narrative/game scenes (Explore, Majestic Vista, Tragic Drama, Combat, Boss, Stealth)
   * with musical crossfade, explore timecode resumption, and strict hysteresis so songs play stably.
   */
  const switchToSceneSmoothly = useCallback(
    async (targetVibe: VibeStateId) => {
      if (activeVibeRef.current === targetVibe) return;
      activeVibeRef.current = targetVibe;
      setActiveVibe(targetVibe);
      activeMacroModeRef.current =
        targetVibe === 'COMBAT' || targetVibe === 'BOSSFIGHT' ? 'COMBAT' : 'EXPLORE';

      // 0. Check if returning to EXPLORE and we have a saved bookmark from before combat/cutscene
      if (
        targetVibe === 'EXPLORE' &&
        resumeExplorePositionRef.current &&
        savedExploreBookmarkRef.current &&
        Date.now() - savedExploreBookmarkRef.current.savedAt < 15 * 60 * 1000
      ) {
        const bm = savedExploreBookmarkRef.current;
        savedExploreBookmarkRef.current = null;
        const mm = Math.floor(bm.timeSec / 60);
        const ss = String(bm.timeSec % 60).padStart(2, '0');
        setLastResumedTimecode(`${mm}:${ss}`);
        setResolvedMoodQuery(
          `⏪ Продолжение с ${mm}:${ss} · ${bm.track.artist} — ${bm.track.title}`
        );
        executePlayTrack(bm.track, { resumeSec: bm.timeSec });
        return;
      }

      setLastResumedTimecode(null);

      // 1. Check custom user scene playlist if enabled
      if (
        useCustomPlaylistInAutopilotRef.current &&
        activeScenePlaylistRef.current
      ) {
        const pl = activeScenePlaylistRef.current;
        const bucketId: SceneBucketId =
          targetVibe === 'VICTORY' ? 'MAJESTIC' : (targetVibe as SceneBucketId);

        let pool = pl.scenes?.[bucketId] || [];

        // Intelligent fallbacks if this bucket is empty
        if (pool.length === 0) {
          if (bucketId === 'BOSSFIGHT') pool = pl.scenes?.COMBAT || [];
          else if (
            bucketId === 'MAJESTIC' ||
            bucketId === 'DRAMA' ||
            bucketId === 'STEALTH'
          ) {
            pool = pl.scenes?.EXPLORE || [];
          }
        }
        if (pool.length === 0) {
          const allTracks = Object.values(pl.scenes || {}).flat();
          if (allTracks.length > 0) pool = allTracks;
        }

        if (pool.length > 0) {
          const candidates = pool.filter(
            (t) => !recentlyPlayedIdsRef.current.includes(t.id)
          );
          const finalPool = candidates.length > 0 ? candidates : pool;
          const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];

          recentlyPlayedIdsRef.current = [
            chosen.id,
            ...recentlyPlayedIdsRef.current.filter((id) => id !== chosen.id),
          ].slice(0, 50);

          const bucketMeta = SCENE_BUCKET_CONFIGS[bucketId];
          setResolvedMoodQuery(
            `🎭 Своя подборка (${pl.name}) · [${bucketMeta?.shortLabel || bucketId}]: ${chosen.artist} — ${chosen.title}`
          );
          setLiveStreamTracks(pool);
          executePlayTrack(chosen);
          return;
        }
      }

      // 2. Select authentic procedural track with 50-track anti-repeat memory (zero duplicate song loops!)
      const deck = decksRef.current[targetVibe] || [];
      if (deck.length > 0) {
        // Exclude tracks that played recently (up to 50 tracks)
        const candidates = deck.filter((t) => !recentlyPlayedIdsRef.current.includes(t.id));
        const pool = candidates.length > 0 ? candidates : deck.filter((t) => t.id !== currentTrackRef.current?.id);
        const finalPool = pool.length > 0 ? pool : deck;
        const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];

        // Update anti-repeat history queue (remembers 50 songs)
        recentlyPlayedIdsRef.current = [chosen.id, ...recentlyPlayedIdsRef.current.filter((id) => id !== chosen.id)].slice(0, 50);

        // If candidates pool is running low, proactively fetch fresh procedural tracks in the background
        if (candidates.length <= 2) {
          preloadAllDecks(accountProfile, audioModeRef.current, telemetry.detectedProcess);
        }

        setLiveStreamTracks(deck);
        executePlayTrack(chosen);
      }
    },
    [useCustomPlaylistInAutopilot, selectedPlaylistId, userPlaylists, executePlayTrack]
  );

  /**
   * Vision Director: the Gemini scene model decides when the music no longer fits and
   * which exact tracks to play. Tracks are verified server-side against the catalogue.
   */
  const lastDirectorTsRef = useRef<number>(0);
  const directorBusyRef = useRef<boolean>(false);
  const applyDirectorRef = useRef<(d: DirectorScene) => void>(() => {});

  const applyDirectorScene = useCallback(
    async (d: DirectorScene) => {
      if (directorBusyRef.current || d.timestamp === lastDirectorTsRef.current) return;
      const nothingPlaying = !isPlayingRef.current;
      if (!d.changeMusic && !nothingPlaying) {
        lastDirectorTsRef.current = d.timestamp;
        return;
      }
      const playedSec = (Date.now() - currentTrackStartTimeRef.current) / 1000;
      // Music should breathe: never cut a track in the first 40s (next director tick retries)
      if (!nothingPlaying && playedSec < 40) return;
      if (!Array.isArray(d.picks) || d.picks.length === 0) return;

      lastDirectorTsRef.current = d.timestamp;
      directorBusyRef.current = true;

      // Check if custom scene playlist is enabled
      if (
        useCustomPlaylistInAutopilotRef.current &&
        activeScenePlaylistRef.current
      ) {
        const pl = activeScenePlaylistRef.current;
        const bucketId: SceneBucketId =
          d.vibe === 'VICTORY' ? 'MAJESTIC' : (d.vibe as SceneBucketId);
        let pool = pl.scenes?.[bucketId] || [];
        if (pool.length === 0) {
          if (bucketId === 'BOSSFIGHT') pool = pl.scenes?.COMBAT || [];
          else pool = pl.scenes?.EXPLORE || [];
        }
        if (pool.length > 0) {
          const fresh = pool.filter((t) => !recentlyPlayedIdsRef.current.includes(t.id));
          const chosen = (fresh.length > 0 ? fresh : pool)[0];
          recentlyPlayedIdsRef.current = [
            chosen.id,
            ...recentlyPlayedIdsRef.current.filter((id) => id !== chosen.id),
          ].slice(0, 50);
          activeVibeRef.current = d.vibe;
          setActiveVibe(d.vibe);
          setLiveStreamTracks(pool);
          setResolvedMoodQuery(
            `🎬 ${d.mood} · Своя подборка (${pl.name}): ${chosen.artist} — ${chosen.title}`
          );
          executePlayTrack(chosen);
          directorBusyRef.current = false;
          return;
        }
      }

      try {
        const params = new URLSearchParams({
          mode: 'director',
          vibe: d.vibe,
          picks: JSON.stringify(d.picks),
        });
        const res = await fetch(`/api/ytmusic?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.source !== 'vision-director' || !Array.isArray(data.tracks) || data.tracks.length === 0) {
          return;
        }
        const tracks: TrackItem[] = data.tracks;
        const fresh = tracks.filter((t) => !recentlyPlayedIdsRef.current.includes(t.id));
        const chosen = (fresh.length > 0 ? fresh : tracks)[0];
        recentlyPlayedIdsRef.current = [
          chosen.id,
          ...recentlyPlayedIdsRef.current.filter((id) => id !== chosen.id),
        ].slice(0, 50);
        activeVibeRef.current = d.vibe;
        setActiveVibe(d.vibe);
        setLiveStreamTracks(tracks);
        setResolvedMoodQuery(`🎬 ${d.mood}: ${chosen.artist} — ${chosen.title}`);
        executePlayTrack(chosen);
      } catch {
        // keep current track
      } finally {
        directorBusyRef.current = false;
      }
    },
    [executePlayTrack]
  );

  useEffect(() => {
    applyDirectorRef.current = (d: DirectorScene) => {
      void applyDirectorScene(d);
    };
  }, [applyDirectorScene]);

  // Initial preload on mount
  useEffect(() => {
    preloadAllDecks();
    loadIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadIntegrations]);

  // Autonomous real-time game screen & input telemetry loop (every 800ms)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (!res.ok) return;
        const raw = await res.json();
        const data: TelemetrySnapshot = {
          ...raw,
          brightness:
            typeof raw.brightness === 'number'
              ? raw.brightness
              : typeof raw.screenBrightness === 'number'
              ? raw.screenBrightness
              : 25,
        };
        setTelemetry(data);

        // Smart Dialogue Ducking: smoothly lower music volume when in-game dialogue subtitles are active
        const hasActiveSubtitles = Boolean(
          (data.dialogueText && data.dialogueText.trim().length >= 4) ||
            (data.director?.onScreenText && data.director.onScreenText.trim().length >= 4)
        );
        if (hasActiveSubtitles !== isDialogueDuckedRef.current) {
          isDialogueDuckedRef.current = hasActiveSubtitles;
          setIsDialogueDucked(hasActiveSubtitles);
        }

        // Auto Game Switch: detect when player switches active game and dynamically reload matching atmosphere decks
        if (data.detectedProcess && data.detectedProcess !== prevDetectedProcessRef.current) {
          const isInitial = prevDetectedProcessRef.current === '';
          prevDetectedProcessRef.current = data.detectedProcess;
          if (!isInitial) {
            console.log(`[GameVibe] Active game changed to: ${data.detectedProcess}. Re-loading atmosphere...`);
            preloadAllDecks(accountProfile, audioModeRef.current, data.detectedProcess).then(() => {
              const newDeck = decksRef.current[activeVibeRef.current] || [];
              if (newDeck.length > 0) {
                setLiveStreamTracks(newDeck);
                executePlayTrack(newDeck[0]);
              }
            });
          }
        }

        if (
          autopilotRef.current &&
          data.director &&
          Array.isArray(data.director.picks) &&
          data.director.picks.length > 0 &&
          data.director.changeMusic
        ) {
          // Vision Director has explicit bespoke picks
          applyDirectorRef.current(data.director);
        } else if (autopilotRef.current) {
          const now = Date.now();
          const trackPlayDurationSec =
            (now - currentTrackStartTimeRef.current) / 1000;
          const currentVibe = activeVibeRef.current;
          const targetVibe: VibeStateId = data.inferredVibe || 'EXPLORE';

          const isActivelyFighting =
            targetVibe === 'COMBAT' ||
            targetVibe === 'BOSSFIGHT' ||
            data.motionDelta >= 48;

          if (isActivelyFighting) {
            lastCombatSpikeRef.current = now;
          }

          // Combat session stays active during brief lulls for 14 seconds after the last attack blow
          const inCombatSession =
            isActivelyFighting || now - lastCombatSpikeRef.current < 14000;

          if (inCombatSession) {
            // Player is in battle or Boss Fight!
            if (targetVibe === 'BOSSFIGHT' && currentVibe !== 'BOSSFIGHT') {
              switchToSceneSmoothly('BOSSFIGHT');
            } else if (currentVibe !== 'COMBAT' && currentVibe !== 'BOSSFIGHT') {
              // Entering battle: immediately switch to battle theme!
              switchToSceneSmoothly('COMBAT');
            }
            // CRITICAL: While in battle, keep the current battle song playing without skipping!
          } else {
            // PEACEFUL, CUTSCENE, OR NEW LOCATION DISCOVERY
            if (currentVibe === 'COMBAT' || currentVibe === 'BOSSFIGHT') {
              // Returning from battle to peace:
              // Only switch back once the battle song has played for at least 45 seconds!
              if (trackPlayDurationSec >= 45) {
                switchToSceneSmoothly(targetVibe);
              }
            } else if (data.isCutscene) {
              cutsceneStreakRef.current += 1;
              // Cutscene dialogue (OCR or sustained letterbox): transition after 12s of previous song
              const minCutsceneDuration = data.dialogueText ? 10 : 16;
              if (currentVibe !== targetVibe && trackPlayDurationSec >= minCutsceneDuration) {
                switchToSceneSmoothly(targetVibe);
              }
            } else if (data.isNewLocation) {
              cutsceneStreakRef.current = 0;
              // Entering new location (panoramic vista or grim dungeon): adapt music after 12s
              if (currentVibe !== targetVibe && trackPlayDurationSec >= 12) {
                switchToSceneSmoothly(targetVibe);
              }
            } else {
              cutsceneStreakRef.current = 0;
              if (currentVibe !== targetVibe && trackPlayDurationSec >= 60) {
                // Regular subtle roaming scene shift
                switchToSceneSmoothly(targetVibe);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }, 800);

    return () => clearInterval(interval);
  }, [switchToSceneSmoothly]);

  // YouTube IFrame API bootstrap & background player initialization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initYT = () => {
      const win = window as unknown as {
        YT?: { Player: new (id: string, opts: unknown) => unknown };
      };
      if (!win.YT || !win.YT.Player) return;
      if (ytPlayerRef.current) return;
      try {
        ytPlayerRef.current = new win.YT.Player('gv-yt-player', {
          height: '100%',
          width: '100%',
          videoId: currentTrackRef.current?.videoId || 'Wj7lL6eDOqc',
          playerVars: {
            autoplay: 1,
            controls: 1,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event: any) => {
              ytPlayerReadyRef.current = true;
              try {
                event.target.setVolume(isMuted ? 0 : volume);
                if (pendingVideoIdRef.current) {
                  event.target.loadVideoById(pendingVideoIdRef.current);
                  pendingVideoIdRef.current = '';
                  event.target.playVideo();
                }
              } catch {
                // ignore
              }
            },
            onStateChange: (event: { data: number }) => {
              // 0 = ENDED, 1 = PLAYING, 2 = PAUSED
              if (event.data === 0) {
                skipTrackRef.current(1);
              } else if (event.data === 1) {
                setIsPlaying(true);
                isPlayingRef.current = true;
              } else if (event.data === 2) {
                setIsPlaying(false);
                isPlayingRef.current = false;
              }
            },
          },
        });
      } catch {
        // ignore
      }
    };

    const win = window as unknown as {
      YT?: { Player: unknown };
      onYouTubeIframeAPIReady?: () => void;
    };

    if (win.YT && win.YT.Player) {
      initYT();
    } else {
      win.onYouTubeIframeAPIReady = initYT;
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }
  }, []);

  // Track progress polling (every 250ms)
  useEffect(() => {
    const timer = setInterval(() => {
      if (isPlayingRef.current && ytPlayerRef.current?.getCurrentTime) {
        try {
          const cur = ytPlayerRef.current.getCurrentTime();
          const dur = ytPlayerRef.current.getDuration();
          if (typeof cur === 'number' && Number.isFinite(cur) && cur >= 0) {
            setProgressSec(cur);
          }
          if (typeof dur === 'number' && Number.isFinite(dur) && dur > 10) {
            setDurationSec(dur);
          }
        } catch {
          // ignore
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Synchronize master volume, mute & smart dialogue ducking across YouTube player and audio fallback
  useEffect(() => {
    const baseVol = isMuted ? 0 : volume;
    const effectiveVol =
      isDialogueDucked && autoDialogueDucking ? Math.max(8, Math.round(baseVol * 0.42)) : baseVol;
    if (ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(effectiveVol);
    }
    if (audioRef.current) {
      audioRef.current.volume = effectiveVol / 100;
    }
  }, [volume, isMuted, isDialogueDucked, autoDialogueDucking]);

  // Global Hotkey & Desktop Mini-HUD listener (Alt+M toggles Ultra-Mini In-Game HUD)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь')) {
        e.preventDefault();
        setIsMiniHudMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const w = window as unknown as {
      gamevibeDesktop?: {
        onMiniHudChange?: (cb: (isMini: boolean) => void) => void;
        onGlobalHotkeyVibe?: (cb: (vibeId: VibeStateId) => void) => void;
      };
    };
    if (w.gamevibeDesktop?.onMiniHudChange) {
      w.gamevibeDesktop.onMiniHudChange((isMini) => {
        setIsMiniHudMode(Boolean(isMini));
      });
    }
    if (w.gamevibeDesktop?.onGlobalHotkeyVibe) {
      w.gamevibeDesktop.onGlobalHotkeyVibe((vibeId) => {
        switchToSceneSmoothly(vibeId);
      });
    }

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [switchToSceneSmoothly]);

  const handleSaveAccountProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const profilePayload: UserAccountProfile = {
        username: draftUsername.trim() || 'Игрок',
        favoriteGenres: draftGenres,
        favoriteArtists: draftArtists,
        customArtistsText: draftCustomArtists.trim(),
        gameGenres: draftGameGenres,
        driveMode: draftDriveMode,
        languagePref: draftLanguagePref,
        vocalPref: draftVocalPref,
        createdAt: Date.now(),
      };

      // Adjust sensor sensitivity automatically based on user's chosen drive mode
      if (draftDriveMode === 'immersion') setSensitivity(54);
      else if (draftDriveMode === 'high-drive') setSensitivity(28);
      else setSensitivity(42);

      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_ACCOUNT_PROFILE',
          profile: profilePayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const saved = data.accountProfile || profilePayload;
        setAccountProfile(saved);
        setActiveSection('autopilot');
        await preloadAllDecks(saved);
        const deck = decksRef.current[activeVibeRef.current] || [];
        if (deck.length > 0) {
          executePlayTrack(deck[0]);
        }
      }
    } catch {
      // ignore
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleItemInList = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setActiveSection('search');
    try {
      const res = await fetch(
        `/api/ytmusic?mode=search&q=${encodeURIComponent(q)}&vibe=${activeVibe}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data.tracks) ? data.tracks : []);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  // Multi-Account Profile Management
  const handleSwitchAccount = async (accountId: string) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SWITCH_ACCOUNT', accountId }),
      });
      if (res.ok) {
        await loadAccounts();
        setShowAccountModal(false);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = newAccountUsername.trim();
    if (!uname) return;
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_ACCOUNT',
          username: uname,
          avatarColor: newAccountColor || '#6E1D2F',
        }),
      });
      if (res.ok) {
        setNewAccountUsername('');
        setShowCreateAccountModal(false);
        setShowAccountModal(false);
        await loadAccounts();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (accounts.length <= 1) return;
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_ACCOUNT', accountId }),
      });
      if (res.ok) {
        await loadAccounts();
      }
    } catch {
      // ignore
    }
  };

  const handleToggleCustomPlaylistAutopilot = async () => {
    if (!activeAccount) return;
    const nextVal = !useCustomPlaylistInAutopilot;
    setUseCustomPlaylistInAutopilot(nextVal);
    useCustomPlaylistInAutopilotRef.current = nextVal;
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PROFILE',
          accountId: activeAccount.id,
          useCustomPlaylistInAutopilot: nextVal,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleCreateScenePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name || !activeAccount) return;
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_PLAYLIST',
          accountId: activeAccount.id,
          name,
          gameTag: newPlaylistGameTag.trim() || telemetry.detectedProcess || 'Для любых игр',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewPlaylistName('');
        setNewPlaylistGameTag('');
        setShowCreatePlaylistModal(false);
        setCreatingPlaylist(false);
        if (data.playlist) {
          setScenePlaylists(data.account?.playlists || [...scenePlaylists, data.playlist]);
          setActiveScenePlaylist(data.playlist);
          activeScenePlaylistRef.current = data.playlist;
          setSelectedPlaylistId(data.playlist.id);
          setActiveSection('user-playlist');
        }
        await loadAccounts();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteScenePlaylist = async (playlistId: string) => {
    if (!activeAccount) return;
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_PLAYLIST',
          accountId: activeAccount.id,
          playlistId,
        }),
      });
      if (res.ok) {
        const remaining = scenePlaylists.filter((p) => p.id !== playlistId);
        setScenePlaylists(remaining);
        if (activeScenePlaylist?.id === playlistId) {
          const nextPl = remaining[0] || null;
          setActiveScenePlaylist(nextPl);
          activeScenePlaylistRef.current = nextPl;
          setSelectedPlaylistId(nextPl?.id || null);
          if (!nextPl) setActiveSection('autopilot');
        }
        await loadAccounts();
      }
    } catch {
      // ignore
    }
  };

  const handleAddTrackToScene = async (
    scene: SceneBucketId,
    track: TrackItem,
    playlistId?: string
  ) => {
    const plId = playlistId || activeScenePlaylist?.id;
    if (!activeAccount || !plId) return;

    setActiveScenePlaylist((prev) => {
      if (!prev || prev.id !== plId) return prev;
      const currentList = prev.scenes[scene] || [];
      if (currentList.some((t) => t.id === track.id || (track.videoId && t.videoId === track.videoId))) {
        return prev;
      }
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [scene]: [...currentList, track],
        },
      };
    });

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_TRACK_TO_SCENE',
          accountId: activeAccount.id,
          playlistId: plId,
          scene,
          track,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.playlist) {
          setActiveScenePlaylist(data.playlist);
          activeScenePlaylistRef.current = data.playlist;
        }
        setSceneActionFeedback({
          bucket: scene,
          msg: `✓ Трек «${track.title}» добавлен в сцену!`,
          ok: true,
        });
        setTimeout(() => setSceneActionFeedback(null), 3000);
      }
    } catch {
      // ignore
    }
  };

  const handleRemoveTrackFromScene = async (
    scene: SceneBucketId,
    trackId: string,
    playlistId?: string
  ) => {
    const plId = playlistId || activeScenePlaylist?.id;
    if (!activeAccount || !plId) return;

    setActiveScenePlaylist((prev) => {
      if (!prev || prev.id !== plId) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [scene]: (prev.scenes[scene] || []).filter((t) => t.id !== trackId),
        },
      };
    });

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REMOVE_TRACK_FROM_SCENE',
          accountId: activeAccount.id,
          playlistId: plId,
          scene,
          trackId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.playlist) {
          setActiveScenePlaylist(data.playlist);
          activeScenePlaylistRef.current = data.playlist;
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSearchSceneTracks = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = sceneSearchQuery.trim();
    if (!q) return;
    setIsSearchingSceneTrack(true);
    try {
      const res = await fetch(
        `/api/ytmusic?mode=search&q=${encodeURIComponent(q)}&vibe=${selectedSceneBucket}`
      );
      if (res.ok) {
        const data = await res.json();
        setSceneSearchResults(Array.isArray(data.tracks) ? data.tracks : []);
      }
    } catch {
      // ignore
    } finally {
      setIsSearchingSceneTrack(false);
    }
  };

  const handleAddDirectUrlToScene = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = sceneDirectYtUrl.trim();
    if (!raw || !activeScenePlaylist) return;
    setIsResolvingUrl(true);
    try {
      let vId = '';
      const match = raw.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/
      );
      if (match) {
        vId = match[1];
      }
      const res = await fetch(
        `/api/yt-resolve?url=${encodeURIComponent(raw)}&videoId=${vId}`
      );
      if (res.ok) {
        const data = await res.json();
        const newTrack: TrackItem = {
          id: `yt-${vId || Date.now()}`,
          videoId: vId || data.videoId || '',
          title: data.title || 'YouTube Audio Track',
          artist: data.artist || 'YouTube Creator',
          album: activeScenePlaylist.name,
          duration: data.duration || '03:45',
          thumbnail:
            data.thumbnail ||
            (vId
              ? `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`
              : FALLBACK_REAL_TRACKS[0].thumbnail),
          previewUrl: '',
          vibe: selectedSceneBucket,
          genreTag: 'User YouTube',
        };
        await handleAddTrackToScene(selectedSceneBucket, newTrack);
        setSceneDirectYtUrl('');
      }
    } catch {
      // ignore
    } finally {
      setIsResolvingUrl(false);
    }
  };

  // Compatibility aliases for existing Search view buttons
  const handleCreateUserPlaylist = handleCreateScenePlaylist;
  const handleDeleteUserPlaylist = handleDeleteScenePlaylist;
  const handleAddTrackToUserPlaylist = async (track: TrackItem) => {
    await handleAddTrackToScene(selectedSceneBucket, track);
  };
  const handleRemoveTrackFromUserPlaylist = async (playlistId: string, trackId: string) => {
    await handleRemoveTrackFromScene(selectedSceneBucket, trackId, playlistId);
  };

  const scanLocalFolder = async () => {
    setScanningLocal(true);
    try {
      const res = await fetch(`/api/local-music?dir=${encodeURIComponent(localFolderPath)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tracks)) {
          const mapped: TrackItem[] = data.tracks.map(
            (f: { id: string; title: string; artist: string; path: string }, idx: number) => ({
              id: f.id || `local-${idx}`,
              videoId: '',
              title: f.title,
              artist: f.artist || 'Локальный файл ПК',
              album: localFolderPath,
              duration: '03:45',
              thumbnail: FALLBACK_REAL_TRACKS[0].thumbnail,
              previewUrl: `/api/local-music?stream=${encodeURIComponent(f.path)}`,
              vibe: 'EXPLORE',
              genreTag: 'Local Audio',
            })
          );
          setLocalTracks(mapped);
        }
      }
    } catch {
      // ignore
    } finally {
      setScanningLocal(false);
    }
  };

  const playSpecificTrack = (track: TrackItem) => {
    executePlayTrack(track);
  };

  const skipTrack = useCallback(
    (dir: 1 | -1 = 1) => {
      const activePool =
        activeSection === 'search' && searchResults.length > 0
          ? searchResults
          : liveStreamTracks;
      if (activePool.length === 0) return;

      const idx = activePool.findIndex((t) => t.id === currentTrackRef.current?.id);
      const nextIdx = idx + dir;

      // Continuous AI Reinforcement: Record listen retention or fast skip
      const playDuration = (Date.now() - currentTrackStartTimeRef.current) / 1000;
      if (currentTrackRef.current) {
        const isFastSkip = playDuration < 20;
        const isCompletion = playDuration > 120;
        fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'RECORD_AI_FEEDBACK',
            artist: currentTrackRef.current.artist,
            genre: currentTrackRef.current.genreTag,
            game: telemetry.detectedProcess,
            isCompletion,
            isFastSkip,
          }),
        }).catch(() => {});
      }

      if (nextIdx >= activePool.length && activeSection === 'autopilot') {
        const deck = decksRef.current[activeVibeRef.current] || [];
        if (deck.length > 0) {
          const candidates = deck.filter((t) => !recentlyPlayedIdsRef.current.includes(t.id));
          const pool = candidates.length > 0 ? candidates : deck;
          const chosen = pool[Math.floor(Math.random() * pool.length)];
          recentlyPlayedIdsRef.current = [chosen.id, ...recentlyPlayedIdsRef.current.filter((id) => id !== chosen.id)].slice(0, 50);

          if (candidates.length <= 2) {
            preloadAllDecks(accountProfile, audioModeRef.current, telemetry.detectedProcess);
          }

          executePlayTrack(chosen);
        }
        return;
      }

      const wrappedIdx = (nextIdx + activePool.length) % activePool.length;
      const nextTrack = activePool[wrappedIdx];
      recentlyPlayedIdsRef.current = [nextTrack.id, ...recentlyPlayedIdsRef.current.filter((id) => id !== nextTrack.id)].slice(0, 8);
      executePlayTrack(nextTrack);

      if (systemMediaSync) {
        fetch('/api/system-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: dir === 1 ? 'next' : 'prev' }),
        }).catch(() => {});
      }
    },
    [
      activeSection,
      searchResults,
      liveStreamTracks,
      executePlayTrack,
      systemMediaSync,
    ]
  );

  useEffect(() => {
    skipTrackRef.current = skipTrack;
  }, [skipTrack]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      isPlayingRef.current = next;

      fetch('/api/app-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPlaying: next,
          duckingEnabled: true,
          activeVibe: activeVibeRef.current,
        }),
      }).catch(() => {});

      if (next) {
        if (ytPlayerRef.current?.playVideo) {
          const state = ytPlayerRef.current.getPlayerState ? ytPlayerRef.current.getPlayerState() : -1;
          if (state === -1 || state === 5) {
            if (currentTrackRef.current) {
              executePlayTrack(currentTrackRef.current);
            }
          } else {
            ytPlayerRef.current.playVideo();
          }
        } else if (currentTrackRef.current) {
          executePlayTrack(currentTrackRef.current);
        } else if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      } else {
        if (ytPlayerRef.current?.pauseVideo) {
          ytPlayerRef.current.pauseVideo();
        }
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
      return next;
    });
  }, [executePlayTrack]);

  const handleSeek = (newSec: number) => {
    setProgressSec(newSec);
    if (ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(newSec, true);
    }
    if (audioRef.current) {
      audioRef.current.currentTime = newSec;
    }
  };

  const toggleAlwaysOnTop = () => {
    const nextState = !alwaysOnTop;
    setAlwaysOnTop(nextState);
    const w = window as unknown as {
      chrome?: { webview?: { postMessage: (msg: string) => void } };
      gamevibeDesktop?: { toggleAlwaysOnTop?: () => Promise<boolean> };
    };
    if (w.gamevibeDesktop?.toggleAlwaysOnTop) {
      w.gamevibeDesktop.toggleAlwaysOnTop().catch(() => {});
    }
    if (w.chrome?.webview) {
      w.chrome.webview.postMessage(nextState ? 'SET_TOPMOST:1' : 'SET_TOPMOST:0');
    }
  };

  const toggleMiniHud = () => {
    const next = !isMiniHudMode;
    setIsMiniHudMode(next);
    const w = window as unknown as {
      gamevibeDesktop?: { toggleMiniHud?: (force?: boolean) => Promise<boolean> };
    };
    if (w.gamevibeDesktop?.toggleMiniHud) {
      w.gamevibeDesktop.toggleMiniHud(next).catch(() => {});
    }
  };

  const handleExportScenePlaylist = async (mode: 'code' | 'file') => {
    if (!activeScenePlaylist) return;
    const payload = {
      name: activeScenePlaylist.name,
      gameTag: activeScenePlaylist.gameTag,
      description: activeScenePlaylist.description,
      scenes: activeScenePlaylist.scenes,
    };
    const jsonStr = JSON.stringify(payload, null, 2);

    if (mode === 'code') {
      try {
        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const shareCode = `GV2:${b64}`;
        await navigator.clipboard.writeText(shareCode);
        setPlaylistShareFeedback('✓ Код подборки скопирован в буфер обмена!');
        setTimeout(() => setPlaylistShareFeedback(null), 3500);
      } catch {
        setPlaylistShareFeedback('Скопируйте JSON вручную через экспорт файла');
        setTimeout(() => setPlaylistShareFeedback(null), 3500);
      }
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (activeScenePlaylist.name || 'gamevibe-playlist')
        .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')
        .slice(0, 40);
      a.download = `${safeName}.gamevibe.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPlaylistShareFeedback('✓ Файл подборки (.gamevibe.json) скачан!');
      setTimeout(() => setPlaylistShareFeedback(null), 3500);
    }
  };

  const submitImportPlaylistPayload = async (rawPayload: string) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'IMPORT_PLAYLIST',
          playlistData: rawPayload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.playlist) {
        await loadAccounts();
        setActiveScenePlaylist(data.playlist);
        activeScenePlaylistRef.current = data.playlist;
        setSelectedPlaylistId(data.playlist.id);
        setUseCustomPlaylistInAutopilot(true);
        useCustomPlaylistInAutopilotRef.current = true;
        setShowImportPlaylistModal(false);
        setImportPlaylistCode('');
        setPlaylistShareFeedback(`✓ Подборка «${data.playlist.name}» успешно импортирована!`);
        setTimeout(() => setPlaylistShareFeedback(null), 4000);
      } else {
        setPlaylistShareFeedback(`Ошибка: ${data.error || 'Некорректный код или JSON'}`);
        setTimeout(() => setPlaylistShareFeedback(null), 4000);
      }
    } catch {
      setPlaylistShareFeedback('Ошибка при чтении кода подборки');
      setTimeout(() => setPlaylistShareFeedback(null), 4000);
    }
  };

  const handleImportScenePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPlaylistCode.trim()) return;
    await submitImportPlaylistPayload(importPlaylistCode.trim());
  };

  const handleImportPlaylistFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await submitImportPlaylistPayload(text);
    } catch {
      setPlaylistShareFeedback('Не удалось прочитать JSON-файл');
    }
  };

  const openExternalMusic = (platform: 'ytmusic' | 'spotify' | 'yandex') => {
    const q = encodeURIComponent(`${currentTrack.artist} ${currentTrack.title}`);
    const urls = {
      ytmusic: `https://music.youtube.com/search?q=${q}`,
      spotify: `https://open.spotify.com/search/${q}`,
      yandex: `https://music.yandex.ru/search?text=${q}`,
    };
    window.open(urls[platform], '_blank', 'noopener,noreferrer');
  };

  const currentSceneMeta = VIBE_STATES[activeVibe];
  const activeUserPlaylist = userPlaylists.find((p) => p.id === selectedPlaylistId) || null;

  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${m}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="h-dvh w-full bg-[#080809] text-[#EDE9E8] flex flex-col overflow-hidden select-none border border-[#241E23]">
      {/* NATIVE DESKTOP APPLICATION TITLEBAR (Frameless Drag Region + Window Controls) */}
      <div
        className="h-[34px] shrink-0 bg-[#050507] border-b border-[#1A161A] px-3 flex items-center justify-between gap-2 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/logo-icon.svg"
            alt="GameMusick"
            className="w-4 h-4 rounded-sm shrink-0"
          />
          <span className="text-[11px] font-bold tracking-wider uppercase text-[#EDE9E8] whitespace-nowrap">
            GameMusick Desktop <span className="text-[#E5384F] font-mono">v2.0</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#121014] border border-[#241F25] text-[10px] text-[#A8A0A4] truncate max-w-[260px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse shrink-0" />
            <span className="truncate">Сенсор: {telemetry.detectedProcess}</span>
          </span>
          <span className="hidden md:inline text-[10px] font-mono text-[#6E666A] whitespace-nowrap">
            Хоткеи: Alt+1..5 (Сцены) · Alt+M (Мини-HUD) · Alt+P (Поверх игры)
          </span>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={() => {
              const w = window as unknown as {
                gamevibeDesktop?: { hideToTray?: () => void; minimizeWindow?: () => void };
              };
              if (w.gamevibeDesktop?.hideToTray) w.gamevibeDesktop.hideToTray();
              else if (w.gamevibeDesktop?.minimizeWindow) w.gamevibeDesktop.minimizeWindow();
            }}
            className="px-2 py-1 rounded text-[10px] font-medium text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#19161B] transition"
            title="Свернуть в системный трей (музыка продолжит играть в фоне)"
          >
            В трей
          </button>

          <button
            type="button"
            onClick={() => {
              const w = window as unknown as {
                gamevibeDesktop?: { minimizeWindow?: () => void };
              };
              w.gamevibeDesktop?.minimizeWindow?.();
            }}
            className="w-7 h-6 rounded flex items-center justify-center text-xs text-[#8C8482] hover:text-white hover:bg-[#19161B] transition"
            title="Свернуть окно"
          >
            —
          </button>

          <button
            type="button"
            onClick={() => {
              const w = window as unknown as {
                gamevibeDesktop?: { maximizeWindow?: () => void };
              };
              w.gamevibeDesktop?.maximizeWindow?.();
            }}
            className="w-7 h-6 rounded flex items-center justify-center text-[11px] text-[#8C8482] hover:text-white hover:bg-[#19161B] transition"
            title="Развернуть на весь экран"
          >
            □
          </button>

          <button
            type="button"
            onClick={() => {
              const w = window as unknown as {
                gamevibeDesktop?: { closeWindow?: () => void };
              };
              if (w.gamevibeDesktop?.closeWindow) w.gamevibeDesktop.closeWindow();
              else window.close();
            }}
            className="w-7 h-6 rounded flex items-center justify-center text-xs text-[#8C8482] hover:text-white hover:bg-[#8E253D] transition"
            title="Закрыть приложение"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Full-Length HTML5 Audio Stream Engine */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgressSec(el.currentTime || 0);
          if (el.duration && Number.isFinite(el.duration) && el.duration > 35) {
            setDurationSec(el.duration);
          }
        }}
        onEnded={() => skipTrack(1)}
      />

      {/* MAIN DESKTOP WORKSPACE (Sidebar + Center View) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-h-0 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="w-full lg:w-[285px] shrink-0 flex flex-col gap-2 min-h-0">
          {/* App Brand & Main Nav */}
          <div className="bg-[#111012] border border-[#1E1B1D] rounded-lg p-3 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-[#1E1B1D]">
              <div className="flex items-center gap-2.5">
                <img src="/logo-icon.svg" alt="GameMusick" className="w-6 h-6 rounded-md" />
                <span className="text-sm font-semibold tracking-wide text-[#EDE9E8]">
                  Game<span className="text-[#E5384F]">Musick</span>
                </span>
              </div>
              <span
                className="text-[11px] font-mono text-[#8C8482] truncate max-w-[110px] sm:max-w-[140px] text-right ml-2 px-2 py-0.5 rounded bg-[#171518] border border-[#232023]"
                title={telemetry.detectedProcess}
              >
                {telemetry.detectedProcess}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
              <button
                onClick={() => setActiveSection('autopilot')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                  activeSection === 'autopilot'
                    ? 'bg-[#1D1619] text-[#EDE9E8] border border-[#441924]'
                    : 'text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#171518]'
                }`}
              >
                <Radio className="w-4 h-4 text-[#B84A62] shrink-0" />
                <span>Авторежим</span>
              </button>

              <button
                onClick={() => {
                  setActiveSection('user-playlist');
                  if (!activeScenePlaylist && scenePlaylists.length > 0) {
                    setActiveScenePlaylist(scenePlaylists[0]);
                  }
                }}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-medium transition ${
                  activeSection === 'user-playlist'
                    ? 'bg-[#1D1619] text-[#EDE9E8] border border-[#441924]'
                    : 'text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#171518]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ListMusic className="w-4 h-4 text-[#B84A62] shrink-0" />
                  <span>Мои подборки</span>
                </div>
                {scenePlaylists.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-[#1B181C] text-[10px] text-[#A8A0A4]">
                    {scenePlaylists.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSection('account')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-medium transition ${
                  activeSection === 'account'
                    ? 'bg-[#1D1619] text-[#EDE9E8] border border-[#441924]'
                    : 'text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#171518]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-[#B84A62] shrink-0" />
                  <span>
                    {accountProfile
                      ? `Аккаунт: ${accountProfile.username}`
                      : 'Аккаунт и вкусы'}
                  </span>
                </div>
                {!accountProfile && (
                  <span className="px-1.5 py-0.5 rounded bg-[#6E1D2F] text-[10px] text-white">
                    Настроить
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveSection('search');
                  searchInputRef.current?.focus();
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                  activeSection === 'search'
                    ? 'bg-[#1D1619] text-[#EDE9E8] border border-[#441924]'
                    : 'text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#171518]'
                }`}
              >
                <Search className="w-4 h-4 text-[#B84A62] shrink-0" />
                <span>Поиск музыки</span>
              </button>

              <button
                onClick={() => {
                  setActiveSection('local');
                  if (localTracks.length === 0) scanLocalFolder();
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                  activeSection === 'local'
                    ? 'bg-[#1D1619] text-[#EDE9E8] border border-[#441924]'
                    : 'text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#171518]'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-[#B84A62] shrink-0" />
                <span>Музыка с ПК</span>
              </button>

              <button
                onClick={() => setActiveSection('integrations')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                  activeSection === 'integrations'
                    ? 'bg-[#1D1619] text-[#EDE9E8] border border-[#441924]'
                    : 'text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#171518]'
                }`}
              >
                <Sliders className="w-4 h-4 text-[#B84A62] shrink-0" />
                <span>Связь с плеерами</span>
              </button>
            </div>
          </div>

          {/* Active Studio Stream Canvas (Permanent YouTube Video Player: full video on desktop, compact background stream on mobile) */}
          <div className="hidden lg:flex bg-[#111012] border border-[#1E1B1D] rounded-lg p-2.5 flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between text-[11px] px-1">
              <span className="flex items-center gap-1.5 font-medium text-[#D47A8D]">
                <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#E53935] animate-pulse' : 'bg-[#555054]'}`} />
                Студийный поток
              </span>
              <span className="font-mono text-[10px] text-[#7A7270]">Original Master</span>
            </div>
            <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black border border-[#262225] shadow-inner">
              <div id="gv-yt-player" className="w-full h-full object-cover" />
            </div>
            <div className="px-1 flex items-center justify-between text-[11px]">
              <span className="font-medium text-[#EDE9E8] truncate max-w-[170px]" title={currentTrack?.title}>
                {currentTrack?.title}
              </span>
              <span className="text-[#8C8482] truncate max-w-[80px]" title={currentTrack?.artist}>
                {currentTrack?.artist}
              </span>
            </div>
          </div>

          {/* User Scene-Based Playlists Library + Autonomous Game Telemetry */}
          <div className="hidden lg:flex flex-1 bg-[#111012] border border-[#1E1B1D] rounded-lg p-3.5 flex-col justify-between min-h-0 overflow-y-auto">
            <div className="space-y-2.5">
              <div className="px-1 flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C8482] block">
                    Подборки со сценами
                  </span>
                  <span className="text-[10px] text-[#6A6265]">
                    {activeAccount ? activeAccount.username : 'Аккаунт'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowImportPlaylistModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-[11px] text-[#EDE9E8] transition"
                    title="Импортировать чужую подборку по коду или JSON"
                  >
                    <Upload className="w-3 h-3 text-[#B84A62]" />
                    <span>Импорт</span>
                  </button>
                  <button
                    onClick={() => setShowCreatePlaylistModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-[11px] text-[#EDE9E8] transition"
                    title="Создать новую подборку со сценами"
                  >
                    <Plus className="w-3 h-3 text-[#B84A62]" />
                    <span>Создать</span>
                  </button>
                </div>
              </div>

              {scenePlaylists.length === 0 ? (
                <div className="p-3.5 rounded-md bg-[#0D0C0E] border border-[#1B181B] text-xs text-[#8C8482] leading-relaxed">
                  Здесь сохраняются подборки, разделенные по ситуациям: спокойные моменты, драка, босс, драма.
                  <button
                    onClick={() => setShowCreatePlaylistModal(true)}
                    className="mt-2.5 w-full py-1.5 rounded bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-xs text-[#EDE9E8] transition text-center font-medium block"
                  >
                    + Создать первую подборку
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {scenePlaylists.map((pl) => {
                    const active =
                      activeSection === 'user-playlist' && activeScenePlaylist?.id === pl.id;
                    const totalTracks = Object.values(pl.scenes || {}).reduce(
                      (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
                      0
                    );
                    const isAutoActive =
                      useCustomPlaylistInAutopilot && activeScenePlaylist?.id === pl.id;

                    return (
                      <div
                        key={pl.id}
                        onClick={() => {
                          setActiveScenePlaylist(pl);
                          activeScenePlaylistRef.current = pl;
                          setSelectedPlaylistId(pl.id);
                          setActiveSection('user-playlist');
                        }}
                        className={`group flex items-center justify-between gap-2 p-2 rounded-md cursor-pointer transition border ${
                          active
                            ? 'bg-[#1C1417] border-[#4A1C28]'
                            : 'hover:bg-[#171518] border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded bg-[#1B181C] border border-[#2A2529] flex items-center justify-center shrink-0">
                            <ListMusic className="w-4 h-4 text-[#B84A62]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[#EDE9E8] flex items-center gap-1.5 truncate">
                              <span className="truncate">{pl.name}</span>
                              {isAutoActive && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse shrink-0"
                                  title="Активна в Авторежиме ИИ"
                                />
                              )}
                            </div>
                            <div className="text-[11px] text-[#8C8482] truncate">
                              {pl.gameTag || 'Любая игра'} · {totalTracks} трек.
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScenePlaylist(pl.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#8C8482] hover:text-[#EA7B93] transition"
                          title="Удалить подборку"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Autonomous Game Telemetry Monitor */}
            <div className="mt-4 pt-3 border-t border-[#1E1B1D] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-[#B84A62]" />
                  <span className="text-xs font-medium text-[#EDE9E8]">Автономный сенсор</span>
                </div>
                <button
                  onClick={() => setAutopilotEnabled((v) => !v)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    autopilotEnabled
                      ? 'bg-[#6E1D2F] text-white'
                      : 'bg-[#1B191C] text-[#8C8482] border border-[#2A2629]'
                  }`}
                >
                  {autopilotEnabled ? 'Авторежим ВКЛ' : 'На паузе'}
                </button>
              </div>

              <div className="bg-[#0B0A0C] border border-[#1E1B1D] rounded-md p-2.5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8C8482]">Сцена в игре:</span>
                  <span className="font-semibold text-[#D47A8D]">
                    {telemetry.sceneLabel || currentSceneMeta.shortLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8C8482]">Звук игры:</span>
                  <span className={`font-mono text-[11px] ${telemetry.gameAudioDucked ? 'text-[#82C341]' : 'text-[#8C8482]'}`}>
                    {telemetry.gameAudioDucked ? 'Приглушен (18%)' : 'Обычный (100%)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8C8482]">Яркость кадра:</span>
                  <span className="font-mono text-[#EDE9E8]">{telemetry.brightness}%</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#8C8482]">Динамика в игре</span>
                    <span className="font-mono text-[#EDE9E8]">{telemetry.motionDelta}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1E1B1D] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8E2940] transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(4, telemetry.motionDelta))}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#8C8482]">Чувствительность к экшену</span>
                    <span className="font-mono text-[#8C8482]">{sensitivity}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={80}
                    value={sensitivity}
                    onChange={(e) => setSensitivity(Number(e.target.value))}
                    className="w-full h-1 bg-[#1E1B1D] rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER MAIN VIEW */}
        <main className="flex-1 bg-[#111012] border border-[#1E1B1D] rounded-lg flex flex-col min-h-0 overflow-hidden">
          {/* Top Bar inside Main Panel */}
          <header className="px-4 sm:px-6 py-3 border-b border-[#1E1B1D] flex flex-wrap items-center justify-between gap-3 bg-[#111012]">
            <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-lg">
              <Search className="w-4 h-4 text-[#8C8482] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Найти любой трек или артиста..."
                className="w-full pl-9 pr-20 py-1.5 rounded-full bg-[#1A181B] border border-[#2A2629] focus:border-[#6E1D2F] text-xs text-[#EDE9E8] placeholder-[#8C8482] outline-none transition"
              />
              {searchQuery && (
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-[#6E1D2F] text-[11px] font-medium text-white"
                >
                  {isSearching ? '...' : 'Найти'}
                </button>
              )}
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Account Switcher & Manager */}
              <button
                onClick={() => setShowAccountModal(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-xs text-[#EDE9E8] transition whitespace-nowrap"
                title="Сменить или добавить аккаунт игрока"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-inner"
                  style={{ backgroundColor: activeAccount?.avatarColor || '#6E1D2F' }}
                >
                  {(activeAccount?.username || 'U')[0].toUpperCase()}
                </div>
                <span className="font-medium truncate max-w-[110px]">
                  {activeAccount?.username || 'Аккаунт'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#8C8482]" />
              </button>

              <button
                onClick={() => setActiveSection('account')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition whitespace-nowrap ${
                  activeSection === 'account'
                    ? 'bg-[#251218] border-[#6E1D2F] text-white'
                    : 'bg-[#1A181B] hover:bg-[#242024] border-[#2A2629] text-[#EDE9E8]'
                }`}
                title="Настроить вкусы музыки и жанры игр"
              >
                <Sliders className="w-3.5 h-3.5 text-[#B84A62]" />
                <span>Вкусы</span>
              </button>

              <button
                onClick={toggleMiniHud}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition whitespace-nowrap ${
                  isMiniHudMode
                    ? 'bg-[#6E1D2F] border-[#8E2940] text-white'
                    : 'bg-[#1A181B] border-[#2A2629] text-[#8C8482] hover:text-[#EDE9E8]'
                }`}
                title="Компактный игровой мини-оверлей (Alt + M)"
              >
                <Minimize2 className="w-3.5 h-3.5 text-[#B84A62]" />
                <span>Мини-HUD</span>
              </button>

              <button
                onClick={toggleAlwaysOnTop}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition whitespace-nowrap ${
                  alwaysOnTop
                    ? 'bg-[#6E1D2F] border-[#8E2940] text-white'
                    : 'bg-[#1A181B] border-[#2A2629] text-[#8C8482] hover:text-[#EDE9E8]'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                <span>Поверх игры</span>
              </button>
            </div>
          </header>

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* 1. AUTONOMOUS AUTOPILOT STREAM VIEW */}
            {activeSection === 'autopilot' && (
              <>
                <div
                  className="px-5 sm:px-6 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-end gap-5 border-b border-[#1E1B1D]"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(88, 22, 37, 0.55) 0%, rgba(32, 14, 19, 0.45) 65%, rgba(17, 16, 18, 1) 100%)',
                  }}
                >
                  <img
                    src={currentTrack?.thumbnail || FALLBACK_REAL_TRACKS[0].thumbnail}
                    alt={currentTrack?.title || 'Cover'}
                    className="w-24 h-24 sm:w-36 sm:h-36 rounded-md object-cover shadow-2xl border border-white/10 shrink-0"
                  />

                  <div className="space-y-2.5 min-w-0 flex-1">
                    {/* Audio Mode Switcher: Game Vibe & Ambient vs User Profile */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center p-0.5 rounded-lg bg-[#141215] border border-[#2E282D]">
                        <button
                          onClick={() => handleToggleAudioMode('game-vibe')}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                            audioMode === 'game-vibe'
                              ? 'bg-[#6E1D2F] text-white shadow-md'
                              : 'text-[#8C8482] hover:text-[#EDE9E8]'
                          }`}
                        >
                          <span>🏰 Вайб игры & Эмбиент</span>
                          <span className="text-[10px] opacity-75 font-mono">Процедурный</span>
                        </button>

                        <button
                          onClick={() => handleToggleAudioMode('custom')}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                            audioMode === 'custom'
                              ? 'bg-[#6E1D2F] text-white shadow-md'
                              : 'text-[#8C8482] hover:text-[#EDE9E8]'
                          }`}
                        >
                          <span>🎧 Мои артисты</span>
                          <span className="text-[10px] opacity-75 font-mono">Профиль</span>
                        </button>
                      </div>

                      <span className="text-[11px] text-[#8C8482]">
                        {audioMode === 'game-vibe'
                          ? `Живой процедурный поток под ${telemetry.detectedProcess} (без фиксированных списков)`
                          : 'Играют твои персональные сохраненные вкусы'}
                      </span>
                    </div>

                    {/* Vision Director: what the AI sees right now */}
                    {telemetry.director && (
                      <div className="p-2.5 rounded-md bg-[#161317] border border-[#2E282D] text-xs text-[#EDE9E8] space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-wider font-semibold text-[#D47A8D]">
                          <span>🧠 ИИ видит</span>
                          <span className="text-[#8C8482]">·</span>
                          <span>{telemetry.director.sceneType}</span>
                          <span className="text-[#8C8482]">·</span>
                          <span>{telemetry.director.mood}</span>
                          <span className="text-[#8C8482]">·</span>
                          <span>напряжение {telemetry.director.tension}/10</span>
                        </div>
                        <p className="break-words leading-relaxed">{telemetry.director.summary}</p>
                        {telemetry.director.location && (
                          <p className="text-[11px] text-[#8C8482] break-words">📍 {telemetry.director.location}</p>
                        )}
                      </div>
                    )}

                    {/* Live Neural Subtitle Detection Notification */}
                    {telemetry.dialogueText && (
                      <div className="p-2.5 rounded-md bg-[#251218] border border-[#6E1D2F] text-xs text-[#EDE9E8] flex items-start gap-2 shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-[#E53935] animate-ping shrink-0 mt-1" />
                        <div className="min-w-0">
                          <span className="font-semibold text-[#D47A8D] uppercase tracking-wider text-[10px] block">
                            🎬 Нейросеть распознала реплику в игре ({telemetry.dialogueLabel || 'Сюжет'}):
                          </span>
                          <span className="italic text-[#EDE9E8] break-words">"{telemetry.dialogueText}"</span>
                        </div>
                      </div>
                    )}

                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-[#D47A8D]">
                      <span>
                        {telemetry.isCutscene
                          ? '🎬 КАТСЦЕНА В ИГРЕ'
                          : telemetry.isNewLocation
                          ? '📍 НОВАЯ ЛОКАЦИЯ'
                          : '⚡ АВТОНОМНЫЙ ПОТОК'} · {(telemetry.sceneLabel || currentSceneMeta.label).toUpperCase()}
                      </span>
                    </div>

                    <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-[#EDE9E8] break-words leading-tight">
                      {currentTrack?.title} — {currentTrack?.artist}
                    </h1>

                    <p className="text-xs text-[#9E9694] max-w-2xl leading-relaxed">
                      {audioMode === 'game-vibe'
                        ? `Программа считывает сюжет, катсцены и бои в ${telemetry.detectedProcess} и ставит вайбовый атмосферный эмбиент и оригинальный саундтрек под стиль игры.`
                        : `Программа ставит оригинальные треки твоих любимых артистов под моменты геймплея.`}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <button
                        onClick={async () => {
                          setLoadingStream(true);
                          await preloadAllDecks(accountProfile);
                          switchToSceneSmoothly(activeVibeRef.current);
                          setLoadingStream(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#6E1D2F] hover:bg-[#822238] text-xs font-medium text-white transition"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${loadingStream ? 'animate-spin' : ''}`}
                        />
                        <span>Обновить волну</span>
                      </button>

                      <button
                        onClick={() => setActiveSection('account')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#181518] hover:bg-[#221D22] border border-[#2E272B] text-xs text-[#EDE9E8] transition"
                      >
                        <User className="w-3.5 h-3.5 text-[#B84A62]" />
                        <span>Настроить жанры и предпочтения аккаунта</span>
                      </button>
                    </div>

                    {/* v2.0 Adaptive Audio Engine DSP Toggles */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCrossfadeEnabled((v) => !v)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                          crossfadeEnabled
                            ? 'bg-[#18261E] border-[#10B981]/40 text-[#6EE7B7]'
                            : 'bg-[#161418] border-[#262226] text-[#8C8482]'
                        }`}
                        title="Плавное затухание и нарастание громкости при смене сцены"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Кроссфейд сцен: {crossfadeEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setResumeExplorePosition((v) => !v)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                          resumeExplorePosition
                            ? 'bg-[#18261E] border-[#10B981]/40 text-[#6EE7B7]'
                            : 'bg-[#161418] border-[#262226] text-[#8C8482]'
                        }`}
                        title="После окончания битвы спокойный трек продолжается с той секунды, где прервался"
                      >
                        <Compass className="w-3 h-3" />
                        <span>
                          Память таймкода: {resumeExplorePosition ? 'ВКЛ' : 'ВЫКЛ'}
                          {lastResumedTimecode ? ` (с ${lastResumedTimecode})` : ''}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAutoDialogueDucking((v) => !v)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                          autoDialogueDucking
                            ? 'bg-[#18261E] border-[#10B981]/40 text-[#6EE7B7]'
                            : 'bg-[#161418] border-[#262226] text-[#8C8482]'
                        }`}
                        title="Автоматически снижать громкость музыки на 55% во время сюжетных диалогов и субтитров"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>
                          Приглушение в диалогах: {autoDialogueDucking ? 'ВКЛ' : 'ВЫКЛ'}
                          {isDialogueDucked && autoDialogueDucking ? ' · АКТИВНО' : ''}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1B1D] bg-[#131114]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={togglePlayPause}
                      className="w-11 h-11 rounded-full bg-[#7A1F34] hover:bg-[#8E253D] text-white flex items-center justify-center shadow-lg transition shrink-0"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="text-xs text-[#9E9694]">
                      Автоматический подбор:{' '}
                      <span className="text-[#EDE9E8] font-medium">
                        {resolvedMoodQuery}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openExternalMusic('ytmusic')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-[11px] text-[#9E9694] hover:text-white transition"
                    >
                      <span>YouTube Music</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => openExternalMusic('spotify')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-[11px] text-[#9E9694] hover:text-white transition"
                    >
                      <span>Spotify</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => openExternalMusic('yandex')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-[11px] text-[#9E9694] hover:text-white transition"
                    >
                      <span>Я.Музыка</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Clean Spotify-Style Track Table */}
                <div className="px-4 sm:px-6 py-2">
                  <div className="grid grid-cols-[28px_1fr_100px] sm:grid-cols-[36px_1fr_200px_120px_54px] gap-3 px-3 py-2 text-[11px] uppercase tracking-wider font-medium text-[#8C8482] border-b border-[#1E1B1D]">
                    <span>#</span>
                    <span>Трек</span>
                    <span className="hidden sm:block">Альбом</span>
                    <span>В подборку</span>
                    <span className="hidden sm:block text-right">Время</span>
                  </div>

                  <div className="divide-y divide-[#181619]">
                    {liveStreamTracks.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id;

                      return (
                        <div
                          key={`${track.id}-${idx}`}
                          onClick={() => playSpecificTrack(track)}
                          className={`grid grid-cols-[28px_1fr_100px] sm:grid-cols-[36px_1fr_200px_120px_54px] gap-3 items-center px-3 py-2.5 rounded-md cursor-pointer transition ${
                            isCurrent ? 'bg-[#211217]' : 'hover:bg-[#171518]'
                          }`}
                        >
                          <span
                            className={`text-xs font-mono ${
                              isCurrent ? 'text-[#D46A80] font-bold' : 'text-[#8C8482]'
                            }`}
                          >
                            {isCurrent && isPlaying ? '▶' : idx + 1}
                          </span>

                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={track.thumbnail}
                              alt={track.title}
                              className="w-10 h-10 rounded object-cover bg-[#1A181B] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div
                                className={`text-sm font-medium ${
                                  isCurrent ? 'text-[#EA7B93]' : 'text-[#EDE9E8]'
                                }`}
                              >
                                {track.title}
                              </div>
                              <div className="text-xs text-[#8C8482]">{track.artist}</div>
                            </div>
                          </div>

                          <div className="hidden sm:block text-xs text-[#8C8482]">
                            {track.album}
                          </div>

                          <div onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleAddTrackToUserPlaylist(track)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1A181B] hover:bg-[#2A171E] border border-[#2A2629] hover:border-[#6E1D2F] text-[11px] text-[#EDE9E8] transition"
                            >
                              <Plus className="w-3 h-3 text-[#B84A62]" />
                              <span>Сохранить</span>
                            </button>
                          </div>

                          <div className="hidden sm:block text-xs font-mono text-[#8C8482] text-right">
                            {track.duration}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* 2. ACCOUNT CREATION & MUSICAL TASTE ONBOARDING VIEW */}
            {activeSection === 'account' && (
              <form
                onSubmit={handleSaveAccountProfile}
                className="p-5 sm:p-7 space-y-6 max-w-4xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#1E1B1D]">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-widest font-semibold text-[#D47A8D]">
                      ПРОФИЛЬ ИГРОКА И МУЗЫКАЛЬНЫЕ ПРЕДПОЧТЕНИЯ
                    </div>
                    <h2 className="text-2xl font-bold text-[#EDE9E8]">
                      {accountProfile
                        ? `Аккаунт: ${accountProfile.username}`
                        : 'Создание аккаунта и настройка вкусов'}
                    </h2>
                    <p className="text-xs text-[#8C8482] max-w-2xl">
                      Выбери любимые жанры, артистов и характер переходов. Автономный движок будет опираться на твой вкус, подстраивая музыку под происходящее на экране игры.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2.5 rounded-md bg-[#6E1D2F] hover:bg-[#842238] text-xs font-semibold text-white transition shrink-0"
                  >
                    {savingProfile
                      ? 'Сохранение...'
                      : 'Сохранить профиль и применить вкусы'}
                  </button>
                </div>

                {/* Block 1: Nickname & Favorite Game Genres */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-4 rounded-lg bg-[#151316] border border-[#242023] space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#EDE9E8]">
                      1. Никнейм аккаунта
                    </label>
                    <input
                      type="text"
                      value={draftUsername}
                      onChange={(e) => setDraftUsername(e.target.value)}
                      placeholder="Введи свой никнейм..."
                      className="w-full px-3.5 py-2 rounded-md bg-[#0D0C0E] border border-[#2A2629] focus:border-[#6E1D2F] text-sm text-[#EDE9E8] outline-none"
                    />
                    <p className="text-[11px] text-[#8C8482]">
                      К аккаунту привязываются твои вкусы, чувствительность сенсора и сохраненные подборки.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-[#151316] border border-[#242023] space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#EDE9E8]">
                      2. В какие игры играешь чаще всего
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {GAME_GENRE_OPTIONS.map((gName) => {
                        const selected = draftGameGenres.includes(gName);
                        return (
                          <button
                            type="button"
                            key={gName}
                            onClick={() =>
                              setDraftGameGenres((prev) => toggleItemInList(prev, gName))
                            }
                            className={`px-2.5 py-1.5 rounded text-xs font-medium border transition ${
                              selected
                                ? 'bg-[#2B141B] border-[#6E1D2F] text-[#EDE9E8]'
                                : 'bg-[#0D0C0E] border-[#242023] text-[#8C8482] hover:text-[#EDE9E8]'
                            }`}
                          >
                            {gName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Block 2: Musical Genres */}
                <div className="p-4 rounded-lg bg-[#151316] border border-[#242023] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#EDE9E8]">
                      3. Любимые музыкальные жанры (выбери один или несколько)
                    </label>
                    <span className="text-[11px] text-[#B84A62]">
                      Выбрано: {draftGenres.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {GENRE_OPTIONS.map((genre) => {
                      const active = draftGenres.includes(genre.id);
                      return (
                        <button
                          type="button"
                          key={genre.id}
                          onClick={() =>
                            setDraftGenres((prev) => toggleItemInList(prev, genre.id))
                          }
                          className={`p-3 rounded-md text-left border transition ${
                            active
                              ? 'bg-[#251218] border-[#6E1D2F]'
                              : 'bg-[#0D0C0E] border-[#221E21] hover:border-[#362E33]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#EDE9E8]">
                              {genre.label}
                            </span>
                            {active && <Check className="w-3.5 h-3.5 text-[#D47A8D]" />}
                          </div>
                          <div className="text-[11px] text-[#8C8482] mt-1 leading-snug">
                            {genre.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Block 3: Favorite Artists */}
                <div className="p-4 rounded-lg bg-[#151316] border border-[#242023] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#EDE9E8]">
                      4. Любимые артисты и группы
                    </label>
                    <span className="text-[11px] text-[#B84A62]">
                      Выбрано: {draftArtists.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_ARTIST_CHIPS.map((artist) => {
                      const selected = draftArtists.includes(artist);
                      return (
                        <button
                          type="button"
                          key={artist}
                          onClick={() =>
                            setDraftArtists((prev) => toggleItemInList(prev, artist))
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                            selected
                              ? 'bg-[#6E1D2F] border-[#8E2940] text-white'
                              : 'bg-[#0D0C0E] border-[#242023] text-[#8C8482] hover:text-[#EDE9E8]'
                          }`}
                        >
                          {artist}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <input
                      type="text"
                      value={draftCustomArtists}
                      onChange={(e) => setDraftCustomArtists(e.target.value)}
                      placeholder="Или впиши своих любимых исполнителей через запятую..."
                      className="w-full px-3.5 py-2 rounded-md bg-[#0D0C0E] border border-[#2A2629] focus:border-[#6E1D2F] text-xs text-[#EDE9E8] outline-none"
                    />
                  </div>
                </div>

                {/* Block 4: Autonomous Behavior Preferences */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-[#151316] border border-[#242023] space-y-2.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#EDE9E8]">
                      Характер Авторежима
                    </label>
                    {[
                      {
                        id: 'immersion',
                        label: 'Плавное погружение',
                        sub: 'Больше атмосферы, смена только в жестком бою',
                      },
                      {
                        id: 'balanced',
                        label: 'Точный баланс по игре',
                        sub: 'Оптимальная реакция на покой и экшен',
                      },
                      {
                        id: 'high-drive',
                        label: 'Максимум драйва',
                        sub: 'Быстрое включение бодрых треков при движении',
                      },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() =>
                          setDraftDriveMode(
                            opt.id as 'immersion' | 'balanced' | 'high-drive'
                          )
                        }
                        className={`w-full p-2.5 rounded text-left border transition ${
                          draftDriveMode === opt.id
                            ? 'bg-[#251218] border-[#6E1D2F]'
                            : 'bg-[#0D0C0E] border-[#221E21]'
                        }`}
                      >
                        <div className="text-xs font-medium text-[#EDE9E8]">
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-[#8C8482] mt-0.5">{opt.sub}</div>
                      </button>
                    ))}
                  </div>

                  <div className="p-4 rounded-lg bg-[#151316] border border-[#242023] space-y-2.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#EDE9E8]">
                      Язык и сцена
                    </label>
                    {[
                      { id: 'all', label: 'Любые (Мировые + СНГ)' },
                      { id: 'foreign', label: 'Преимущественно зарубежные' },
                      { id: 'ru', label: 'Больше русскоязычных треков' },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() =>
                          setDraftLanguagePref(opt.id as 'all' | 'foreign' | 'ru')
                        }
                        className={`w-full p-2.5 rounded text-left text-xs font-medium border transition ${
                          draftLanguagePref === opt.id
                            ? 'bg-[#251218] border-[#6E1D2F] text-[#EDE9E8]'
                            : 'bg-[#0D0C0E] border-[#221E21] text-[#8C8482]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-4 rounded-lg bg-[#151316] border border-[#242023] space-y-2.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#EDE9E8]">
                      Вокал или Инструментал
                    </label>
                    {[
                      { id: 'vocal', label: 'Песни с вокалом и хиты' },
                      { id: 'mixed', label: 'Смешанно (вокал + биты)' },
                      { id: 'instrumental', label: 'Больше музыки без слов' },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() =>
                          setDraftVocalPref(
                            opt.id as 'vocal' | 'mixed' | 'instrumental'
                          )
                        }
                        className={`w-full p-2.5 rounded text-left text-xs font-medium border transition ${
                          draftVocalPref === opt.id
                            ? 'bg-[#251218] border-[#6E1D2F] text-[#EDE9E8]'
                            : 'bg-[#0D0C0E] border-[#221E21] text-[#8C8482]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}

            {/* 3. SEARCH VIEW */}
            {activeSection === 'search' && (
              <div className="p-5 sm:p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#EDE9E8]">
                    {searchQuery
                      ? `Результаты поиска: «${searchQuery}»`
                      : 'Поиск любой музыки'}
                  </h2>
                  <p className="text-xs text-[#8C8482]">
                    Включай любые полные треки сразу или сохраняй в свою подборку — программа сама определит их энергетику и момент для включения в игре.
                  </p>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-8 rounded-lg border border-[#1E1B1D] bg-[#0D0C0E] text-center text-xs text-[#8C8482]">
                    Введи название песни или артиста в строку поиска сверху и нажми Enter.
                  </div>
                ) : (
                  <div className="divide-y divide-[#181619]">
                    {searchResults.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id;
                      return (
                        <div
                          key={`${track.id}-${idx}`}
                          onClick={() => playSpecificTrack(track)}
                          className={`grid grid-cols-[28px_1fr_120px] sm:grid-cols-[36px_1fr_200px_130px_60px] gap-3 items-center px-3 py-2.5 rounded-md cursor-pointer transition ${
                            isCurrent ? 'bg-[#211217]' : 'hover:bg-[#171518]'
                          }`}
                        >
                          <span className="text-xs font-mono text-[#8C8482]">
                            {idx + 1}
                          </span>
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={track.thumbnail}
                              alt={track.title}
                              className="w-10 h-10 rounded object-cover bg-[#1A181B] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-[#EDE9E8]">
                                {track.title}
                              </div>
                              <div className="text-xs text-[#8C8482]">{track.artist}</div>
                            </div>
                          </div>
                          <div className="hidden sm:block text-xs text-[#8C8482]">
                            {track.album}
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleAddTrackToUserPlaylist(track)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#6E1D2F] hover:bg-[#822238] text-[11px] font-medium text-white transition"
                            >
                              <Plus className="w-3 h-3" />
                              <span>В подборку</span>
                            </button>
                          </div>
                          <div className="hidden sm:block text-xs font-mono text-[#8C8482] text-right">
                            {track.duration}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. SCENE-BASED PLAYLIST VIEW (Categorized into Explore, Combat, Boss, Drama, etc.) */}
            {activeSection === 'user-playlist' && (
              <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
                {!activeScenePlaylist ? (
                  <div className="p-8 rounded-xl border border-[#242023] bg-[#111012] text-center space-y-3">
                    <ListMusic className="w-10 h-10 text-[#B84A62] mx-auto opacity-75" />
                    <h3 className="text-base font-semibold text-[#EDE9E8]">
                      Подборка со сценами не выбрана
                    </h3>
                    <p className="text-xs text-[#8C8482] max-w-md mx-auto">
                      Создайте подборку и укажите треки под спокойную сцену, битву, босса и драму — и ИИ будет ставить их автоматически во время игры.
                    </p>
                    <button
                      onClick={() => setShowCreatePlaylistModal(true)}
                      className="px-4 py-2 rounded-md bg-[#6E1D2F] hover:bg-[#852339] text-xs font-semibold text-white transition shadow"
                    >
                      + Создать подборку со сценами
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Playlist Header Card */}
                    <div className="p-5 rounded-xl bg-gradient-to-r from-[#201015] via-[#161317] to-[#121114] border border-[#331B23] space-y-4 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#6E1D2F]/40 border border-[#852339]/50 text-[11px] font-semibold text-[#FF85A0] uppercase tracking-wider">
                            ПОДБОРКА СО СЦЕНАМИ
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#1B181C] border border-[#2A252C] text-[11px] text-[#A8A0A4]">
                            🎮 {activeScenePlaylist.gameTag || 'Для любых игр'}
                          </span>
                          <span className="text-[11px] text-[#7A7276]">
                            Аккаунт: <strong className="text-[#EDE9E8] font-medium">{activeAccount?.username || 'Гость'}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={handleToggleCustomPlaylistAutopilot}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition shadow ${
                              useCustomPlaylistInAutopilot
                                ? 'bg-[#10B981] hover:bg-[#059669] text-white'
                                : 'bg-[#1D191D] hover:bg-[#282228] border border-[#362E36] text-[#EDE9E8]'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {useCustomPlaylistInAutopilot
                                ? '✓ Включено в Авторежиме ИИ'
                                : 'Включить в Авторежиме ИИ'}
                            </span>
                          </button>

                          <button
                            onClick={() => handleExportScenePlaylist('code')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D191D] hover:bg-[#282228] border border-[#362E36] text-xs font-medium text-[#EDE9E8] transition"
                            title="Скопировать код подборки для отправки другу в Telegram или Discord"
                          >
                            <Copy className="w-3.5 h-3.5 text-[#B84A62]" />
                            <span>Код для друзей</span>
                          </button>

                          <button
                            onClick={() => handleExportScenePlaylist('file')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D191D] hover:bg-[#282228] border border-[#362E36] text-xs font-medium text-[#EDE9E8] transition"
                            title="Скачать подборку в виде файла .gamevibe.json"
                          >
                            <Download className="w-3.5 h-3.5 text-[#B84A62]" />
                            <span>JSON</span>
                          </button>

                          <button
                            onClick={() => setShowImportPlaylistModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D191D] hover:bg-[#282228] border border-[#362E36] text-xs font-medium text-[#EDE9E8] transition"
                            title="Импортировать чужую подборку по коду или JSON-файлу"
                          >
                            <Upload className="w-3.5 h-3.5 text-[#B84A62]" />
                            <span>Импорт</span>
                          </button>

                          <button
                            onClick={() => handleDeleteScenePlaylist(activeScenePlaylist.id)}
                            className="p-1.5 rounded-lg bg-[#1D191D] hover:bg-[#2F151C] border border-[#362E36] text-[#8C8482] hover:text-[#EA7B93] transition"
                            title="Удалить эту подборку"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {playlistShareFeedback && (
                        <div className="p-2.5 rounded-lg bg-[#18261E] border border-[#10B981]/40 text-xs text-[#6EE7B7] flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                          <span>{playlistShareFeedback}</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-[#EDE9E8] tracking-tight">
                          {activeScenePlaylist.name}
                        </h2>
                        <p className="text-xs text-[#9E9698] leading-relaxed max-w-3xl">
                          {activeScenePlaylist.description ||
                            'ИИ определяет игровую ситуацию на лету: во время исследования локаций ставит треки из спокойной сцены, а при атаках и боссах мгновенно переключает на боевые треки без повторов.'}
                        </p>
                      </div>

                      {useCustomPlaylistInAutopilot && (
                        <div className="p-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-xs text-[#6EE7B7] flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                          <span>
                            Авторежим активен: ИИ играет треки из настроенных ниже категорий в зависимости от происходящего в игре.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Scene Categories Selector (6 Buckets Grid) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#8C8482] px-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-[#A8A0A4]">
                          Категории сцен игры (выберите для настройки треков):
                        </span>
                        <span className="text-[11px]">
                          Всего треков:{' '}
                          {Object.values(activeScenePlaylist.scenes || {}).reduce(
                            (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
                            0
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {(Object.keys(SCENE_BUCKET_CONFIGS) as SceneBucketId[]).map((bucketId) => {
                          const conf = SCENE_BUCKET_CONFIGS[bucketId];
                          const isSelected = selectedSceneBucket === bucketId;
                          const trackCount = activeScenePlaylist.scenes[bucketId]?.length || 0;

                          const renderIcon = () => {
                            switch (bucketId) {
                              case 'EXPLORE':
                                return <Compass className="w-4 h-4" style={{ color: conf.accentColor }} />;
                              case 'COMBAT':
                                return <Swords className="w-4 h-4" style={{ color: conf.accentColor }} />;
                              case 'BOSSFIGHT':
                                return <Skull className="w-4 h-4" style={{ color: conf.accentColor }} />;
                              case 'DRAMA':
                                return <Film className="w-4 h-4" style={{ color: conf.accentColor }} />;
                              case 'MAJESTIC':
                                return <Sun className="w-4 h-4" style={{ color: conf.accentColor }} />;
                              case 'STEALTH':
                                return <EyeOff className="w-4 h-4" style={{ color: conf.accentColor }} />;
                              default:
                                return <Music className="w-4 h-4" />;
                            }
                          };

                          return (
                            <button
                              key={bucketId}
                              onClick={() => {
                                setSelectedSceneBucket(bucketId);
                                setSceneSearchResults([]);
                                setSceneSearchQuery('');
                              }}
                              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2.5 ${
                                isSelected
                                  ? 'bg-[#1F171A] border-[#8C233B] shadow-md ring-1 ring-[#8C233B]/40'
                                  : 'bg-[#141215] border-[#221E22] hover:border-[#383036] hover:bg-[#181519]'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                {renderIcon()}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                    trackCount > 0
                                      ? 'bg-white/10 text-white'
                                      : 'bg-black/30 text-[#7A7276]'
                                  }`}
                                >
                                  {trackCount}
                                </span>
                              </div>

                              <div>
                                <div className="text-xs font-semibold text-[#EDE9E8]">
                                  {conf.shortLabel}
                                </div>
                                <div className="text-[10px] text-[#7A7276] leading-tight mt-0.5">
                                  {conf.shortHint}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Scene Bucket Management Workspace */}
                    <div className="p-5 rounded-xl bg-[#141215] border border-[#242023] space-y-5 shadow-inner">
                      {/* Bucket Title & AI Behavior Note */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#221E22]">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow"
                            style={{
                              backgroundColor: `${SCENE_BUCKET_CONFIGS[selectedSceneBucket].accentColor}20`,
                              border: `1px solid ${SCENE_BUCKET_CONFIGS[selectedSceneBucket].accentColor}50`,
                            }}
                          >
                            {selectedSceneBucket === 'EXPLORE' && <Compass className="w-5 h-5 text-[#10B981]" />}
                            {selectedSceneBucket === 'COMBAT' && <Swords className="w-5 h-5 text-[#EF4444]" />}
                            {selectedSceneBucket === 'BOSSFIGHT' && <Skull className="w-5 h-5 text-[#DC2626]" />}
                            {selectedSceneBucket === 'DRAMA' && <Film className="w-5 h-5 text-[#8B5CF6]" />}
                            {selectedSceneBucket === 'MAJESTIC' && <Sun className="w-5 h-5 text-[#F59E0B]" />}
                            {selectedSceneBucket === 'STEALTH' && <EyeOff className="w-5 h-5 text-[#06B6D4]" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-[#EDE9E8]">
                                {SCENE_BUCKET_CONFIGS[selectedSceneBucket].label}
                              </h3>
                              <span className="text-xs text-[#8C8482] font-mono">
                                ({activeScenePlaylist.scenes[selectedSceneBucket]?.length || 0} трек.)
                              </span>
                            </div>
                            <p className="text-xs text-[#8C8482] mt-0.5">
                              {SCENE_BUCKET_CONFIGS[selectedSceneBucket].description}
                            </p>
                          </div>
                        </div>

                        {sceneActionFeedback && sceneActionFeedback.bucket === selectedSceneBucket && (
                          <div className="px-3 py-1 rounded bg-[#10B981]/20 border border-[#10B981]/40 text-xs text-[#6EE7B7] animate-fade-in font-medium">
                            {sceneActionFeedback.msg}
                          </div>
                        )}
                      </div>

                      {/* Add Track to this Scene Box */}
                      <div className="p-4 rounded-lg bg-[#0E0D10] border border-[#221F23] space-y-3">
                        <div className="text-xs font-semibold text-[#EDE9E8] flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5 text-[#B84A62]" />
                          <span>Добавить трек для сцены «{SCENE_BUCKET_CONFIGS[selectedSceneBucket].shortLabel}»</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* 1. Fast YouTube Search */}
                          <form onSubmit={handleSearchSceneTracks} className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-[#8C8482] absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={sceneSearchQuery}
                                onChange={(e) => setSceneSearchQuery(e.target.value)}
                                placeholder="Поиск на YouTube (напр. Witcher 3 Kaer Morhen)..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#181519] border border-[#292328] focus:border-[#6E1D2F] text-xs text-[#EDE9E8] outline-none transition"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isSearchingSceneTrack || !sceneSearchQuery.trim()}
                              className="px-3 py-1.5 rounded-md bg-[#6E1D2F] hover:bg-[#852339] text-xs font-medium text-white transition disabled:opacity-50 shrink-0"
                            >
                              {isSearchingSceneTrack ? '...' : 'Найти'}
                            </button>
                          </form>

                          {/* 2. Direct YouTube URL Paste */}
                          <form onSubmit={handleAddDirectUrlToScene} className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Link className="w-3.5 h-3.5 text-[#8C8482] absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={sceneDirectYtUrl}
                                onChange={(e) => setSceneDirectYtUrl(e.target.value)}
                                placeholder="Или ссылка YouTube: https://youtu.be/..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#181519] border border-[#292328] focus:border-[#6E1D2F] text-xs text-[#EDE9E8] outline-none transition"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isResolvingUrl || !sceneDirectYtUrl.trim()}
                              className="px-3 py-1.5 rounded-md bg-[#251E24] hover:bg-[#332A32] border border-[#3A3039] text-xs font-medium text-[#EDE9E8] transition disabled:opacity-50 shrink-0"
                            >
                              {isResolvingUrl ? '...' : 'Добавить ссылку'}
                            </button>
                          </form>
                        </div>

                        {/* Search Results Dropdown/List */}
                        {sceneSearchResults.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#221F23] space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-[#8C8482]">
                              <span>Результаты поиска:</span>
                              <button
                                type="button"
                                onClick={() => setSceneSearchResults([])}
                                className="hover:text-white"
                              >
                                Закрыть
                              </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto divide-y divide-[#1D1A1F] rounded-md bg-[#121013] border border-[#242026]">
                              {sceneSearchResults.map((t, i) => (
                                <div
                                  key={`${t.id}-${i}`}
                                  className="flex items-center justify-between p-2 hover:bg-[#1C181E] gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <img
                                      src={t.thumbnail}
                                      alt={t.title}
                                      className="w-8 h-8 rounded object-cover bg-black shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <div className="font-medium text-[#EDE9E8] truncate max-w-[280px]">
                                        {t.title}
                                      </div>
                                      <div className="text-[11px] text-[#8C8482] truncate max-w-[200px]">
                                        {t.artist}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] font-mono text-[#7A7276] hidden sm:inline">
                                      {t.duration}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAddTrackToScene(selectedSceneBucket, t)}
                                      className="px-2.5 py-1 rounded bg-[#6E1D2F] hover:bg-[#852339] text-[11px] font-medium text-white transition flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>В сцену</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Scene Tracks List */}
                      {(!activeScenePlaylist.scenes[selectedSceneBucket] ||
                        activeScenePlaylist.scenes[selectedSceneBucket].length === 0) ? (
                        <div className="p-8 rounded-lg border border-[#221F23] bg-[#0E0D10] text-center space-y-2">
                          <p className="text-xs text-[#8C8482]">
                            В категории «{SCENE_BUCKET_CONFIGS[selectedSceneBucket].shortLabel}» пока нет добавленных треков.
                          </p>
                          <p className="text-[11px] text-[#5A5458]">
                            Введите любимую музыку в строке поиска выше или вставьте ссылку YouTube, чтобы ИИ включал её во время таких игровых сцен.
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#1D1A1F] rounded-lg bg-[#0E0D10] border border-[#221F23] overflow-hidden">
                          {activeScenePlaylist.scenes[selectedSceneBucket].map((track, idx) => (
                            <div
                              key={`${track.id}-${idx}`}
                              className="flex items-center justify-between p-3 hover:bg-[#161318] transition gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs font-mono text-[#6A6266] w-5 text-center shrink-0">
                                  {idx + 1}
                                </span>
                                <img
                                  src={track.thumbnail}
                                  alt={track.title}
                                  className="w-10 h-10 rounded object-cover bg-black shrink-0 border border-[#252026]"
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-[#EDE9E8] truncate max-w-sm sm:max-w-md">
                                    {track.title}
                                  </div>
                                  <div className="text-xs text-[#8C8482] truncate">
                                    {track.artist}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs font-mono text-[#8C8482] hidden sm:inline">
                                  {track.duration}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => playSpecificTrack(track)}
                                  className="p-2 rounded-full bg-[#1F191D] hover:bg-[#6E1D2F] text-[#EDE9E8] transition"
                                  title="Воспроизвести сейчас"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveTrackFromScene(selectedSceneBucket, track.id)
                                  }
                                  className="p-2 text-[#8C8482] hover:text-[#EA7B93] transition"
                                  title="Удалить из этой сцены"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 5. LOCAL PC MUSIC SECTION */}
            {activeSection === 'local' && (
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#EDE9E8]">Музыка с твоего ПК</h2>
                  <p className="text-xs text-[#8C8482]">
                    Укажи любую папку с MP3, FLAC, WAV или M4A — Авторежим сможет включать твои локальные треки во время игры.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={localFolderPath}
                    onChange={(e) => setLocalFolderPath(e.target.value)}
                    className="flex-1 min-w-[240px] px-3.5 py-2 rounded-md bg-[#1A181B] border border-[#2A2629] text-xs text-[#EDE9E8] outline-none"
                  />
                  <button
                    onClick={scanLocalFolder}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#6E1D2F] hover:bg-[#822238] text-xs font-medium text-white transition"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${scanningLocal ? 'animate-spin' : ''}`}
                    />
                    <span>Сканировать папку</span>
                  </button>
                </div>

                {localTracks.length === 0 ? (
                  <div className="p-8 rounded-lg border border-[#1E1B1D] bg-[#0D0C0E] text-center text-xs text-[#8C8482]">
                    В указанной папке пока не найдено аудиофайлов (`.mp3`, `.flac`, `.wav`, `.m4a`). Укажи путь к своей папке с музыкой и нажми «Сканировать папку».
                  </div>
                ) : (
                  <div className="divide-y divide-[#181619]">
                    {localTracks.map((t, i) => (
                      <div
                        key={t.id}
                        onClick={() => playSpecificTrack(t)}
                        className="flex items-center justify-between py-2.5 px-3 hover:bg-[#171518] rounded-md cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-[#8C8482]">{i + 1}</span>
                          <div>
                            <div className="text-sm font-medium text-[#EDE9E8]">
                              {t.title}
                            </div>
                            <div className="text-xs text-[#8C8482]">{t.artist}</div>
                          </div>
                        </div>
                        <span className="text-xs text-[#B84A62]">Воспроизвести</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. PLAYER INTEGRATIONS & BYOK SECTION */}
            {activeSection === 'integrations' && (
              <div className="p-6 space-y-6 max-w-3xl">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#EDE9E8] flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#B84A62]" />
                    Интеграции, стриминг и собственный ИИ
                  </h2>
                  <p className="text-xs text-[#8C8482]">
                    Настройте источник звука под себя: используйте встроенный бесплатный YouTube, подключите Spotify / Apple Music, или активируйте собственную визуальную нейросеть Google Gemini.
                  </p>
                </div>

                {/* 1. Playback Engine Selector */}
                <div className="p-5 rounded-xl bg-[#141215] border border-[#242023] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[#EDE9E8] flex items-center gap-2">
                        <Music className="w-4 h-4 text-[#FF4D6D]" />
                        Основной источник воспроизведения
                      </div>
                      <p className="text-xs text-[#8C8482] mt-0.5">
                        Откуда воспроизводить саундтреки во время игры
                      </p>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1F1C20] border border-[#2D282D] text-[#EDE9E8]">
                      {integrationsConfig.playbackEngine.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* YouTube (Default / Free) */}
                    <div
                      onClick={() => {
                        setIntegrationsConfig((c) => ({ ...c, playbackEngine: 'youtube' }));
                        handleSaveIntegrations({ playbackEngine: 'youtube' });
                      }}
                      className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                        integrationsConfig.playbackEngine === 'youtube'
                          ? 'bg-[#22161A] border-[#8C233B] text-white shadow-lg'
                          : 'bg-[#181519] border-[#262226] text-[#9E9694] hover:border-[#3D363D]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-[#EDE9E8] flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF0000]" />
                            YouTube Audio
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF0000]/20 text-[#FF4D4D] font-medium">
                            Бесплатно
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#8C8482]">
                          Встроенный стрим полных саундтреков, эмбиентов и OST без ограничений и аккаунтов.
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-[#B84A62] font-medium">
                        {integrationsConfig.playbackEngine === 'youtube' ? '✓ Выбрано по умолчанию' : 'Выбрать'}
                      </div>
                    </div>

                    {/* Spotify */}
                    <div
                      onClick={() => {
                        setIntegrationsConfig((c) => ({ ...c, playbackEngine: 'spotify' }));
                        handleSaveIntegrations({ playbackEngine: 'spotify' });
                      }}
                      className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                        integrationsConfig.playbackEngine === 'spotify'
                          ? 'bg-[#112417] border-[#1DB954] text-white shadow-lg'
                          : 'bg-[#181519] border-[#262226] text-[#9E9694] hover:border-[#3D363D]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-[#EDE9E8] flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#1DB954]" />
                            Spotify
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1DB954]/20 text-[#1DB954] font-medium">
                            Premium
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#8C8482]">
                          Управление открытым Spotify Desktop и переключение треков по ситуации в игре.
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-[#1DB954] font-medium">
                        {integrationsConfig.playbackEngine === 'spotify' ? '✓ Активно' : 'Выбрать Spotify'}
                      </div>
                    </div>

                    {/* Apple Music */}
                    <div
                      onClick={() => {
                        setIntegrationsConfig((c) => ({ ...c, playbackEngine: 'apple' }));
                        handleSaveIntegrations({ playbackEngine: 'apple' });
                      }}
                      className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                        integrationsConfig.playbackEngine === 'apple'
                          ? 'bg-[#29141D] border-[#FA2D48] text-white shadow-lg'
                          : 'bg-[#181519] border-[#262226] text-[#9E9694] hover:border-[#3D363D]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-[#EDE9E8] flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FA2D48]" />
                            Apple Music
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FA2D48]/20 text-[#FA2D48] font-medium">
                            Подписка
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#8C8482]">
                          Синхронизация каталога саундтреков через веб-плеер или приложение Apple Music.
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-[#FA2D48] font-medium">
                        {integrationsConfig.playbackEngine === 'apple' ? '✓ Активно' : 'Выбрать Apple'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Bring Your Own Key (BYOK) — Google Gemini Vision */}
                <div className="p-5 rounded-xl bg-[#141215] border border-[#242023] space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[#EDE9E8] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FFD166]" />
                        Собственный API-ключ Google Gemini Vision
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2B231D] text-[#FFB703] border border-[#473620] font-normal">
                          Опционально (BYOK)
                        </span>
                      </div>
                      <p className="text-xs text-[#8C8482] leading-relaxed">
                        По умолчанию GameMusick работает <strong>100% бесплатно и офлайн</strong>, считывая сюжет и субтитры через встроенный в Windows нейро-OCR (WinRT) и OpenCV на процессоре (&lt;1% нагрузки).
                        Если вы хотите подключить визуальную нейросеть Google для кинематографического анализа каждого кадра игры — активируйте эту опцию.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        const next = !integrationsConfig.geminiEnabled;
                        setIntegrationsConfig((c) => ({ ...c, geminiEnabled: next }));
                        handleSaveIntegrations({ geminiEnabled: next });
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        integrationsConfig.geminiEnabled ? 'bg-[#6E1D2F]' : 'bg-[#2A262B]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          integrationsConfig.geminiEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {integrationsConfig.geminiEnabled && (
                    <div className="pt-3 border-t border-[#221E22] space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#9E9694] mb-1">
                          API-ключ Google Gemini (из Google AI Studio):
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showGeminiKey ? 'text' : 'password'}
                              value={integrationsConfig.geminiApiKey}
                              onChange={(e) =>
                                setIntegrationsConfig((c) => ({ ...c, geminiApiKey: e.target.value }))
                              }
                              placeholder={
                                integrationsConfig.geminiMaskedKey
                                  ? `Сохранённый ключ: ${integrationsConfig.geminiMaskedKey}`
                                  : 'Вставьте ваш ключ: AIzaSy...'
                              }
                              className="w-full px-3 py-2 pr-10 text-xs rounded-lg bg-[#0C0B0D] border border-[#2A262B] text-[#EDE9E8] placeholder-[#5A5458] focus:border-[#6E1D2F] outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowGeminiKey((v) => !v)}
                              className="absolute right-2.5 top-2.5 text-[#8C8482] hover:text-[#EDE9E8]"
                            >
                              {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleTestGeminiKey}
                            disabled={testingGemini}
                            className="px-3.5 py-2 rounded-lg bg-[#241B20] hover:bg-[#33222B] border border-[#44222E] text-xs font-medium text-[#EDE9E8] flex items-center gap-1.5 transition shrink-0 disabled:opacity-50"
                          >
                            {testingGemini ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Key className="w-3.5 h-3.5 text-[#FF6B8B]" />
                            )}
                            Проверить
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-[#9E9694] mb-1">
                            Модель Gemini:
                          </label>
                          <select
                            value={integrationsConfig.geminiModel}
                            onChange={(e) => {
                              const m = e.target.value;
                              setIntegrationsConfig((c) => ({ ...c, geminiModel: m }));
                              handleSaveIntegrations({ geminiModel: m });
                            }}
                            className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#0C0B0D] border border-[#2A262B] text-[#EDE9E8] outline-none"
                          >
                            <option value="gemini-2.5-flash">gemini-2.5-flash (Рекомендуется, быстрый)</option>
                            <option value="gemini-2.5-pro">gemini-2.5-pro (Глубокий анализ кадра)</option>
                            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          </select>
                        </div>

                        <div className="flex items-end">
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#B84A62] hover:text-[#EDE9E8] inline-flex items-center gap-1 pb-1.5 transition"
                          >
                            Получить ключ в Google AI Studio
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {geminiStatusMsg && (
                        <div
                          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                            geminiStatusMsg.ok
                              ? 'bg-[#122B18] text-[#4ADE80] border border-[#1E4D27]'
                              : 'bg-[#2E1419] text-[#F87171] border border-[#521C26]'
                          }`}
                        >
                          {geminiStatusMsg.ok ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 shrink-0" />
                          )}
                          <span>{geminiStatusMsg.text}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. External Player Desktop Bridge */}
                <div className="p-5 rounded-xl bg-[#141215] border border-[#242023] space-y-4">
                  <div className="text-sm font-semibold text-[#EDE9E8] flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#B84A62]" />
                    Управление внешними приложениями на ПК
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#181519] border border-[#262226] flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#EDE9E8]">
                        Системные медиа-клавиши Windows (Global Media Hook)
                      </div>
                      <p className="text-[11px] text-[#8C8482]">
                        Автоматически посылает сигнал следующего трека в открытый Spotify Desktop, Яндекс Музыку или плеер при смене боевой обстановки в игре.
                      </p>
                    </div>
                    <button
                      onClick={() => setSystemMediaSync((v) => !v)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 transition ${
                        systemMediaSync
                          ? 'bg-[#6E1D2F] text-white shadow'
                          : 'bg-[#221E23] text-[#8C8482] border border-[#2E282E]'
                      }`}
                    >
                      {systemMediaSync ? '✓ Активно' : 'Включить'}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#181519] border border-[#262226] flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#EDE9E8]">
                        Браузерный скрипт для вкладки music.youtube.com (Tampermonkey)
                      </div>
                      <p className="text-[11px] text-[#8C8482]">
                        Если вы предпочитаете слушать музыку в отдельной вкладке браузера без подписки — этот скрипт управляет вкладкой автоматически.
                      </p>
                    </div>
                    <a
                      href="/api/userscript"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-md bg-[#221E23] hover:bg-[#2D282E] border border-[#2E282E] text-xs font-medium text-[#EDE9E8] shrink-0 transition"
                    >
                      Скачать скрипт
                    </a>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#8C8482]">Быстрый переход текущего трека:</span>
                    <button
                      onClick={() => openExternalMusic('spotify')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#1B181C] hover:bg-[#252026] border border-[#2A252C] text-xs text-[#EDE9E8] transition"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#1DB954]" />
                      В Spotify
                      <ExternalLink className="w-3 h-3 text-[#8C8482]" />
                    </button>
                    <button
                      onClick={() => {
                        const q = encodeURIComponent(`${currentTrack.artist} ${currentTrack.title}`);
                        window.open(`https://music.apple.com/search?term=${q}`, '_blank', 'noopener,noreferrer');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#1B181C] hover:bg-[#252026] border border-[#2A252C] text-xs text-[#EDE9E8] transition"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#FA2D48]" />
                      В Apple Music
                      <ExternalLink className="w-3 h-3 text-[#8C8482]" />
                    </button>
                    <button
                      onClick={() => openExternalMusic('ytmusic')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#1B181C] hover:bg-[#252026] border border-[#2A252C] text-xs text-[#EDE9E8] transition"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#FF0000]" />
                      В YouTube Music
                      <ExternalLink className="w-3 h-3 text-[#8C8482]" />
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleSaveIntegrations()}
                    disabled={savingIntegrations}
                    className="px-5 py-2 rounded-lg bg-[#6E1D2F] hover:bg-[#852339] text-white text-xs font-semibold shadow-md flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {savingIntegrations ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Сохранить настройки
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* BOTTOM PERSISTENT SPOTIFY-STYLE PLAYER BAR (Full Track Duration) */}
      <footer className="h-[84px] shrink-0 bg-[#0B0A0C] border-t border-[#1E1B1D] px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Current Playing Track Info */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-[42%] sm:w-[30%] overflow-hidden">
          <img
            src={currentTrack?.thumbnail || FALLBACK_REAL_TRACKS[0].thumbnail}
            alt={currentTrack?.title || 'cover'}
            className="w-11 h-11 sm:w-14 sm:h-14 rounded object-cover bg-[#18161A] border border-[#262225] shrink-0"
          />
          <div className="min-w-0 flex-1 overflow-hidden">
            <div
              className="text-xs sm:text-sm font-semibold text-[#EDE9E8] truncate"
              title={currentTrack?.title}
            >
              {currentTrack?.title}
            </div>
            <div
              className="text-[11px] sm:text-xs text-[#8C8482] truncate mt-0.5"
              title={currentTrack?.artist}
            >
              {currentTrack?.artist}
            </div>
          </div>
        </div>

        {/* Center: Playback Controls + Full-Length Seek Bar */}
        <div className="flex-1 max-w-[520px] flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => skipTrack(-1)}
              className="p-1.5 text-[#8C8482] hover:text-[#EDE9E8] transition"
              title="Предыдущий трек"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-9 h-9 rounded-full bg-[#EDE9E8] hover:bg-white text-[#080809] flex items-center justify-center transition"
              title={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skipTrack(1)}
              className="p-1.5 text-[#8C8482] hover:text-[#EDE9E8] transition"
              title="Следующий трек"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#8C8482] min-w-[44px] text-right">
              {formatTime(progressSec)}
            </span>
            <input
              type="range"
              min={0}
              max={durationSec || 220}
              step={0.5}
              value={progressSec}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="flex-1 h-1 bg-[#221E21] rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-[#8C8482] min-w-[44px]">
              {formatTime(durationSec)}
            </span>
          </div>
        </div>

        {/* Right: Autonomous Activity + Volume */}
        <div className="hidden sm:flex items-center justify-end gap-3 w-[30%] min-w-[180px]">
          {isDialogueDucked && autoDialogueDucking && (
            <div
              className="px-2 py-1 rounded bg-[#251218] border border-[#6E1D2F] text-[11px] text-[#FF85A0] font-medium flex items-center gap-1"
              title="Громкость музыки автоматически приглушена на время диалога в игре"
            >
              <span>🔉 Диалог</span>
            </div>
          )}

          <div className="px-2.5 py-1 rounded bg-[#141215] border border-[#242023] text-[11px] text-[#9E9694]">
            Динамика: <span className="font-mono text-[#EDE9E8]">{telemetry.motionDelta}%</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="text-[#8C8482] hover:text-[#EDE9E8] transition"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                setVolume(Number(e.target.value));
              }}
              className="w-24 h-1 bg-[#221E21] rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </footer>

      {/* ACCOUNT SWITCHER & MANAGER MODAL */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141215] border border-[#2A2429] p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#242025]">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#B84A62]" />
                <h3 className="text-base font-bold text-[#EDE9E8]">Учетные записи игроков</h3>
              </div>
              <button
                onClick={() => {
                  setShowAccountModal(false);
                  setShowCreateAccountModal(false);
                }}
                className="p-1 rounded-md text-[#8C8482] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8C8482] leading-relaxed">
              Переключайтесь между профилями игроков. У каждого аккаунта свои персональные вкусы и подборки со сценами под разные игры.
            </p>

            {/* Existing Accounts List */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {accounts.map((acc) => {
                const isCurrent = activeAccount?.id === acc.id;
                return (
                  <div
                    key={acc.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      isCurrent
                        ? 'bg-[#22161A] border-[#8C233B]'
                        : 'bg-[#181519] border-[#252026] hover:border-[#383038]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner"
                        style={{ backgroundColor: acc.avatarColor || '#6E1D2F' }}
                      >
                        {(acc.username || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#EDE9E8] flex items-center gap-2">
                          <span className="truncate">{acc.username}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded bg-[#10B981]/20 text-[#10B981] text-[10px] font-medium">
                              Активен
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8C8482]">
                          Подборок со сценами: {acc.playlistsCount || acc.playlists?.length || 0}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <button
                          onClick={() => handleSwitchAccount(acc.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#2A2329] hover:bg-[#6E1D2F] text-xs font-medium text-white transition"
                        >
                          Войти
                        </button>
                      )}
                      {accounts.length > 1 && (
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="p-1.5 text-[#8C8482] hover:text-[#EA7B93] transition"
                          title="Удалить профиль"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create New Account Button / Form */}
            {!showCreateAccountModal ? (
              <button
                onClick={() => setShowCreateAccountModal(true)}
                className="w-full py-2.5 rounded-xl bg-[#1C181D] hover:bg-[#262028] border border-[#2E2830] text-xs font-semibold text-[#EDE9E8] flex items-center justify-center gap-2 transition"
              >
                <UserPlus className="w-4 h-4 text-[#B84A62]" />
                <span>Создать новый аккаунт игрока</span>
              </button>
            ) : (
              <form
                onSubmit={handleCreateAccount}
                className="p-3.5 rounded-xl bg-[#181519] border border-[#2D262F] space-y-3"
              >
                <div className="text-xs font-semibold text-[#EDE9E8]">Новый профиль:</div>
                <input
                  type="text"
                  value={newAccountUsername}
                  onChange={(e) => setNewAccountUsername(e.target.value)}
                  placeholder="Имя игрока (например: Alex, WitcherPro)..."
                  className="w-full px-3 py-2 rounded-lg bg-[#110F12] border border-[#2A242B] text-xs text-[#EDE9E8] outline-none"
                  autoFocus
                />
                <div>
                  <div className="text-[11px] text-[#8C8482] mb-1.5">Цвет аватара:</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      '#6E1D2F',
                      '#10B981',
                      '#3B82F6',
                      '#8B5CF6',
                      '#F59E0B',
                      '#EC4899',
                      '#06B6D4',
                      '#64748B',
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewAccountColor(c)}
                        className={`w-6 h-6 rounded-full transition ${
                          newAccountColor === c
                            ? 'scale-125 ring-2 ring-white'
                            : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateAccountModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-[#8C8482] hover:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-[#6E1D2F] hover:bg-[#852339] text-xs font-medium text-white transition"
                  >
                    Создать
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CREATE SCENE PLAYLIST MODAL */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141215] border border-[#2A2429] p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#242025]">
              <div className="flex items-center gap-2.5">
                <ListMusic className="w-5 h-5 text-[#B84A62]" />
                <h3 className="text-base font-bold text-[#EDE9E8]">Создать подборку со сценами</h3>
              </div>
              <button
                onClick={() => setShowCreatePlaylistModal(false)}
                className="p-1 rounded-md text-[#8C8482] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8C8482] leading-relaxed">
              В этой подборке будут разделы для спокойных моментов, боев, боссов и драматических катсцен. ИИ будет сам определять ситуацию в игре и включать подходящие песни.
            </p>

            <form onSubmit={handleCreateScenePlaylist} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#8C8482]">Название подборки:</label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Например: Мой саундтрек для Elden Ring, Атмосферный сет..."
                  className="w-full px-3 py-2 rounded-lg bg-[#110F12] border border-[#2A242B] text-xs text-[#EDE9E8] outline-none focus:border-[#6E1D2F]"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#8C8482]">Для какой игры (тег):</label>
                <input
                  type="text"
                  value={newPlaylistGameTag}
                  onChange={(e) => setNewPlaylistGameTag(e.target.value)}
                  placeholder={telemetry.detectedProcess || 'Для любых игр'}
                  className="w-full px-3 py-2 rounded-lg bg-[#110F12] border border-[#2A242B] text-xs text-[#EDE9E8] outline-none focus:border-[#6E1D2F]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePlaylistModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-[#8C8482] hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-5 py-1.5 rounded-lg bg-[#6E1D2F] hover:bg-[#852339] text-xs font-semibold text-white transition disabled:opacity-50"
                >
                  Создать подборку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT SCENE PLAYLIST MODAL (Share Code or .gamevibe.json File) */}
      {showImportPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141215] border border-[#2A2429] p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#242025]">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-[#B84A62]" />
                <h3 className="text-base font-bold text-[#EDE9E8]">Импорт подборки со сценами</h3>
              </div>
              <button
                onClick={() => setShowImportPlaylistModal(false)}
                className="p-1 rounded-md text-[#8C8482] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8C8482] leading-relaxed">
              Вставьте код подборки (<code className="text-[#EDE9E8]">GV2:...</code>), которым с вами поделился друг, или загрузите сохраненный файл <code className="text-[#EDE9E8]">.gamevibe.json</code>.
            </p>

            <form onSubmit={handleImportScenePlaylist} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#8C8482]">Код подборки или JSON:</label>
                <textarea
                  rows={4}
                  value={importPlaylistCode}
                  onChange={(e) => setImportPlaylistCode(e.target.value)}
                  placeholder="Вставьте сюда код GV2:eyJuYW1lIjoi... или содержимое JSON"
                  className="w-full px-3 py-2 rounded-lg bg-[#110F12] border border-[#2A242B] text-xs font-mono text-[#EDE9E8] outline-none focus:border-[#6E1D2F]"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D191D] hover:bg-[#282228] border border-[#362E36] text-xs font-medium text-[#EDE9E8] cursor-pointer transition">
                  <FolderOpen className="w-3.5 h-3.5 text-[#B84A62]" />
                  <span>Загрузить .JSON файл</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportPlaylistFile}
                    className="hidden"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportPlaylistModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-[#8C8482] hover:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!importPlaylistCode.trim()}
                    className="px-4 py-1.5 rounded-lg bg-[#6E1D2F] hover:bg-[#852339] text-xs font-semibold text-white transition disabled:opacity-50"
                  >
                    Импортировать
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ULTRA-MINI IN-GAME HUD OVERLAY BAR (Alt + M) */}
      {isMiniHudMode && (
        <div className="fixed inset-0 z-40 bg-[#080809] flex flex-col justify-between p-2 select-none">
          <div className="w-full h-full rounded-xl bg-[#121014] border border-[#441E2B] shadow-2xl p-3 flex flex-col justify-between">
            {/* Top row: Active Game + Scene Badge + Expand Button (Draggable region) */}
            <div
              className="flex items-center justify-between gap-2"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 min-w-0">
                <img src="/logo-icon.svg" alt="GameVibe" className="w-4 h-4 rounded-sm shrink-0" />
                <span className="px-2 py-0.5 rounded bg-[#6E1D2F] text-[10px] font-bold uppercase tracking-wider text-white">
                  {SCENE_BUCKET_CONFIGS[activeVibe as SceneBucketId]?.shortLabel || currentSceneMeta.shortLabel}
                </span>
                <span className="text-xs font-medium text-[#D47A8D] truncate">
                  {telemetry.sceneLabel || currentSceneMeta.label}
                </span>
                {isDialogueDucked && autoDialogueDucking && (
                  <span className="px-1.5 py-0.5 rounded bg-[#251218] border border-[#6E1D2F] text-[10px] text-[#FF85A0]">
                    🔉 Диалог
                  </span>
                )}
              </div>

              <button
                onClick={toggleMiniHud}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1D191D] hover:bg-[#2A232A] border border-[#362E36] text-[11px] font-medium text-[#EDE9E8] transition shrink-0"
                title="Развернуть полное окно (Alt + M)"
              >
                <Maximize2 className="w-3 h-3 text-[#B84A62]" />
                <span>Развернуть</span>
              </button>
            </div>

            {/* Middle row: Current Track + Play/Pause/Skip Controls */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <img
                  src={currentTrack?.thumbnail || FALLBACK_REAL_TRACKS[0].thumbnail}
                  alt={currentTrack?.title || 'cover'}
                  className="w-11 h-11 rounded-lg object-cover border border-[#2C242B] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#EDE9E8] truncate">
                    {currentTrack?.title}
                  </div>
                  <div className="text-xs text-[#8C8482] truncate">
                    {currentTrack?.artist} · {formatTime(progressSec)} / {formatTime(durationSec)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => skipTrack(-1)}
                  className="p-2 rounded-lg bg-[#1A171C] hover:bg-[#242027] text-[#EDE9E8] transition"
                  title="Предыдущий трек"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="w-10 h-10 rounded-full bg-[#6E1D2F] hover:bg-[#852339] text-white flex items-center justify-center shadow transition"
                  title={isPlaying ? 'Пауза' : 'Играть'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={() => skipTrack(1)}
                  className="p-2 rounded-lg bg-[#1A171C] hover:bg-[#242027] text-[#EDE9E8] transition"
                  title="Следующий трек"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom row: Quick Scene Override Pills */}
            <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-[#221D24] flex-wrap">
              {(Object.keys(SCENE_BUCKET_CONFIGS) as SceneBucketId[]).map((bId) => {
                const conf = SCENE_BUCKET_CONFIGS[bId];
                const isAct = activeVibe === bId;
                return (
                  <button
                    key={bId}
                    onClick={() => switchToSceneSmoothly(bId)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                      isAct
                        ? 'bg-[#6E1D2F] text-white'
                        : 'bg-[#18151A] text-[#8C8482] hover:text-[#EDE9E8]'
                    }`}
                  >
                    {conf.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
