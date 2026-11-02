'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Disc,
  ExternalLink,
  FolderOpen,
  Gamepad2,
  Heart,
  Laptop,
  Monitor,
  Music,
  Pause,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  FALLBACK_REAL_TRACKS,
  INITIAL_GAME_PROFILES,
  VIBE_STATES,
} from '@/lib/defaultData';
import {
  GameRuleProfile,
  TelemetrySnapshot,
  TrackItem,
  VibeStateId,
} from '@/types/vibe';

type MainSection = 'player' | 'saved' | 'games' | 'platforms' | 'local';

const VIBE_ORDER: VibeStateId[] = ['EXPLORE', 'STEALTH', 'COMBAT', 'BOSSFIGHT', 'VICTORY'];

const FEATURED_ARTISTS = [
  'Deftones',
  'Travis Scott',
  'Linkin Park',
  'Скриптонит',
  'Playboi Carti',
  'Kordhell',
  'Rammstein',
  'Кино',
  'Bring Me The Horizon',
  'BONES',
  '$uicideboy$',
  'Slipknot',
  'System Of A Down',
  'Miyagi & Эндшпиль',
  'The Prodigy',
  'Kavinsky',
];

function formatSeconds(sec: number): string {
  if (!sec || !Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GameVibeClient() {
  const [section, setSection] = useState<MainSection>('player');
  const [currentVibe, setCurrentVibe] = useState<VibeStateId>('COMBAT');
  const [tracks, setTracks] = useState<TrackItem[]>(FALLBACK_REAL_TRACKS);
  const [currentTrack, setCurrentTrack] = useState<TrackItem>(FALLBACK_REAL_TRACKS[0]);
  const [savedTracks, setSavedTracks] = useState<TrackItem[]>([]);

  const [gameProfiles, setGameProfiles] = useState<GameRuleProfile[]>(INITIAL_GAME_PROFILES);
  const [activeGameId, setActiveGameId] = useState<string>('universal');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeArtistFilter, setActiveArtistFilter] = useState<string>('');
  const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(false);

  // Playback state (Real HTML5 Audio + optional YouTube Full Embed)
  const [playerMode, setPlayerMode] = useState<'native-audio' | 'youtube-full'>('native-audio');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Local PC Music folder state
  const [localDirInput, setLocalDirInput] = useState<string>('');
  const [localScanDir, setLocalScanDir] = useState<string>('');
  const [localTracks, setLocalTracks] = useState<TrackItem[]>([]);
  const [isScanningLocal, setIsScanningLocal] = useState<boolean>(false);

  // Real Windows Process & Screen Telemetry
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    timestamp: Date.now(),
    activeWindowTitle: 'Определение активного окна...',
    detectedProcess: 'explorer.exe',
    runningWindows: [],
    motionDelta: 15,
    crimsonIndex: 10,
    luminance: 45,
    compositeIntensity: 20,
    inferredVibe: 'EXPLORE',
  });
  const [autoAdaptEnabled, setAutoAdaptEnabled] = useState<boolean>(true);
  const [isPinnedOverlay, setIsPinnedOverlay] = useState<boolean>(false);

  // New Game Rule Modal
  const [isAddGameOpen, setIsAddGameOpen] = useState<boolean>(false);
  const [newGameName, setNewGameName] = useState<string>('');
  const [newGameExe, setNewGameExe] = useState<string>('');
  const [newGameExploreArtists, setNewGameExploreArtists] = useState<string>('Deftones, Kavinsky, Скриптонит');
  const [newGameCombatArtists, setNewGameCombatArtists] = useState<string>('Travis Scott, Linkin Park, Kordhell');

  const lastAutoSwitchRef = useRef<number>(0);
  const activeGameProfile =
    gameProfiles.find((g) => g.id === activeGameId) || gameProfiles[0];

  // Load saved state from disk
  useEffect(() => {
    fetch('/api/presets')
      .then((r) => r.json())
      .then((data) => {
        if (data?.gameProfiles?.length) setGameProfiles(data.gameProfiles);
        if (data?.activeGameProfileId) setActiveGameId(data.activeGameProfileId);
        if (Array.isArray(data?.savedTracks)) setSavedTracks(data.savedTracks);
      })
      .catch(() => {});
  }, []);

  // Load real tracks from API
  const loadTracks = useCallback(
    async (vibe: VibeStateId, query = '', mode: 'seeds' | 'search' = 'seeds') => {
      setIsLoadingTracks(true);
      try {
        const url = `/api/ytmusic?vibe=${encodeURIComponent(vibe)}&mode=${mode}&q=${encodeURIComponent(
          query
        )}`;
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data?.tracks) && data.tracks.length > 0) {
          const unique = data.tracks.filter(
            (item: TrackItem, index: number, self: TrackItem[]) =>
              index === self.findIndex((t) => t.title === item.title && t.artist === item.artist)
          );
          setTracks(unique);
          setCurrentTrack(unique[0]);
        }
      } catch {
        // keep current tracks
      } finally {
        setIsLoadingTracks(false);
      }
    },
    []
  );

  // Initial load of real artist tracks on mount
  useEffect(() => {
    lastAutoSwitchRef.current = Date.now();
    loadTracks('COMBAT', '', 'seeds');
  }, [loadTracks]);

  // Sync HTML5 Audio element when track or play state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playerMode !== 'native-audio') return;

    if (currentTrack.previewUrl) {
      if (audio.src !== currentTrack.previewUrl) {
        audio.src = currentTrack.previewUrl;
        audio.load();
      }
      if (isPlaying) {
        audio.play().catch(() => {
          setIsPlaying(false);
        });
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying, playerMode]);

  // Sync with browser tab bridge
  useEffect(() => {
    if (!currentTrack?.videoId) return;
    fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SYNC_BRIDGE',
        bridgeTrack: {
          videoId: currentTrack.videoId,
          title: currentTrack.title,
          artist: currentTrack.artist,
          vibe: currentVibe,
          volume: isMuted ? 0 : volume,
        },
      }),
    }).catch(() => {});
  }, [currentTrack, currentVibe, isMuted, volume]);

  // Poll real Windows processes and screen state
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/telemetry');
        const snap: TelemetrySnapshot = await res.json();
        setTelemetry(snap);

        // Auto-match running game profile if executable matches
        const matchedGame = gameProfiles.find(
          (g) =>
            g.executable !== '*' &&
            g.executable
              .toLowerCase()
              .split(',')
              .some((exe) => snap.detectedProcess.toLowerCase().includes(exe.trim()))
        );
        if (matchedGame && matchedGame.id !== activeGameId) {
          setActiveGameId(matchedGame.id);
        }

        // Auto-switch vibe if enabled and 12s cooldown elapsed
        const now = Date.now();
        if (
          autoAdaptEnabled &&
          snap.inferredVibe &&
          snap.inferredVibe !== currentVibe &&
          now - lastAutoSwitchRef.current > 12000
        ) {
          lastAutoSwitchRef.current = now;
          setCurrentVibe(snap.inferredVibe);
          loadTracks(snap.inferredVibe, '', 'seeds');
        }
      } catch {
        // ignore
      }
    };

    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [autoAdaptEnabled, currentVibe, gameProfiles, activeGameId, loadTracks]);

  const handleSelectVibe = useCallback(
    (vibeId: VibeStateId) => {
      lastAutoSwitchRef.current = Date.now();
      setCurrentVibe(vibeId);
      setActiveArtistFilter('');
      loadTracks(vibeId, '', 'seeds');
    },
    [loadTracks]
  );

  // Global Hotkeys (Alt+1..5)
  useEffect(() => {
    const win = window as unknown as {
      gamevibeDesktop?: {
        onGlobalHotkeyVibe?: (cb: (v: VibeStateId) => void) => void;
        onOverlayModeChange?: (cb: (pinned: boolean) => void) => void;
      };
    };

    if (win.gamevibeDesktop?.onGlobalHotkeyVibe) {
      win.gamevibeDesktop.onGlobalHotkeyVibe((vibeId) => handleSelectVibe(vibeId));
    }
    if (win.gamevibeDesktop?.onOverlayModeChange) {
      win.gamevibeDesktop.onOverlayModeChange((pinned) => setIsPinnedOverlay(pinned));
    }

    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const map: Record<string, VibeStateId> = {
        Digit1: 'EXPLORE',
        Digit2: 'STEALTH',
        Digit3: 'COMBAT',
        Digit4: 'BOSSFIGHT',
        Digit5: 'VICTORY',
      };
      if (map[e.code]) {
        e.preventDefault();
        handleSelectVibe(map[e.code]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSelectVibe]);

  const handleArtistChipClick = (artist: string) => {
    if (activeArtistFilter === artist) {
      setActiveArtistFilter('');
      loadTracks(currentVibe, '', 'seeds');
    } else {
      setActiveArtistFilter(artist);
      setSearchQuery(artist);
      loadTracks(currentVibe, artist, 'search');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadTracks(currentVibe, '', 'seeds');
      return;
    }
    setActiveArtistFilter('');
    loadTracks(currentVibe, searchQuery.trim(), 'search');
  };

  const handlePlayTrack = (track: TrackItem) => {
    if (currentTrack.id === track.id) {
      setIsPlaying((p) => !p);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleNextTrack = () => {
    const list = section === 'saved' ? savedTracks : section === 'local' ? localTracks : tracks;
    if (list.length === 0) return;
    const idx = list.findIndex((t) => t.id === currentTrack.id);
    const next = list[(idx + 1) % list.length];
    if (next) {
      setCurrentTrack(next);
      setIsPlaying(true);
    }
  };

  const handlePrevTrack = () => {
    const list = section === 'saved' ? savedTracks : section === 'local' ? localTracks : tracks;
    if (list.length === 0) return;
    const idx = list.findIndex((t) => t.id === currentTrack.id);
    const prev = list[(idx - 1 + list.length) % list.length];
    if (prev) {
      setCurrentTrack(prev);
      setIsPlaying(true);
    }
  };

  const handleToggleSaveTrack = async (track: TrackItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'TOGGLE_SAVE_TRACK', track }),
    });
    const data = await res.json();
    if (Array.isArray(data?.store?.savedTracks)) {
      setSavedTracks(data.store.savedTracks);
    }
  };

  // Real platform deep-link & desktop launcher
  const openTrackInPlatform = async (
    platform: 'ytmusic' | 'spotify-app' | 'spotify-web' | 'yandex' | 'soundcloud' | 'vkmusic',
    track: TrackItem,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    const q = encodeURIComponent(`${track.artist} ${track.title}`);
    const urls: Record<string, string> = {
      ytmusic: track.videoId
        ? `https://music.youtube.com/watch?v=${track.videoId}`
        : `https://music.youtube.com/search?q=${q}`,
      'spotify-app': `spotify:search:${q}`,
      'spotify-web': `https://open.spotify.com/search/${q}`,
      yandex: `https://music.yandex.ru/search?text=${q}`,
      soundcloud: `https://soundcloud.com/search?q=${q}`,
      vkmusic: `https://vk.com/audio?q=${q}`,
    };

    const targetUrl = urls[platform];
    await fetch('/api/system-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'OPEN_PLATFORM', url: targetUrl }),
    }).catch(() => {
      window.open(targetUrl, '_blank');
    });
  };

  // Real Windows OS Media Keys controller
  const sendWindowsMediaKey = async (
    command: 'PLAY_PAUSE' | 'NEXT_TRACK' | 'PREV_TRACK' | 'VOL_UP' | 'VOL_DOWN' | 'VOL_MUTE'
  ) => {
    await fetch('/api/system-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    }).catch(() => {});
  };

  // Scan Local PC Music Folder
  const scanLocalFolder = useCallback(async (customDir?: string) => {
    setIsScanningLocal(true);
    try {
      const q = customDir ? `?dir=${encodeURIComponent(customDir)}` : '';
      const res = await fetch(`/api/local-music${q}`);
      const data = await res.json();
      setLocalScanDir(data.directory || '');
      if (Array.isArray(data.tracks)) {
        setLocalTracks(data.tracks);
      }
    } catch {
      // ignore
    } finally {
      setIsScanningLocal(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'local' && localTracks.length === 0) {
      scanLocalFolder();
    }
  }, [section, localTracks.length, scanLocalFolder]);

  const handleToggleAlwaysOnTop = async () => {
    const win = window as unknown as {
      gamevibeDesktop?: { toggleAlwaysOnTop?: () => Promise<boolean> };
    };
    if (win.gamevibeDesktop?.toggleAlwaysOnTop) {
      const next = await win.gamevibeDesktop.toggleAlwaysOnTop();
      setIsPinnedOverlay(next);
    } else {
      setIsPinnedOverlay((p) => !p);
    }
  };

  const handleAddGameRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameName.trim()) return;
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ADD_GAME_PROFILE',
        gameProfile: {
          gameTitle: newGameName.trim(),
          shortLabel: newGameName.trim().slice(0, 20),
          executable: newGameExe.trim() || 'game.exe',
          genreFocus: `${newGameExploreArtists} / ${newGameCombatArtists}`,
          vibeArtistSeeds: {
            EXPLORE: newGameExploreArtists,
            STEALTH: newGameExploreArtists,
            COMBAT: newGameCombatArtists,
            BOSSFIGHT: newGameCombatArtists,
            VICTORY: newGameExploreArtists,
          },
        },
      }),
    });
    const data = await res.json();
    if (data?.store?.gameProfiles) {
      setGameProfiles(data.store.gameProfiles);
      setActiveGameId(data.store.activeGameProfileId);
    }
    setIsAddGameOpen(false);
    setNewGameName('');
    setNewGameExe('');
  };

  const activeVibeConfig = VIBE_STATES[currentVibe];
  const displayedTracks = section === 'saved' ? savedTracks : section === 'local' ? localTracks : tracks;

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#09090B] text-zinc-100 flex flex-col justify-between select-none">
      {/* Hidden Native HTML5 Audio Element for instant ad-free playback */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 30)}
        onEnded={handleNextTrack}
      />

      {/* =====================================================================
          TOP WINDOW BAR (CLEAN, FLAT, UNDERSTATED)
      ===================================================================== */}
      <header
        className="min-h-[42px] py-1.5 shrink-0 border-b border-zinc-800/80 bg-[#09090B] px-4 flex flex-wrap items-center justify-between gap-2 z-30"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Disc className={`w-4 h-4 text-[#FF6A00] ${isPlaying ? 'animate-spin' : ''}`} />
            <span className="font-bold text-sm tracking-tight text-white">GameVibe</span>
          </div>

          <span className="hidden sm:inline text-zinc-700">|</span>

          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Активное окно ПК:</span>
            <span className="text-zinc-200 font-medium">{telemetry.detectedProcess}</span>
          </div>
        </div>

        <div
          className="flex items-center gap-2 lg:pr-28"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={() => setAutoAdaptEnabled((a) => !a)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              autoAdaptEnabled
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
            }`}
          >
            {autoAdaptEnabled ? 'Авто-подбор: ВКЛ' : 'Авто-подбор: ВЫКЛ'}
          </button>

          <button
            type="button"
            onClick={handleToggleAlwaysOnTop}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isPinnedOverlay
                ? 'bg-[#FF6A00] text-black font-semibold'
                : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            <Pin className="w-3 h-3" />
            <span>Поверх игры</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN 3-COLUMN DESKTOP WORKSPACE
      ===================================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* -------------------------------------------------------------------
            LEFT SIDEBAR (SPOTIFY / APPLE MUSIC STYLE)
        ------------------------------------------------------------------- */}
        <aside className="lg:w-[230px] shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-[#0E0E11] flex flex-col justify-between p-3 gap-4">
          <div className="space-y-5">
            {/* Primary Navigation */}
            <nav className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-1 gap-1" aria-label="Меню">
              {[
                { id: 'player', label: 'Музыка и Поток', icon: Music },
                {
                  id: 'saved',
                  label: `Мне нравится (${savedTracks.length})`,
                  icon: Heart,
                },
                { id: 'games', label: 'Игры и Правила', icon: Gamepad2 },
                { id: 'platforms', label: 'Платформы и ПК', icon: Laptop },
                { id: 'local', label: 'Локальные файлы', icon: FolderOpen },
              ].map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id as MainSection)}
                    className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                      active
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#FF6A00]' : ''}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Game Profile Selector */}
            <div className="hidden lg:block space-y-2 pt-3 border-t border-zinc-800/80">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-medium text-zinc-500">Профиль игры</span>
                <button
                  type="button"
                  onClick={() => setIsAddGameOpen(true)}
                  className="text-xs text-[#FF6A00] hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Добавить</span>
                </button>
              </div>

              <div className="space-y-1">
                {gameProfiles.map((g) => {
                  const active = g.id === activeGameId;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setActiveGameId(g.id);
                        loadTracks(currentVibe, g.vibeArtistSeeds[currentVibe], 'search');
                      }}
                      className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors flex items-center justify-between ${
                        active
                          ? 'bg-zinc-800/90 text-white'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-medium leading-snug">{g.shortLabel}</div>
                        <div className="text-[11px] text-zinc-500 leading-tight mt-0.5">
                          {g.genreFocus}
                        </div>
                      </div>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Real Detected Windows Processes at Bottom of Sidebar */}
          <div className="hidden lg:block pt-3 border-t border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
              <span>Окна Windows сейчас</span>
              <span className="font-mono">{telemetry.runningWindows.length}</span>
            </div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
              {telemetry.runningWindows.length > 0 ? (
                telemetry.runningWindows.slice(0, 5).map((win) => (
                  <div
                    key={`${win.pid}-${win.processName}`}
                    className="px-2 py-1 rounded bg-zinc-900/70 text-[11px] flex items-center justify-between gap-2"
                  >
                    <span className="text-zinc-300 font-mono">{win.processName}</span>
                    <span className="text-zinc-500">{win.windowTitle.slice(0, 14)}</span>
                  </div>
                ))
              ) : (
                <div className="px-2 py-1 text-[11px] text-zinc-500">
                  {telemetry.detectedProcess}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* -------------------------------------------------------------------
            CENTER WORKSPACE (TRACK TABLE / GAMES / PLATFORMS / LOCAL)
        ------------------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-w-0">
          {(section === 'player' || section === 'saved') && (
            <>
              {/* Top Search & Game Mood Filter Bar */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Search Input */}
                  <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-xl">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Артист или трек (Deftones, Travis Scott, Скриптонит, Linkin Park, Kordhell)..."
                        className="w-full min-h-[40px] pl-10 pr-3 py-2 rounded-lg bg-[#141417] border border-zinc-800 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                      />
                    </div>
                    <button
                      type="submit"
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF852B] text-black font-semibold text-xs shrink-0"
                    >
                      Найти
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveArtistFilter('');
                        loadTracks(currentVibe, '', 'seeds');
                      }}
                      className="min-h-[40px] px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs flex items-center gap-1.5 shrink-0"
                      title="Обновить подборку"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTracks ? 'animate-spin' : ''}`} />
                    </button>
                  </form>

                  {/* Scene / Vibe Switcher */}
                  <div className="flex flex-wrap items-center gap-1 bg-[#141417] p-1 rounded-lg border border-zinc-800">
                    {VIBE_ORDER.map((vibeId, idx) => {
                      const cfg = VIBE_STATES[vibeId];
                      const active = currentVibe === vibeId;
                      return (
                        <button
                          key={vibeId}
                          type="button"
                          onClick={() => handleSelectVibe(vibeId)}
                          className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                            active
                              ? 'bg-zinc-800 text-white font-semibold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title={`Горячая клавиша в игре: Alt+${idx + 1}`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cfg.accentHex }}
                          />
                          <span>{cfg.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Artist Pills (Real Musicians, Rappers, Rockers) */}
                {section === 'player' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveArtistFilter('');
                        setSearchQuery('');
                        loadTracks(currentVibe, '', 'seeds');
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                        activeArtistFilter === ''
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#141417] text-zinc-300 hover:bg-zinc-800 border border-zinc-800/80'
                      }`}
                    >
                      Подборка под момент
                    </button>
                    {FEATURED_ARTISTS.map((artist) => {
                      const active = activeArtistFilter === artist;
                      return (
                        <button
                          key={artist}
                          type="button"
                          onClick={() => handleArtistChipClick(artist)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                            active
                              ? 'bg-[#FF6A00] text-black font-semibold'
                              : 'bg-[#141417] text-zinc-300 hover:bg-zinc-800 border border-zinc-800/80'
                          }`}
                        >
                          {artist}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section Header */}
              <div className="flex items-baseline justify-between border-b border-zinc-800/80 pb-3">
                <div>
                  <h1 className="text-lg font-bold text-white">
                    {section === 'saved'
                      ? 'Сохраненные треки'
                      : activeArtistFilter
                      ? `Артист: ${activeArtistFilter}`
                      : `${activeVibeConfig.label} — ${activeGameProfile.shortLabel}`}
                  </h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {section === 'saved'
                      ? 'Ваша локальная подборка любимых треков'
                      : activeVibeConfig.description}
                  </p>
                </div>
                <span className="text-xs font-mono text-zinc-500">
                  {displayedTracks.length} треков
                </span>
              </div>

              {/* Clean Spotify / Apple Music Track Table */}
              {displayedTracks.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  {section === 'saved'
                    ? 'Вы еще не добавили треки в избранное. Нажмите на иконку сердечка рядом с любой песней.'
                    : 'Треки загружаются...'}
                </div>
              ) : (
                <div className="space-y-1">
                  {displayedTracks.map((track, idx) => {
                    const isCurrent = currentTrack.id === track.id;
                    const isSaved = savedTracks.some((s) => s.id === track.id);
                    return (
                      <div
                        key={track.id}
                        onClick={() => handlePlayTrack(track)}
                        className={`group px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-zinc-800/90 text-white'
                            : 'hover:bg-zinc-900/80 text-zinc-300'
                        }`}
                      >
                        {/* Left: Index + Artwork + Title & Artist */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-5 text-center text-xs font-mono text-zinc-500 shrink-0">
                            {isCurrent && isPlaying ? (
                              <span className="text-[#FF6A00] font-bold">▶</span>
                            ) : (
                              idx + 1
                            )}
                          </span>

                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-11 h-11 rounded-md object-cover shrink-0 bg-zinc-900 border border-zinc-800"
                          />

                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm font-semibold leading-snug ${
                                isCurrent ? 'text-[#FF6A00]' : 'text-white'
                              }`}
                            >
                              {track.title}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {track.artist} · <span className="text-zinc-500">{track.album}</span>
                            </div>
                          </div>
                        </div>

                        {/* Middle: Genre Pill */}
                        <div className="hidden md:flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                            {track.genreTag}
                          </span>
                        </div>

                        {/* Right: Direct Platform Launchers + Heart + Duration */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => openTrackInPlatform('ytmusic', track, e)}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-800"
                            title="Открыть в YouTube Music"
                          >
                            YTM
                          </button>
                          <button
                            type="button"
                            onClick={(e) => openTrackInPlatform('spotify-app', track, e)}
                            className="hidden sm:inline-flex px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-800"
                            title="Открыть в приложении Spotify"
                          >
                            Spotify
                          </button>
                          <button
                            type="button"
                            onClick={(e) => openTrackInPlatform('yandex', track, e)}
                            className="hidden sm:inline-flex px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-800"
                            title="Открыть в Яндекс Музыке"
                          >
                            Я.Музыка
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleToggleSaveTrack(track, e)}
                            className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white"
                            aria-label="Сохранить трек"
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                isSaved ? 'fill-[#FF6A00] text-[#FF6A00]' : ''
                              }`}
                            />
                          </button>

                          <span className="w-11 text-right text-xs font-mono text-zinc-500">
                            {track.duration}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* =================================================================
              SECTION: GAMES & RULES (МОИ ИГРЫ И ПРАВИЛА АВТОПОДБОРА)
          ================================================================= */}
          {section === 'games' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h1 className="text-lg font-bold text-white">Правила музыки под игры</h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Настройте, каких артистов и какие жанры включать при запуске конкретных игр (.exe).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddGameOpen(true)}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#FF6A00] text-black font-semibold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить игру</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameProfiles.map((g) => {
                  const isSelected = g.id === activeGameId;
                  return (
                    <div
                      key={g.id}
                      className={`rounded-xl p-4 bg-[#121215] border flex flex-col justify-between gap-4 ${
                        isSelected ? 'border-[#FF6A00]' : 'border-zinc-800'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-zinc-400">
                            Процесс: {g.executable}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-[#FF6A00]/15 text-[#FF6A00] font-medium">
                              Активен
                            </span>
                          )}
                        </div>
                        <h2 className="text-base font-bold text-white">{g.gameTitle}</h2>
                        <p className="text-xs text-zinc-400">Жанры: {g.genreFocus}</p>

                        <div className="pt-2 space-y-1.5 text-xs border-t border-zinc-800/80">
                          <div>
                            <span className="text-zinc-500">Спокойно: </span>
                            <span className="text-zinc-300">{g.vibeArtistSeeds.EXPLORE}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Экшен: </span>
                            <span className="text-zinc-300">{g.vibeArtistSeeds.COMBAT}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Босс / Метал: </span>
                            <span className="text-zinc-300">{g.vibeArtistSeeds.BOSSFIGHT}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveGameId(g.id);
                          setSection('player');
                          loadTracks(currentVibe, g.vibeArtistSeeds[currentVibe], 'search');
                        }}
                        className="w-full min-h-[38px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium"
                      >
                        Применить и загрузить треки
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              SECTION: PLATFORMS & WINDOWS SYSTEM CONTROLLER
          ================================================================= */}
          {section === 'platforms' && (
            <div className="space-y-6">
              <div className="border-b border-zinc-800 pb-4">
                <h1 className="text-lg font-bold text-white">
                  Интеграция с музыкальными платформами и плеерами Windows
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Прямое управление любым установленным на ПК плеером (Spotify, Яндекс Музыка, YouTube Music, VK Музыка, AIMP) и быстрый переход к текущему треку.
                </p>
              </div>

              {/* 1. Native Windows System Media Controller */}
              <div className="rounded-xl bg-[#121215] border border-zinc-800 p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Системный контроллер плееров Windows (Global Media Keys API)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Отправляет аппаратные команды воспроизведения напрямую в Windows. Если у вас в фоне запущена Яндекс Музыка, Spotify Desktop или вкладка браузера — эти кнопки управляют ими напрямую:
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => sendWindowsMediaKey('PREV_TRACK')}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center gap-2"
                  >
                    <SkipBack className="w-4 h-4" />
                    <span>Предыдущий трек в Windows</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sendWindowsMediaKey('PLAY_PAUSE')}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF852B] text-xs font-semibold text-black flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play / Pause системного плеера</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sendWindowsMediaKey('NEXT_TRACK')}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center gap-2"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Следующий трек в Windows</span>
                  </button>
                </div>
              </div>

              {/* 2. Platform Cards with Real Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    id: 'ytmusic' as const,
                    title: 'YouTube Music / Metrolist',
                    desc: 'Поиск и воспроизведение без подписки через протокол InnerTube + синхронизация с открытой вкладкой браузера через Userscript.',
                    btnLabel: `Открыть «${currentTrack.artist} — ${currentTrack.title}» в YTM`,
                  },
                  {
                    id: 'spotify-app' as const,
                    title: 'Spotify Desktop (Протокол spotify:)',
                    desc: 'Открывает найденный под игровой момент трек или артиста напрямую в установленном десктопном клиенте Spotify для Windows.',
                    btnLabel: 'Запустить текущий трек в Spotify App',
                  },
                  {
                    id: 'yandex' as const,
                    title: 'Яндекс Музыка',
                    desc: 'Мгновенный поиск и запуск трека в Яндекс Музыке + управление через системные медиа-клавиши Windows.',
                    btnLabel: 'Открыть текущий трек в Яндекс Музыке',
                  },
                  {
                    id: 'soundcloud' as const,
                    title: 'SoundCloud',
                    desc: 'Прямой переход к андерграундным ремиксам, фонку и сетам на SoundCloud без ограничений.',
                    btnLabel: 'Найти трек на SoundCloud',
                  },
                  {
                    id: 'vkmusic' as const,
                    title: 'VK Музыка',
                    desc: 'Быстрый запуск аудиозаписи в каталоге ВКонтакте / VK Музыки.',
                    btnLabel: 'Открыть трек в VK Музыке',
                  },
                ].map((plat) => (
                  <div
                    key={plat.id}
                    className="rounded-xl bg-[#121215] border border-zinc-800 p-4 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-bold text-white">{plat.title}</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">{plat.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openTrackInPlatform(plat.id, currentTrack)}
                      className="min-h-[38px] px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center justify-between"
                    >
                      <span>{plat.btnLabel}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    </button>
                  </div>
                ))}

                {/* Browser Userscript Card */}
                <div className="rounded-xl bg-[#121215] border border-zinc-800 p-4 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-white">
                      Авто-мост для вкладки браузера (Userscript)
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Если у вас открыта вкладка <code className="text-zinc-200">music.youtube.com</code> в браузере, установите этот скрипт в Tampermonkey — он сам переключает песни при смене сцены в игре.
                    </p>
                  </div>
                  <a
                    href="/api/userscript"
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[38px] px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center justify-between"
                  >
                    <span>Установить gamevibe-ytm-bridge.user.js</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              SECTION: LOCAL PC AUDIO FILES (ЛОКАЛЬНАЯ МУЗЫКА НА ПК)
          ================================================================= */}
          {section === 'local' && (
            <div className="space-y-5">
              <div className="border-b border-zinc-800 pb-4 space-y-3">
                <div>
                  <h1 className="text-lg font-bold text-white">
                    Локальные аудиофайлы на вашем ПК
                  </h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Сканирует папку с музыкой на диске (.mp3, .flac, .wav, .m4a, .ogg) и воспроизводит файлы напрямую без интернета.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    scanLocalFolder(localDirInput.trim());
                  }}
                  className="flex flex-wrap gap-2 max-w-xl"
                >
                  <input
                    type="text"
                    value={localDirInput}
                    onChange={(e) => setLocalDirInput(e.target.value)}
                    placeholder={localScanDir || 'Путь к папке (например, D:\\Music)...'}
                    className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#141417] border border-zinc-800 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#FF6A00] text-black font-semibold text-xs"
                  >
                    {isScanningLocal ? 'Сканирование...' : 'Сканировать папку'}
                  </button>
                </form>
                {localScanDir && (
                  <div className="text-xs font-mono text-zinc-500">
                    Текущая папка: {localScanDir} (найдено файлов: {localTracks.length})
                  </div>
                )}
              </div>

              {localTracks.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-500">
                  В папке «{localScanDir || 'Music'}» пока не найдено аудиофайлов (.mp3 / .flac). Укажите путь к вашей папке с музыкой выше.
                </div>
              ) : (
                <div className="space-y-1">
                  {localTracks.map((track, idx) => (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className="px-3 py-2.5 rounded-lg hover:bg-zinc-900 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-zinc-500 w-5">{idx + 1}</span>
                        <div>
                          <div className="text-sm font-medium text-white">{track.title}</div>
                          <div className="text-xs text-zinc-500">{track.localPath}</div>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-zinc-400">{track.duration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* -------------------------------------------------------------------
            RIGHT INSPECTOR DOCK: NOW PLAYING + ACTIVE PLAYER + WINDOW SENSOR
        ------------------------------------------------------------------- */}
        <aside className="lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800/80 bg-[#0E0E11] flex flex-col justify-between p-4 gap-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Switch between Instant Native Audio & Full YouTube Player */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Сейчас играет</span>
              <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPlayerMode('native-audio')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    playerMode === 'native-audio'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  HQ Аудио
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerMode('youtube-full')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    playerMode === 'youtube-full'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  YouTube Клип
                </button>
              </div>
            </div>

            {/* Cover Art OR YouTube Embed */}
            {playerMode === 'native-audio' ? (
              <div className="relative aspect-square w-full max-w-[240px] mx-auto rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-video w-full">
                <iframe
                  key={currentTrack.videoId}
                  title={currentTrack.title}
                  src={`https://www.youtube.com/embed/${
                    currentTrack.videoId || 'XOzs1FehYOA'
                  }?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&rel=0`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {/* Track Title & Artist */}
            <div className="space-y-1">
              <div className="text-base font-bold text-white leading-snug">
                {currentTrack.title}
              </div>
              <div className="text-xs text-zinc-400">
                {currentTrack.artist} · {currentTrack.album}
              </div>
            </div>

            {/* Quick Platform Launch Buttons for Current Track */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-500">Открыть этот трек в:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => openTrackInPlatform('ytmusic', currentTrack)}
                  className="px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center justify-between"
                >
                  <span>YouTube Music</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </button>
                <button
                  type="button"
                  onClick={() => openTrackInPlatform('spotify-app', currentTrack)}
                  className="px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center justify-between"
                >
                  <span>Spotify App</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </button>
                <button
                  type="button"
                  onClick={() => openTrackInPlatform('yandex', currentTrack)}
                  className="px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center justify-between"
                >
                  <span>Яндекс Музыка</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </button>
                <button
                  type="button"
                  onClick={() => openTrackInPlatform('soundcloud', currentTrack)}
                  className="px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center justify-between"
                >
                  <span>SoundCloud</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Real Screen & Window Sensor Card */}
          <div className="rounded-xl bg-[#141417] border border-zinc-800 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-[#FF6A00]" />
                <span>Анализ экрана ПК</span>
              </span>
              <span className="font-mono text-zinc-200">
                {VIBE_STATES[currentVibe].shortLabel}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>Динамика кадра</span>
                <span className="font-mono text-zinc-200">{telemetry.motionDelta}%</span>
              </div>
              <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-[#FF6A00] transition-all duration-500"
                  style={{ width: `${telemetry.motionDelta}%` }}
                />
              </div>

              <div className="flex justify-between text-zinc-400 pt-1">
                <span>Яркость сцены</span>
                <span className="font-mono text-zinc-200">{telemetry.luminance}%</span>
              </div>
              <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-500"
                  style={{ width: `${telemetry.luminance}%` }}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* =====================================================================
          BOTTOM PLAYER BAR (CLEAN SPOTIFY DESKTOP TRANSPORT)
      ===================================================================== */}
      <footer className="h-20 shrink-0 border-t border-zinc-800 bg-[#0E0E11] px-4 sm:px-6 flex items-center justify-between gap-4 z-30">
        {/* Left: Current Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-[260px] sm:w-[300px]">
          <img
            src={currentTrack.thumbnail}
            alt={currentTrack.title}
            className="w-12 h-12 rounded-md object-cover shrink-0 bg-zinc-900 border border-zinc-800"
          />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-white leading-tight">
              {currentTrack.title}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">{currentTrack.artist}</div>
          </div>
        </div>

        {/* Center: Play/Pause/Prev/Next + Real Seek Bar */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-lg">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handlePrevTrack}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Предыдущий трек"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="w-9 h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-transform active:scale-95"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNextTrack}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Следующий трек"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 w-full">
            <span className="text-[11px] font-mono text-zinc-500 w-8 text-right">
              {formatSeconds(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step={0.5}
              value={currentTime}
              onChange={(e) => {
                const nextTime = Number(e.target.value);
                setCurrentTime(nextTime);
                if (audioRef.current) {
                  audioRef.current.currentTime = nextTime;
                }
              }}
              className="flex-1 h-1 accent-[#FF6A00] cursor-pointer"
              aria-label="Позиция трека"
            />
            <span className="text-[11px] font-mono text-zinc-500 w-8">
              {formatSeconds(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume Slider */}
        <div className="hidden md:flex items-center justify-end gap-2.5 w-[240px]">
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            className="p-2 text-zinc-400 hover:text-white"
            aria-label="Звук"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
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
            className="w-24 accent-white cursor-pointer"
            aria-label="Громкость"
          />
          <span className="text-xs font-mono text-zinc-400 w-9">
            {isMuted ? '0%' : `${volume}%`}
          </span>
        </div>
      </footer>

      {/* Add Game Rule Modal */}
      {isAddGameOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setIsAddGameOpen(false)}
        >
          <div
            className="max-w-md w-full rounded-xl bg-[#141417] border border-zinc-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Добавить правило для игры</h2>
              <button
                type="button"
                onClick={() => setIsAddGameOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddGameRule} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Название игры</label>
                <input
                  type="text"
                  required
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder="Например: GTA V / Deadlock"
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#09090B] border border-zinc-800 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Процесс (.exe)</label>
                <input
                  type="text"
                  value={newGameExe}
                  onChange={(e) => setNewGameExe(e.target.value)}
                  placeholder="GTA5.exe"
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#09090B] border border-zinc-800 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Артисты для спокойной игры
                </label>
                <input
                  type="text"
                  value={newGameExploreArtists}
                  onChange={(e) => setNewGameExploreArtists(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#09090B] border border-zinc-800 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Артисты для экшена и боя
                </label>
                <input
                  type="text"
                  value={newGameCombatArtists}
                  onChange={(e) => setNewGameCombatArtists(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#09090B] border border-zinc-800 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddGameOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#FF6A00] text-black font-semibold text-xs"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
