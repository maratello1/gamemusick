'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Pin,
  Search,
  Disc,
  FolderOpen,
  Radio,
  Sliders,
  ExternalLink,
  Check,
  RefreshCw,
} from 'lucide-react';
import { FALLBACK_REAL_TRACKS, GENRE_PACKS, GenrePackId, VIBE_STATES } from '@/lib/defaultData';
import { TelemetrySnapshot, TrackItem, VibeStateId } from '@/types/vibe';

const SCENE_ORDER: VibeStateId[] = ['EXPLORE', 'STEALTH', 'COMBAT', 'BOSSFIGHT'];

const SCENE_BADGE_STYLE: Record<VibeStateId, { label: string; bg: string; text: string; border: string }> = {
  EXPLORE: {
    label: 'Спокойно',
    bg: '#161F1C',
    text: '#86B8A7',
    border: '#233630',
  },
  STEALTH: {
    label: 'Напряжение',
    bg: '#161B24',
    text: '#8CA6C9',
    border: '#243042',
  },
  COMBAT: {
    label: 'Экшен / Бой',
    bg: '#281419',
    text: '#D47A8D',
    border: '#4A202B',
  },
  BOSSFIGHT: {
    label: 'Пик боя',
    bg: '#36131C',
    text: '#EE95A8',
    border: '#682133',
  },
  VICTORY: {
    label: 'После боя',
    bg: '#1F1B16',
    text: '#C9B08C',
    border: '#383024',
  },
};

const WAVE_META: Record<
  GenrePackId,
  { shortTitle: string; subtitle: string; cover: string }
> = {
  mix: {
    shortTitle: 'Все лучшее (Микс)',
    subtitle: 'Deftones, Travis Scott, Кино, Prodigy',
    cover: 'https://i.ytimg.com/vi/sTPn4Jlrjb0/hqdefault.jpg',
  },
  'rap-phonk': {
    shortTitle: 'Рэп, Трэп и Фонк',
    subtitle: 'Playboi Carti, Скриптонит, BONES',
    cover: 'https://i.ytimg.com/vi/B9synWjqBn8/hqdefault.jpg',
  },
  'rock-metal': {
    shortTitle: 'Рок и Метал',
    subtitle: 'Deftones, Linkin Park, Rammstein',
    cover: 'https://i.ytimg.com/vi/XOzs1FehYOA/hqdefault.jpg',
  },
  electronic: {
    shortTitle: 'Электроника и Синт',
    subtitle: 'The Prodigy, Kavinsky, Pendulum',
    cover: 'https://i.ytimg.com/vi/MV_3Dpw-BRY/hqdefault.jpg',
  },
};

type ActiveSection = 'playlist' | 'local' | 'integrations';

