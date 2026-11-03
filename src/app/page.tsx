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
} from 'lucide-react';
import { FALLBACK_REAL_TRACKS, VIBE_STATES } from '@/lib/defaultData';
import { TelemetrySnapshot, TrackItem, VibeStateId } from '@/types/vibe';

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
];

const POPULAR_ARTIST_CHIPS = [
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
  const [m, s] = dur.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(m) || Number.isNaN(s)) return 220;
  return m * 60 + s;
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
  const [sensitivity, setSensitivity] = useState<number>(42);
  const [alwaysOnTop, setAlwaysOnTop] = useState<boolean>(false);
  const [systemMediaSync, setSystemMediaSync] = useState<boolean>(false);
  const [userMoodHint, setUserMoodHint] = useState<string>('');
  const [resolvedMoodQuery, setResolvedMoodQuery] = useState<string>(
    'Автономный поток под игру'
  );
  const [liveStreamTracks, setLiveStreamTracks] = useState<TrackItem[]>(FALLBACK_REAL_TRACKS);
  const [loadingStream, setLoadingStream] = useState<boolean>(false);

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

  // User-created playlists (empty by default — created by the user)
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [useCustomPlaylistInAutopilot, setUseCustomPlaylistInAutopilot] =
    useState<boolean>(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');

  // Local PC folder state
  const [localFolderPath, setLocalFolderPath] = useState<string>('C:\\Users\\Public\\Music');
  const [localTracks, setLocalTracks] = useState<TrackItem[]>([]);
  const [scanningLocal, setScanningLocal] = useState<boolean>(false);

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    timestamp: Date.now(),
    detectedProcess: 'Ожидание игры',
    windowTitle: 'Рабочий стол Windows',
    motionDelta: 12,
    redAlertRatio: 2,
    brightness: 46,
    inferredVibe: 'EXPLORE',
    sensorMode: 'win32-live',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSwitchRef = useRef<number>(0);

  // Load saved account profile & user playlists from disk
  useEffect(() => {
    fetch('/api/presets')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.userPlaylists)) {
          setUserPlaylists(data.userPlaylists);
        }
        if (data.accountProfile) {
          const p: UserAccountProfile = data.accountProfile;
          setAccountProfile(p);
          setDraftUsername(p.username || '');
          setDraftGenres(p.favoriteGenres || []);
          setDraftArtists(p.favoriteArtists || []);
          setDraftCustomArtists(p.customArtistsText || '');
          setDraftGameGenres(p.gameGenres || []);
          setDraftDriveMode(p.driveMode || 'balanced');
          setDraftLanguagePref(p.languagePref || 'all');
          setDraftVocalPref(p.vocalPref || 'mixed');
        }
      })
      .catch(() => {});
  }, []);

  /**
   * Autonomous Dynamic Autopilot Stream Fetcher:
   * Uses the user's Account Taste Profile (genres, favorite artists, language, vocal pref)
   * combined with live game telemetry (scene, brightness, motion) to stream full tracks on the fly.
   */
  const fetchDynamicStreamForScene = useCallback(
    async (
      scene: VibeStateId,
      snap: TelemetrySnapshot,
      hintText: string,
      autoPlayFirst: boolean,
      overrideProfile?: UserAccountProfile | null
    ) => {
      if (useCustomPlaylistInAutopilot && selectedPlaylistId) {
        const activePl = userPlaylists.find((p) => p.id === selectedPlaylistId);
        if (activePl && activePl.tracks.length > 0) {
          const matching = activePl.tracks.filter((t) => t.vibe === scene);
          const pool = matching.length > 0 ? matching : activePl.tracks;
          const chosen = pool[Math.floor(Math.random() * pool.length)];
          setCurrentTrack(chosen);
          setDurationSec(parseDurationStringToSec(chosen.duration));
          setProgressSec(0);
          if (autoPlayFirst) setIsPlaying(true);
          return;
        }
      }

      const activeProf = overrideProfile !== undefined ? overrideProfile : accountProfile;
      const genresList = activeProf?.favoriteGenres || draftGenres;
      const customExtra = (activeProf?.customArtistsText || draftCustomArtists)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const artistsList = [...(activeProf?.favoriteArtists || draftArtists), ...customExtra];

      setLoadingStream(true);
      try {
        const params = new URLSearchParams({
          mode: 'autopilot',
          vibe: scene,
          brightness: String(snap.brightness),
          motion: String(snap.motionDelta),
          process: snap.detectedProcess,
          hint: hintText,
          genres: genresList.join(','),
          artists: artistsList.join(','),
          lang: activeProf?.languagePref || draftLanguagePref,
          vocal: activeProf?.vocalPref || draftVocalPref,
        });
        const res = await fetch(`/api/ytmusic?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.resolvedMoodQuery) {
          setResolvedMoodQuery(data.resolvedMoodQuery);
        }
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          setLiveStreamTracks(data.tracks);
          const first = data.tracks[0];
          setCurrentTrack(first);
          setDurationSec(parseDurationStringToSec(first.duration));
          setProgressSec(0);
          if (autoPlayFirst) {
            setIsPlaying(true);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoadingStream(false);
      }
    },
    [
      useCustomPlaylistInAutopilot,
      selectedPlaylistId,
      userPlaylists,
      accountProfile,
      draftGenres,
      draftArtists,
      draftCustomArtists,
      draftLanguagePref,
      draftVocalPref,
    ]
  );

  // Initial autonomous stream discovery on mount
  useEffect(() => {
    fetchDynamicStreamForScene('EXPLORE', telemetry, '', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autonomous real-time game screen & input telemetry loop
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
              : 46,
        };
        setTelemetry(data);

        if (autopilotEnabled) {
          let targetVibe: VibeStateId = data.inferredVibe;
          if (data.motionDelta >= sensitivity + 26 || data.redAlertRatio >= 16) {
            targetVibe = 'BOSSFIGHT';
          } else if (data.motionDelta >= sensitivity) {
            targetVibe = 'COMBAT';
          } else if (data.brightness < 24 && data.motionDelta >= 12) {
            targetVibe = 'STEALTH';
          } else {
            targetVibe = 'EXPLORE';
          }

          const now = Date.now();
          if (targetVibe !== activeVibe && now - lastSwitchRef.current > 8500) {
            lastSwitchRef.current = now;
            setActiveVibe(targetVibe);
            fetchDynamicStreamForScene(targetVibe, data, userMoodHint, true);

            if (systemMediaSync) {
              fetch('/api/system-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'next' }),
              }).catch(() => {});
            }
          }
        }
      } catch {
        // ignore
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [
    autopilotEnabled,
    activeVibe,
    sensitivity,
    userMoodHint,
    systemMediaSync,
    fetchDynamicStreamForScene,
  ]);

  // Full-length audio playback lifecycle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.previewUrl) {
      if (audio.src !== currentTrack.previewUrl && !audio.src.endsWith(currentTrack.previewUrl)) {
        audio.src = currentTrack.previewUrl;
        audio.load();
      }
      audio.volume = isMuted ? 0 : volume / 100;
      if (isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }
  }, [currentTrack, isPlaying, volume, isMuted]);

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
        await fetchDynamicStreamForScene(activeVibe, telemetry, userMoodHint, true, saved);
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

  const handleCreateUserPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_PLAYLIST',
          name,
          gameTag: telemetry.detectedProcess || 'Любая игра',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.store?.userPlaylists) {
          setUserPlaylists(data.store.userPlaylists);
        }
        if (data.playlist?.id) {
          setSelectedPlaylistId(data.playlist.id);
          setActiveSection('user-playlist');
        }
        setNewPlaylistName('');
        setCreatingPlaylist(false);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteUserPlaylist = async (playlistId: string) => {
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_PLAYLIST', playlistId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.store?.userPlaylists) {
          setUserPlaylists(data.store.userPlaylists);
        }
        if (selectedPlaylistId === playlistId) {
          setSelectedPlaylistId(null);
          setActiveSection('autopilot');
        }
      }
    } catch {
      // ignore
    }
  };

  const handleAddTrackToUserPlaylist = async (track: TrackItem, targetPlaylistId?: string) => {
    let plId = targetPlaylistId || selectedPlaylistId || userPlaylists[0]?.id;
    if (!plId) {
      const createRes = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_PLAYLIST',
          name: 'Моя подборка #1',
          gameTag: telemetry.detectedProcess || 'Любая игра',
        }),
      });
      if (createRes.ok) {
        const cData = await createRes.json();
        plId = cData.playlist?.id;
      }
    }
    if (!plId) return;

    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ADD_TRACK_TO_PLAYLIST',
        playlistId: plId,
        track,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.store?.userPlaylists) {
        setUserPlaylists(data.store.userPlaylists);
      }
    }
  };

  const handleRemoveTrackFromUserPlaylist = async (playlistId: string, trackId: string) => {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REMOVE_TRACK_FROM_PLAYLIST',
        playlistId,
        trackId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.store?.userPlaylists) {
        setUserPlaylists(data.store.userPlaylists);
      }
    }
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
    setCurrentTrack(track);
    setDurationSec(parseDurationStringToSec(track.duration));
    setProgressSec(0);
    setIsPlaying(true);
  };

  const skipTrack = useCallback(
    (dir: 1 | -1 = 1) => {
      const activePool =
        activeSection === 'search' && searchResults.length > 0
          ? searchResults
          : liveStreamTracks;
      if (activePool.length === 0) return;

      const idx = activePool.findIndex((t) => t.id === currentTrack?.id);
      const nextIdx = idx + dir;

      if (nextIdx >= activePool.length && activeSection === 'autopilot') {
        fetchDynamicStreamForScene(activeVibe, telemetry, userMoodHint, true);
        return;
      }

      const wrappedIdx = (nextIdx + activePool.length) % activePool.length;
      const nextTrack = activePool[wrappedIdx];
      setCurrentTrack(nextTrack);
      setDurationSec(parseDurationStringToSec(nextTrack.duration));
      setProgressSec(0);
      setIsPlaying(true);

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
      currentTrack,
      activeVibe,
      telemetry,
      userMoodHint,
      systemMediaSync,
      fetchDynamicStreamForScene,
    ]
  );

  const toggleAlwaysOnTop = () => {
    const nextState = !alwaysOnTop;
    setAlwaysOnTop(nextState);
    const w = window as unknown as {
      chrome?: { webview?: { postMessage: (msg: string) => void } };
    };
    if (w.chrome?.webview) {
      w.chrome.webview.postMessage(nextState ? 'SET_TOPMOST:1' : 'SET_TOPMOST:0');
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
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="h-dvh w-full bg-[#080809] text-[#EDE9E8] flex flex-col overflow-hidden select-none">
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
          <div className="bg-[#111012] border border-[#1E1B1D] rounded-lg p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-[#1E1B1D]">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded bg-[#6E1D2F] flex items-center justify-center text-xs font-bold tracking-wider text-white">
                  GV
                </div>
                <span className="text-sm font-semibold tracking-wide text-[#EDE9E8]">
                  GameVibe
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#8C8482]">
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
                      : 'Аккаунт и мои вкусы'}
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

          {/* User-Created Playlists Library + Autonomous Game Telemetry */}
          <div className="hidden lg:flex flex-1 bg-[#111012] border border-[#1E1B1D] rounded-lg p-3.5 flex-col justify-between min-h-0 overflow-y-auto">
            <div className="space-y-2.5">
              <div className="px-1 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C8482]">
                  Мои подборки
                </span>
                <button
                  onClick={() => setCreatingPlaylist((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-[11px] text-[#EDE9E8] transition"
                >
                  <Plus className="w-3 h-3 text-[#B84A62]" />
                  <span>Создать</span>
                </button>
              </div>

              {creatingPlaylist && (
                <form
                  onSubmit={handleCreateUserPlaylist}
                  className="p-2.5 rounded-md bg-[#181518] border border-[#2E272B] space-y-2"
                >
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="Название подборки..."
                    className="w-full px-2.5 py-1.5 rounded bg-[#0E0D0F] border border-[#2A2629] text-xs text-[#EDE9E8] outline-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreatingPlaylist(false)}
                      className="px-2.5 py-1 rounded text-[11px] text-[#8C8482] hover:text-white"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded bg-[#6E1D2F] text-[11px] font-medium text-white"
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              )}

              {userPlaylists.length === 0 ? (
                <div className="p-3.5 rounded-md bg-[#0D0C0E] border border-[#1B181B] text-xs text-[#8C8482] leading-relaxed">
                  Программа работает полностью автономно: сама определяет сцену в игре и ставит полные треки по твоим вкусам.
                  <div className="mt-2 text-[#B84A62]">
                    Свои собственные подборки можно создать кнопкой «Создать».
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {userPlaylists.map((pl) => {
                    const active =
                      activeSection === 'user-playlist' && selectedPlaylistId === pl.id;
                    return (
                      <div
                        key={pl.id}
                        onClick={() => {
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
                            <div className="text-xs font-medium text-[#EDE9E8]">
                              {pl.name}
                            </div>
                            <div className="text-[11px] text-[#8C8482]">
                              Треков: {pl.tracks.length}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUserPlaylist(pl.id);
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
                  <span className="text-[#8C8482]">Определено в игре:</span>
                  <span className="font-semibold text-[#D47A8D]">
                    {currentSceneMeta.shortLabel}
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSection('account')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1A181B] hover:bg-[#242024] border border-[#2A2629] text-xs text-[#EDE9E8] transition"
              >
                <User className="w-3.5 h-3.5 text-[#B84A62]" />
                <span>
                  {accountProfile
                    ? `${accountProfile.username} · Мои вкусы`
                    : 'Создать аккаунт и вкусы'}
                </span>
              </button>

              <button
                onClick={toggleAlwaysOnTop}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition ${
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

                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-[#D47A8D]">
                      <span>
                        АВТОНОМНЫЙ ПОТОК · ОПРЕДЕЛЕНО В ИГРЕ: {currentSceneMeta.label.toUpperCase()}
                      </span>
                    </div>

                    <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-[#EDE9E8]">
                      {currentTrack?.title} — {currentTrack?.artist}
                    </h1>

                    <p className="text-xs text-[#9E9694] max-w-2xl leading-relaxed">
                      Программа работает в фоне, сама считывает происходящее в игре ({telemetry.detectedProcess}) и включает полные версии подходящих песен по твоим вкусам без отвлечения от игрового процесса.
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          fetchDynamicStreamForScene(
                            activeVibe,
                            telemetry,
                            userMoodHint,
                            true
                          )
                        }
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
                  </div>
                </div>

                {/* Action Bar */}
                <div className="px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1B1D] bg-[#131114]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => setIsPlaying((p) => !p)}
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

            {/* 4. USER-CREATED PLAYLIST VIEW */}
            {activeSection === 'user-playlist' && activeUserPlaylist && (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1E1B1D]">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#D47A8D] font-semibold">
                      МОЯ ПОДБОРКА
                    </div>
                    <h2 className="text-2xl font-bold text-[#EDE9E8] mt-1">
                      {activeUserPlaylist.name}
                    </h2>
                    <p className="text-xs text-[#8C8482] mt-1">
                      Программа сама анализирует темп и характер добавленных тобой песен и включает подходящие под текущую ситуацию в игре.
                    </p>
                  </div>

                  <button
                    onClick={() => setUseCustomPlaylistInAutopilot((v) => !v)}
                    className={`px-4 py-2 rounded-md text-xs font-medium transition ${
                      useCustomPlaylistInAutopilot
                        ? 'bg-[#6E1D2F] text-white'
                        : 'bg-[#1A181B] border border-[#2A2629] text-[#EDE9E8]'
                    }`}
                  >
                    {useCustomPlaylistInAutopilot
                      ? 'Активна в Авторежиме'
                      : 'Использовать в Авторежиме'}
                  </button>
                </div>

                {activeUserPlaylist.tracks.length === 0 ? (
                  <div className="p-8 rounded-lg border border-[#1E1B1D] bg-[#0D0C0E] text-center space-y-3">
                    <div className="text-xs text-[#8C8482]">
                      В этой подборке пока нет треков. Найди любимые песни через строку поиска сверху и нажми «В подборку».
                    </div>
                    <button
                      onClick={() => searchInputRef.current?.focus()}
                      className="px-4 py-2 rounded-md bg-[#6E1D2F] text-xs font-medium text-white"
                    >
                      Перейти к поиску музыки
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#181619]">
                    {activeUserPlaylist.tracks.map((track, idx) => (
                      <div
                        key={`${track.id}-${idx}`}
                        onClick={() => playSpecificTrack(track)}
                        className="grid grid-cols-[28px_1fr_40px] sm:grid-cols-[36px_1fr_200px_60px_40px] gap-3 items-center px-3 py-2.5 hover:bg-[#171518] rounded-md cursor-pointer"
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
                        <div className="hidden sm:block text-xs font-mono text-[#8C8482] text-right">
                          {track.duration}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTrackFromUserPlaylist(
                              activeUserPlaylist.id,
                              track.id
                            );
                          }}
                          className="p-1.5 text-[#8C8482] hover:text-[#EA7B93]"
                          title="Убрать из подборки"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
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

            {/* 6. PLAYER INTEGRATIONS SECTION */}
            {activeSection === 'integrations' && (
              <div className="p-6 space-y-5 max-w-2xl">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#EDE9E8]">
                    Связь с внешними плеерами
                  </h2>
                  <p className="text-xs text-[#8C8482]">
                    Помимо встроенного полноразмерного аудио-движка, GameVibe умеет управлять твоим открытым плеером на ПК или вкладкой YouTube Music в браузере.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#161417] border border-[#242023] flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-[#EDE9E8]">
                      Управление системным плеером Windows (Global Media Keys)
                    </div>
                    <p className="text-xs text-[#8C8482]">
                      При смене ситуации в игре GameVibe автоматически переключает трек в твоем запущенном Spotify, Яндекс Музыке, AIMP или браузере.
                    </p>
                  </div>
                  <button
                    onClick={() => setSystemMediaSync((v) => !v)}
                    className={`px-4 py-2 rounded-md text-xs font-medium shrink-0 transition ${
                      systemMediaSync
                        ? 'bg-[#6E1D2F] text-white'
                        : 'bg-[#1F1C20] text-[#8C8482] border border-[#2E292D]'
                    }`}
                  >
                    {systemMediaSync ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Включено
                      </span>
                    ) : (
                      'Включить'
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-lg bg-[#161417] border border-[#242023] flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-[#EDE9E8]">
                      Мост для вкладки YouTube Music (Tampermonkey)
                    </div>
                    <p className="text-xs text-[#8C8482]">
                      Если ты слушаешь музыку через открытую вкладку `music.youtube.com` без подписки, установи этот скрипт — он будет сам переключать песни внутри вкладки под экран игры.
                    </p>
                  </div>
                  <a
                    href="/api/userscript"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-md bg-[#1F1C20] hover:bg-[#2A262B] border border-[#2E292D] text-xs font-medium text-[#EDE9E8] shrink-0 transition"
                  >
                    Скачать скрипт
                  </a>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* BOTTOM PERSISTENT SPOTIFY-STYLE PLAYER BAR (Full Track Duration) */}
      <footer className="h-[84px] shrink-0 bg-[#0B0A0C] border-t border-[#1E1B1D] px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Current Playing Track Info */}
        <div className="flex items-center gap-3 min-w-[140px] w-[35%] sm:w-[30%]">
          <img
            src={currentTrack?.thumbnail || FALLBACK_REAL_TRACKS[0].thumbnail}
            alt={currentTrack?.title || 'cover'}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded object-cover bg-[#18161A] border border-[#262225] shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-[#EDE9E8]">
              {currentTrack?.title}
            </div>
            <div className="text-[11px] sm:text-xs text-[#8C8482]">
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
              onClick={() => setIsPlaying((p) => !p)}
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
            <span className="text-[11px] font-mono text-[#8C8482] w-8 text-right">
              {formatTime(progressSec)}
            </span>
            <input
              type="range"
              min={0}
              max={durationSec || 220}
              step={0.5}
              value={progressSec}
              onChange={(e) => {
                const val = Number(e.target.value);
                setProgressSec(val);
                if (audioRef.current) {
                  audioRef.current.currentTime = val;
                }
              }}
              className="flex-1 h-1 bg-[#221E21] rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-[#8C8482] w-8">
              {formatTime(durationSec)}
            </span>
          </div>
        </div>

        {/* Right: Autonomous Activity + Volume */}
        <div className="hidden sm:flex items-center justify-end gap-4 w-[30%] min-w-[180px]">
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
    </div>
  );
}