export default function GameVibeSpotifyApp() {
  const [selectedPack, setSelectedPack] = useState<GenrePackId>('mix');
  const [activeVibe, setActiveVibe] = useState<VibeStateId>('EXPLORE');
  const [sceneFilter, setSceneFilter] = useState<VibeStateId | 'ALL'>('ALL');
  const [activeSection, setActiveSection] = useState<ActiveSection>('playlist');

  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(true);
  const [sensitivity, setSensitivity] = useState<number>(42);
  const [alwaysOnTop, setAlwaysOnTop] = useState<boolean>(false);
  const [systemMediaSync, setSystemMediaSync] = useState<boolean>(false);

  const [tracksByVibe, setTracksByVibe] = useState<Record<VibeStateId, TrackItem[]>>({
    EXPLORE: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'EXPLORE'),
    STEALTH: FALLBACK_REAL_TRACKS,
    COMBAT: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'COMBAT'),
    BOSSFIGHT: FALLBACK_REAL_TRACKS.filter((t) => t.vibe === 'BOSSFIGHT'),
    VICTORY: FALLBACK_REAL_TRACKS,
  });

  const [currentTrack, setCurrentTrack] = useState<TrackItem>(FALLBACK_REAL_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [progressSec, setProgressSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(30);
  const [loadingPack, setLoadingPack] = useState<boolean>(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<TrackItem[] | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
    brightness: 45,
    inferredVibe: 'EXPLORE',
    sensorMode: 'win32-live',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSwitchRef = useRef<number>(0);

  const loadPackTracks = useCallback(async (packId: GenrePackId) => {
    setLoadingPack(true);
    try {
      const results = await Promise.all(
        SCENE_ORDER.map(async (vibe) => {
          const res = await fetch(`/api/ytmusic?vibe=${vibe}&pack=${packId}`);
          if (!res.ok) return { vibe, tracks: [] as TrackItem[] };
          const data = await res.json();
          return {
            vibe,
            tracks: Array.isArray(data.tracks) && data.tracks.length > 0 ? data.tracks : [],
          };
        })
      );

      setTracksByVibe((prev) => {
        const next = { ...prev };
        for (const item of results) {
          if (item.tracks.length > 0) {
            next[item.vibe] = item.tracks;
          }
        }
        return next;
      });

      const exploreList = results.find((r) => r.vibe === 'EXPLORE')?.tracks;
      if (exploreList && exploreList.length > 0) {
        setCurrentTrack(exploreList[0]);
      }
    } catch {
      // Fallback already populated
    } finally {
      setLoadingPack(false);
    }
  }, []);

  useEffect(() => {
    loadPackTracks(selectedPack);
  }, [selectedPack, loadPackTracks]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    setActiveSection('playlist');
    try {
      const res = await fetch(`/api/ytmusic?mode=search&q=${encodeURIComponent(q)}&vibe=${activeVibe}`);
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
              duration: 'Локальный',
              thumbnail: WAVE_META.mix.cover,
              previewUrl: `/api/local-music?stream=${encodeURIComponent(f.path)}`,
              vibe: SCENE_ORDER[idx % SCENE_ORDER.length],
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

  // Real-time game screen & input telemetry
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (!res.ok) return;
        const data: TelemetrySnapshot = await res.json();
        setTelemetry(data);

        if (autopilotEnabled) {
          let targetVibe: VibeStateId = data.inferredVibe;
          if (data.motionDelta >= sensitivity + 26 || data.redAlertRatio >= 16) {
            targetVibe = 'BOSSFIGHT';
          } else if (data.motionDelta >= sensitivity) {
            targetVibe = 'COMBAT';
          } else if (data.brightness < 22 && data.motionDelta >= 12) {
            targetVibe = 'STEALTH';
          } else {
            targetVibe = 'EXPLORE';
          }

          const now = Date.now();
          if (targetVibe !== activeVibe && now - lastSwitchRef.current > 8500) {
            lastSwitchRef.current = now;
            setActiveVibe(targetVibe);
            const pool = tracksByVibe[targetVibe] || [];
            if (pool.length > 0) {
              const randomTrack = pool[Math.floor(Math.random() * pool.length)];
              setCurrentTrack(randomTrack);
              setIsPlaying(true);
            }
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
  }, [autopilotEnabled, activeVibe, sensitivity, tracksByVibe, systemMediaSync]);

  // Audio playback lifecycle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.previewUrl) {
      if (audio.src !== currentTrack.previewUrl) {
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

  const playSpecificTrack = (track: TrackItem) => {
    setCurrentTrack(track);
    setActiveVibe(track.vibe);
    setIsPlaying(true);
  };

  const assignTrackVibe = (trackId: string, newVibe: VibeStateId) => {
    if (searchResults) {
      setSearchResults((prev) =>
        prev ? prev.map((t) => (t.id === trackId ? { ...t, vibe: newVibe } : t)) : null
      );
    }
    const found =
      searchResults?.find((t) => t.id === trackId) ||
      Object.values(tracksByVibe)
        .flat()
        .find((t) => t.id === trackId);

    if (found) {
      const updated = { ...found, vibe: newVibe };
      setTracksByVibe((prev) => ({
        ...prev,
        [newVibe]: [updated, ...(prev[newVibe] || []).filter((x) => x.id !== trackId)],
      }));
    }
  };

  const skipTrack = useCallback(
    (dir: 1 | -1 = 1) => {
      const list = tracksByVibe[activeVibe] || FALLBACK_REAL_TRACKS;
      if (list.length === 0) return;
      const idx = list.findIndex((t) => t.id === currentTrack?.id);
      const nextIdx = (idx + dir + list.length) % list.length;
      setCurrentTrack(list[nextIdx]);
      setIsPlaying(true);

      if (systemMediaSync) {
        fetch('/api/system-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: dir === 1 ? 'next' : 'prev' }),
        }).catch(() => {});
      }
    },
    [activeVibe, currentTrack, tracksByVibe, systemMediaSync]
  );

  const cycleSceneForTest = () => {
    const idx = SCENE_ORDER.indexOf(activeVibe);
    const nextScene = SCENE_ORDER[(idx + 1) % SCENE_ORDER.length];
    lastSwitchRef.current = Date.now();
    setActiveVibe(nextScene);
    const pool = tracksByVibe[nextScene] || [];
    if (pool.length > 0) {
      setCurrentTrack(pool[0]);
      setIsPlaying(true);
    }
  };

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

  const displayedTracks = useMemo(() => {
    if (searchResults !== null) {
      return searchResults;
    }
    const allWaveTracks = SCENE_ORDER.flatMap((v) => tracksByVibe[v] || []);
    if (sceneFilter === 'ALL') return allWaveTracks;
    return allWaveTracks.filter((t) => t.vibe === sceneFilter);
  }, [searchResults, tracksByVibe, sceneFilter]);

  const currentPackConfig = GENRE_PACKS[selectedPack];
  const currentSceneMeta = VIBE_STATES[activeVibe];

  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="h-dvh w-full bg-[#080809] text-[#EDE9E8] flex flex-col overflow-hidden select-none">
      {/* Hidden HTML5 Audio Engine */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgressSec(el.currentTime || 0);
          if (el.duration && !Number.isNaN(el.duration)) {
            setDurationSec(el.duration);
          }
        }}
        onEnded={() => skipTrack(1)}
      />

      {/* MAIN DESKTOP WORKSPACE (Sidebar + Center View) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-h-0 overflow-hidden">
        {/* LEFT SIDEBAR (Spotify-style navigation + library + game sensor) */}
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
                onClick={() => {
                  setActiveSection('playlist');
                  setSearchResults(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                  activeSection === 'playlist' && searchResults === null
                    ? 'bg-[#1D1619] text-[#EDE9E8] border border-[#441924]'
                    : 'text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#171518]'
                }`}
              >
                <Disc className="w-4 h-4 text-[#B84A62] shrink-0" />
                <span>Главная и Автопилот</span>
              </button>

              <button
                onClick={() => {
                  setActiveSection('playlist');
                  searchInputRef.current?.focus();
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                  searchResults !== null
                    ? 'bg-[#1D1619] text-[#EDE9E8] border border-[#441924]'
                    : 'text-[#8C8482] hover:text-[#EDE9E8] hover:bg-[#171518]'
                }`}
              >
                <Search className="w-4 h-4 text-[#B84A62] shrink-0" />
                <span>Поиск треков</span>
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

          {/* Playlists / Waves Library (Desktop Sidebar) */}
          <div className="hidden lg:flex flex-1 bg-[#111012] border border-[#1E1B1D] rounded-lg p-3.5 flex-col justify-between min-h-0 overflow-y-auto">
            <div className="space-y-2">
              <div className="px-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C8482]">
                  Плейлисты Автопилота
                </span>
                {loadingPack && (
                  <span className="text-[11px] text-[#B84A62]">Обновление...</span>
                )}
              </div>

              <div className="space-y-1">
                {(Object.keys(GENRE_PACKS) as GenrePackId[]).map((packId) => {
                  const meta = WAVE_META[packId];
                  const active =
                    selectedPack === packId &&
                    searchResults === null &&
                    activeSection === 'playlist';
                  return (
                    <button
                      key={packId}
                      onClick={() => {
                        setSelectedPack(packId);
                        setSearchResults(null);
                        setActiveSection('playlist');
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition ${
                        active
                          ? 'bg-[#1C1417] border border-[#4A1C28]'
                          : 'hover:bg-[#171518] border border-transparent'
                      }`}
                    >
                      <img
                        src={meta.cover}
                        alt={meta.shortTitle}
                        className="w-10 h-10 rounded object-cover bg-[#1B191C] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[#EDE9E8]">
                          {meta.shortTitle}
                        </div>
                        <div className="text-[11px] text-[#8C8482] mt-0.5 leading-snug">
                          {meta.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Game Telemetry Box inside Sidebar */}
            <div className="mt-4 pt-3 border-t border-[#1E1B1D] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-[#B84A62]" />
                  <span className="text-xs font-medium text-[#EDE9E8]">Сенсор игры</span>
                </div>
                <button
                  onClick={() => setAutopilotEnabled((v) => !v)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    autopilotEnabled
                      ? 'bg-[#6E1D2F] text-white'
                      : 'bg-[#1B191C] text-[#8C8482] border border-[#2A2629]'
                  }`}
                >
                  {autopilotEnabled ? 'Автопилот ВКЛ' : 'На паузе'}
                </button>
              </div>

              <div className="bg-[#0B0A0C] border border-[#1E1B1D] rounded-md p-2.5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8C8482]">Сцена сейчас:</span>
                  <span className="font-semibold text-[#D47A8D]">{currentSceneMeta.shortLabel}</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#8C8482]">Активность (экран + ввод)</span>
                    <span className="font-mono text-[#EDE9E8]">{telemetry.motionDelta}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1E1B1D] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8E2940] transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(4, telemetry.motionDelta))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#8C8482]">Порог включения боя</span>
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

        {/* CENTER MAIN VIEW (Spotify-like Top Search + Hero Banner + Tracklist Table) */}
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
                placeholder="Поиск любого трека или артиста..."
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

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={cycleSceneForTest}
                className="px-3 py-1.5 rounded-md bg-[#1A181B] hover:bg-[#221F23] border border-[#2A2629] text-xs text-[#EDE9E8] transition"
              >
                Сменить сцену ({currentSceneMeta.shortLabel})
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

          {/* Main Scrollable Area */}
          <div className="flex-1 overflow-y-auto">
            {activeSection === 'playlist' && (
              <>
                {/* Spotify-Style Playlist / Wave Hero Header with Deep Burgundy-to-Graphite Gradient */}
                <div
                  className="px-5 sm:px-6 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-end gap-5 border-b border-[#1E1B1D]"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(88, 22, 37, 0.55) 0%, rgba(32, 14, 19, 0.45) 65%, rgba(17, 16, 18, 1) 100%)',
                  }}
                >
                  <img
                    src={currentTrack?.thumbnail || WAVE_META[selectedPack].cover}
                    alt={currentTrack?.title || 'Wave Cover'}
                    className="w-24 h-24 sm:w-36 sm:h-36 rounded-md object-cover shadow-2xl border border-white/10 shrink-0"
                  />

                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-[#D47A8D]">
                      <span>
                        {searchResults !== null
                          ? 'РЕЗУЛЬТАТЫ ПОИСКА МУЗЫКИ'
                          : `АВТОПИЛОТ · СЦЕНА В ИГРЕ: ${currentSceneMeta.label.toUpperCase()}`}
                      </span>
                    </div>

                    <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-[#EDE9E8]">
                      {searchResults !== null
                        ? `Поиск: «${searchQuery}»`
                        : currentPackConfig.label}
                    </h1>

                    <p className="text-xs text-[#9E9694] max-w-2xl leading-relaxed">
                      {searchResults !== null
                        ? 'Нажми на любой трек, чтобы включить его сразу, или выбери для него игровую сцену справа — Автопилот добавит его в свою ротацию.'
                        : `${currentPackConfig.artistsSummary}. Программа сама переключает эти треки в зависимости от того, спокойная сейчас сцена в игре или начался бой.`}
                    </p>

                    {/* Mobile quick wave selector */}
                    <div className="flex lg:hidden items-center gap-1.5 pt-2 flex-wrap">
                      {(Object.keys(GENRE_PACKS) as GenrePackId[]).map((pid) => (
                        <button
                          key={pid}
                          onClick={() => {
                            setSelectedPack(pid);
                            setSearchResults(null);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                            selectedPack === pid
                              ? 'bg-[#6E1D2F] text-white'
                              : 'bg-[#1A181B] text-[#8C8482]'
                          }`}
                        >
                          {WAVE_META[pid].shortTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Bar & Scene Filters */}
                <div className="px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1B1D] bg-[#131114]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => setIsPlaying((p) => !p)}
                      className="w-11 h-11 rounded-full bg-[#7A1F34] hover:bg-[#8E253D] text-white flex items-center justify-center shadow-lg transition shrink-0"
                      title={isPlaying ? 'Пауза' : 'Воспроизвести'}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setSearchResults(null);
                          setSceneFilter('ALL');
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          sceneFilter === 'ALL' && searchResults === null
                            ? 'bg-[#2A171D] text-[#EDE9E8] border border-[#6E1D2F]'
                            : 'bg-[#1A181B] text-[#8C8482] hover:text-[#EDE9E8]'
                        }`}
                      >
                        Все треки ({SCENE_ORDER.reduce((acc, v) => acc + (tracksByVibe[v]?.length || 0), 0)})
                      </button>

                      {SCENE_ORDER.map((vibeKey) => {
                        const badge = SCENE_BADGE_STYLE[vibeKey];
                        const active = sceneFilter === vibeKey && searchResults === null;
                        return (
                          <button
                            key={vibeKey}
                            onClick={() => {
                              setSearchResults(null);
                              setSceneFilter(vibeKey);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                              active
                                ? 'bg-[#2A171D] text-[#EDE9E8] border-[#6E1D2F]'
                                : 'bg-[#1A181B] text-[#8C8482] border-transparent hover:text-[#EDE9E8]'
                            }`}
                          >
                            {badge.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Direct open in full streaming services */}
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

                {/* Spotify-Style Tracklist Table */}
                <div className="px-4 sm:px-6 py-2">
                  <div className="grid grid-cols-[28px_1fr_120px] sm:grid-cols-[36px_1fr_180px_150px_60px] gap-3 px-3 py-2 text-[11px] uppercase tracking-wider font-medium text-[#8C8482] border-b border-[#1E1B1D]">
                    <span>#</span>
                    <span>Название</span>
                    <span className="hidden sm:block">Альбом</span>
                    <span>Сцена в игре</span>
                    <span className="hidden sm:block text-right">Время</span>
                  </div>

                  <div className="divide-y divide-[#181619]">
                    {displayedTracks.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const badge = SCENE_BADGE_STYLE[track.vibe] || SCENE_BADGE_STYLE.EXPLORE;

                      return (
                        <div
                          key={`${track.id}-${idx}`}
                          onClick={() => playSpecificTrack(track)}
                          className={`grid grid-cols-[28px_1fr_120px] sm:grid-cols-[36px_1fr_180px_150px_60px] gap-3 items-center px-3 py-2.5 rounded-md cursor-pointer transition ${
                            isCurrent
                              ? 'bg-[#211217]'
                              : 'hover:bg-[#171518]'
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
                              <div className="text-xs text-[#8C8482]">
                                {track.artist}
                              </div>
                            </div>
                          </div>

                          <div className="hidden sm:block text-xs text-[#8C8482]">
                            {track.album}
                          </div>

                          {/* Game Scene Selector / Badge */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <select
                              value={track.vibe}
                              onChange={(e) =>
                                assignTrackVibe(track.id, e.target.value as VibeStateId)
                              }
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                              className="px-2.5 py-1 rounded text-[11px] font-medium border outline-none cursor-pointer"
                            >
                              <option value="EXPLORE">Спокойно</option>
                              <option value="STEALTH">Напряжение</option>
                              <option value="COMBAT">Экшен / Бой</option>
                              <option value="BOSSFIGHT">Пик боя</option>
                            </select>
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

            {/* LOCAL PC MUSIC SECTION */}
            {activeSection === 'local' && (
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#EDE9E8]">Музыка с твоего ПК</h2>
                  <p className="text-xs text-[#8C8482]">
                    Укажи любую папку с MP3, FLAC, WAV или M4A — Автопилот будет включать твои локальные треки во время игры без интернета.
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
                    <RefreshCw className={`w-3.5 h-3.5 ${scanningLocal ? 'animate-spin' : ''}`} />
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
                            <div className="text-sm font-medium text-[#EDE9E8]">{t.title}</div>
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

            {/* PLAYER INTEGRATIONS SECTION */}
            {activeSection === 'integrations' && (
              <div className="p-6 space-y-5 max-w-2xl">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#EDE9E8]">Связь с внешними плеерами</h2>
                  <p className="text-xs text-[#8C8482]">
                    Помимо встроенного аудио-движка, GameVibe умеет управлять твоим открытым плеером на ПК или вкладкой YouTube Music в браузере.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#161417] border border-[#242023] flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-[#EDE9E8]">
                      Управление системным плеером Windows (Global Media Keys)
                    </div>
                    <p className="text-xs text-[#8C8482]">
                      При резкой смене сцены в игре GameVibe автоматически нажимает системную клавишу «Следующий трек» в твоем запущенном Spotify, Яндекс Музыке, AIMP или браузере.
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

      {/* BOTTOM PERSISTENT SPOTIFY-STYLE PLAYER BAR */}
      <footer className="h-[84px] shrink-0 bg-[#0B0A0C] border-t border-[#1E1B1D] px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Current Playing Track Info */}
        <div className="flex items-center gap-3 min-w-[140px] w-[35%] sm:w-[30%]">
          <img
            src={currentTrack?.thumbnail || WAVE_META.mix.cover}
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
            <div className="text-[10px] text-[#B84A62] uppercase tracking-wider font-medium mt-0.5">
              Автопилот: {currentSceneMeta.shortLabel}
            </div>
          </div>
        </div>

        {/* Center: Playback Controls + Seek Bar */}
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
            <span className="text-[11px] font-mono text-[#8C8482] w-7 text-right">
              {formatTime(progressSec)}
            </span>
            <input
              type="range"
              min={0}
              max={durationSec || 30}
              step={0.2}
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
            <span className="text-[11px] font-mono text-[#8C8482] w-7">
              {formatTime(durationSec)}
            </span>
          </div>
        </div>

        {/* Right: Live Game Activity Pill + Volume */}
        <div className="hidden sm:flex items-center justify-end gap-4 w-[30%] min-w-[180px]">
          <div className="px-2.5 py-1 rounded bg-[#141215] border border-[#242023] text-[11px] text-[#9E9694]">
            Активность: <span className="font-mono text-[#EDE9E8]">{telemetry.motionDelta}%</span>
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
