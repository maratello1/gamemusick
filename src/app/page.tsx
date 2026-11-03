'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Pause,
  Pin,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  FALLBACK_REAL_TRACKS,
  GENRE_PACKS,
  GenrePackId,
  VIBE_STATES,
} from '@/lib/defaultData';
import { TelemetrySnapshot, TrackItem, VibeStateId } from '@/types/vibe';

const ACTIVE_VIBES: VibeStateId[] = ['EXPLORE', 'STEALTH', 'COMBAT', 'BOSSFIGHT'];

type NobleThemeId = 'burgundy' | 'emerald' | 'chocolate' | 'sapphire';

interface NobleTheme {
  id: NobleThemeId;
  name: string;
  bg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  accentBg: string;
  accentHover: string;
  accentBorder: string;
  accentSoftBg: string;
  accentText: string;
  barFill: string;
}

const NOBLE_THEMES: Record<NobleThemeId, NobleTheme> = {
  burgundy: {
    id: 'burgundy',
    name: 'Винный и Черный',
    bg: '#0B0A0B',
    surface: '#121113',
    surfaceElevated: '#181619',
    border: '#242125',
    accentBg: '#6B1D2F',
    accentHover: '#7E2338',
    accentBorder: '#8E2B42',
    accentSoftBg: '#211116',
    accentText: '#D98A9C',
    barFill: '#85243A',
  },
  chocolate: {
    id: 'chocolate',
    name: 'Шоколад и Графит',
    bg: '#0C0B0A',
    surface: '#141210',
    surfaceElevated: '#1C1917',
    border: '#292421',
    accentBg: '#4E3021',
    accentHover: '#5E3B29',
    accentBorder: '#754B36',
    accentSoftBg: '#211813',
    accentText: '#C9A690',
    barFill: '#6B4430',
  },
  emerald: {
    id: 'emerald',
    name: 'Изумруд и Черный',
    bg: '#090B0A',
    surface: '#101412',
    surfaceElevated: '#161C19',
    border: '#202925',
    accentBg: '#164636',
    accentHover: '#1C5744',
    accentBorder: '#266E57',
    accentSoftBg: '#0F211B',
    accentText: '#84BBA8',
    barFill: '#1F614C',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Сапфир и Графит',
    bg: '#090B0E',
    surface: '#101318',
    surfaceElevated: '#161B22',
    border: '#212731',
    accentBg: '#1B355A',
    accentHover: '#224270',
    accentBorder: '#2E558C',
    accentSoftBg: '#111A29',
    accentText: '#8CAAD6',
    barFill: '#264A7D',
  },
};

function formatSeconds(sec: number): string {
  if (!sec || !Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GameVibeAutopilot() {
  const [themeId, setThemeId] = useState<NobleThemeId>('burgundy');
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(true);
  const [selectedPack, setSelectedPack] = useState<GenrePackId>('mix');
  const [currentVibe, setCurrentVibe] = useState<VibeStateId>('EXPLORE');
  const [actionThreshold, setActionThreshold] = useState<number>(42);

  const [poolsByVibe, setPoolsByVibe] = useState<Record<VibeStateId, TrackItem[]>>({
    EXPLORE: [FALLBACK_REAL_TRACKS[0], FALLBACK_REAL_TRACKS[1]],
    STEALTH: [FALLBACK_REAL_TRACKS[1]],
    COMBAT: [FALLBACK_REAL_TRACKS[2]],
    BOSSFIGHT: [FALLBACK_REAL_TRACKS[3], FALLBACK_REAL_TRACKS[4]],
    VICTORY: [FALLBACK_REAL_TRACKS[0]],
  });

  const [currentTrack, setCurrentTrack] = useState<TrackItem>(FALLBACK_REAL_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    timestamp: Date.now(),
    activeWindowTitle: 'Ожидание игры',
    detectedProcess: 'explorer.exe',
    runningWindows: [],
    motionDelta: 14,
    crimsonIndex: 5,
    luminance: 46,
    compositeIntensity: 16,
    inferredVibe: 'EXPLORE',
  });

  const [isPinnedOverlay, setIsPinnedOverlay] = useState<boolean>(false);
  const lastSwitchTimeRef = useRef<number>(0);
  const trackIndexByVibeRef = useRef<Record<VibeStateId, number>>({
    EXPLORE: 0,
    STEALTH: 0,
    COMBAT: 0,
    BOSSFIGHT: 0,
    VICTORY: 0,
  });

  const theme = NOBLE_THEMES[themeId];

  const preloadPackPools = useCallback(
    async (packId: GenrePackId) => {
      try {
        const results = await Promise.all(
          ACTIVE_VIBES.map(async (vibe) => {
            const res = await fetch(
              `/api/ytmusic?pack=${encodeURIComponent(packId)}&vibe=${encodeURIComponent(vibe)}`
            );
            const data = await res.json();
            return {
              vibe,
              tracks:
                Array.isArray(data?.tracks) && data.tracks.length > 0
                  ? (data.tracks as TrackItem[])
                  : FALLBACK_REAL_TRACKS,
            };
          })
        );

        const nextPools: Record<VibeStateId, TrackItem[]> = {
          EXPLORE: FALLBACK_REAL_TRACKS,
          STEALTH: FALLBACK_REAL_TRACKS,
          COMBAT: FALLBACK_REAL_TRACKS,
          BOSSFIGHT: FALLBACK_REAL_TRACKS,
          VICTORY: FALLBACK_REAL_TRACKS,
        };

        for (const item of results) {
          nextPools[item.vibe] = item.tracks;
        }

        setPoolsByVibe(nextPools);
        const activePool = nextPools[currentVibe] || nextPools.EXPLORE;
        if (activePool[0]) {
          setCurrentTrack(activePool[0]);
        }
      } catch {
        // keep fallback
      }
    },
    [currentVibe]
  );

  useEffect(() => {
    preloadPackPools(selectedPack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPack]);

  const applyAutopilotVibe = useCallback(
    (nextVibe: VibeStateId, forceNow = false) => {
      const now = Date.now();
      if (!forceNow && now - lastSwitchTimeRef.current < 10000) {
        return;
      }
      lastSwitchTimeRef.current = now;
      setCurrentVibe(nextVibe);

      const pool = poolsByVibe[nextVibe] || FALLBACK_REAL_TRACKS;
      const nextIdx =
        (trackIndexByVibeRef.current[nextVibe] || 0) % Math.max(1, pool.length);
      trackIndexByVibeRef.current[nextVibe] = nextIdx + 1;

      const chosenTrack = pool[nextIdx] || pool[0];
      if (chosenTrack) {
        setCurrentTrack(chosenTrack);
        setIsPlaying(true);

        fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SYNC_BRIDGE',
            bridgeTrack: {
              videoId: chosenTrack.videoId,
              title: chosenTrack.title,
              artist: chosenTrack.artist,
              vibe: nextVibe,
              volume: isMuted ? 0 : volume,
            },
          }),
        }).catch(() => {});
      }
    },
    [poolsByVibe, isMuted, volume]
  );

  useEffect(() => {
    if (!autopilotEnabled) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/telemetry');
        const snap: TelemetrySnapshot = await res.json();
        setTelemetry(snap);

        let detectedVibe: VibeStateId = 'EXPLORE';
        if (snap.crimsonIndex >= 45 || snap.motionDelta >= actionThreshold + 28) {
          detectedVibe = 'BOSSFIGHT';
        } else if (snap.motionDelta >= actionThreshold) {
          detectedVibe = 'COMBAT';
        } else if (snap.luminance <= 22) {
          detectedVibe = 'STEALTH';
        } else {
          detectedVibe = 'EXPLORE';
        }

        if (detectedVibe !== currentVibe) {
          applyAutopilotVibe(detectedVibe);
        }
      } catch {
        // ignore
      }
    };

    poll();
    const timer = setInterval(poll, 1600);
    return () => clearInterval(timer);
  }, [autopilotEnabled, actionThreshold, currentVibe, applyAutopilotVibe]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.previewUrl) {
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
    }
  }, [currentTrack, isPlaying]);

  const handleNextInCurrentVibe = () => {
    const pool = poolsByVibe[currentVibe] || FALLBACK_REAL_TRACKS;
    if (pool.length === 0) return;
    const idx = pool.findIndex((t) => t.id === currentTrack.id);
    const next = pool[(idx + 1) % pool.length];
    if (next) {
      setCurrentTrack(next);
      setIsPlaying(true);
    }
  };

  const handleSimulateGameMomentChange = () => {
    const order: VibeStateId[] = ['EXPLORE', 'STEALTH', 'COMBAT', 'BOSSFIGHT'];
    const nextVibe = order[(order.indexOf(currentVibe) + 1) % order.length];

    const simMetrics: Record<VibeStateId, { motion: number; crimson: number; luma: number }> = {
      EXPLORE: { motion: 14, crimson: 5, luma: 52 },
      STEALTH: { motion: 24, crimson: 8, luma: 16 },
      COMBAT: { motion: 68, crimson: 25, luma: 48 },
      BOSSFIGHT: { motion: 92, crimson: 70, luma: 40 },
      VICTORY: { motion: 25, crimson: 5, luma: 70 },
    };

    const m = simMetrics[nextVibe];
    setTelemetry((prev) => ({
      ...prev,
      motionDelta: m.motion,
      crimsonIndex: m.crimson,
      luminance: m.luma,
      compositeIntensity: m.motion,
      inferredVibe: nextVibe,
    }));

    applyAutopilotVibe(nextVibe, true);
  };

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

  const activeVibeCfg = VIBE_STATES[currentVibe];

  return (
    <div
      className="min-h-screen flex flex-col justify-between select-none transition-colors duration-500"
      style={{ backgroundColor: theme.bg, color: '#F2EFE9' }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 30)}
        onEnded={handleNextInCurrentVibe}
      />

      {/* Architectural Top Bar */}
      <header
        className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b"
        style={
          {
            borderColor: theme.border,
            WebkitAppRegion: 'drag',
          } as React.CSSProperties
        }
      >
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold tracking-[0.22em] uppercase text-[#F2EFE9]">
            GAMEVIBE
          </span>
          <span className="text-xs text-[#6E6A68]">/</span>
          <span className="text-xs font-mono text-[#8F8A87]">
            {telemetry.detectedProcess}
          </span>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 lg:pr-28"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Noble Dark Palette Switcher */}
          <div
            className="flex items-center p-0.5 rounded-[4px] border"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            {(Object.keys(NOBLE_THEMES) as NobleThemeId[]).map((tKey) => {
              const t = NOBLE_THEMES[tKey];
              const active = themeId === tKey;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className="min-h-[30px] px-2.5 py-1 text-[11px] font-medium rounded-[3px] transition-colors"
                  style={{
                    backgroundColor: active ? theme.accentBg : 'transparent',
                    color: active ? '#F2EFE9' : '#8F8A87',
                  }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleToggleAlwaysOnTop}
            className="min-h-[34px] px-3 py-1.5 rounded-[4px] text-xs font-medium flex items-center gap-1.5 border transition-colors"
            style={{
              backgroundColor: isPinnedOverlay ? theme.accentBg : theme.surface,
              borderColor: isPinnedOverlay ? theme.accentBorder : theme.border,
              color: '#E6E2DC',
            }}
          >
            <Pin className="w-3 h-3" />
            <span>Поверх окон</span>
          </button>
        </div>
      </header>

      {/* Main Architectural Console */}
      <main className="flex-1 max-w-[900px] w-full mx-auto px-6 py-8 sm:py-12 flex flex-col justify-center">
        <div
          className="rounded-[6px] border p-6 sm:p-10 space-y-8"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
          }}
        >
          {/* Top Section: Scene Status & Autopilot Switch */}
          <div
            className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b"
            style={{ borderColor: theme.border }}
          >
            <div className="space-y-1">
              <div
                className="text-[11px] font-mono uppercase tracking-[0.16em]"
                style={{ color: theme.accentText }}
              >
                СОСТОЯНИЕ ИГРЫ · {activeVibeCfg.shortLabel}
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-[#F2EFE9]">
                {activeVibeCfg.label}
              </h2>
              <p className="text-xs text-[#8A8582]">
                {activeVibeCfg.description}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSimulateGameMomentChange}
                className="min-h-[40px] px-3.5 py-2 rounded-[4px] text-xs font-medium border transition-colors"
                style={{
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  color: '#C7C2BC',
                }}
              >
                Сменить сцену (Тест)
              </button>

              <button
                type="button"
                onClick={() => setAutopilotEnabled((a) => !a)}
                className="min-h-[40px] px-4 py-2 rounded-[4px] text-xs font-semibold border transition-colors"
                style={{
                  backgroundColor: autopilotEnabled ? theme.accentBg : theme.surfaceElevated,
                  borderColor: autopilotEnabled ? theme.accentBorder : theme.border,
                  color: '#F2EFE9',
                }}
              >
                {autopilotEnabled ? 'Автопилот: Включен' : 'Автопилот: Пауза'}
              </button>
            </div>
          </div>

          {/* Center Section: Album Cover, Track & Game Activity Sensor */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 flex items-center gap-5">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-[4px] object-cover shrink-0 border"
                style={{ borderColor: theme.border }}
              />
              <div className="space-y-1.5 min-w-0">
                <div
                  className="text-[11px] font-mono uppercase tracking-[0.14em]"
                  style={{ color: theme.accentText }}
                >
                  {currentTrack.genreTag}
                </div>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F2EFE9] leading-snug">
                  {currentTrack.title}
                </h1>
                <div className="text-sm text-[#B5B0AA]">
                  {currentTrack.artist}
                </div>
                <div className="text-xs text-[#787370]">
                  {currentTrack.album}
                </div>
              </div>
            </div>

            {/* Right Column: Clean Activity & Threshold Meters */}
            <div
              className="md:col-span-5 rounded-[4px] p-5 border space-y-4"
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border,
              }}
            >
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8F8A87]">Интенсивность в игре</span>
                  <span className="font-mono text-[#E6E2DC]">
                    {telemetry.motionDelta}%
                  </span>
                </div>
                <div
                  className="w-full h-[4px] overflow-hidden"
                  style={{ backgroundColor: theme.surfaceElevated }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${telemetry.motionDelta}%`,
                      backgroundColor: theme.barFill,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8F8A87]">Порог перехода в бой</span>
                  <span className="font-mono text-[#E6E2DC]">
                    {actionThreshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  value={actionThreshold}
                  onChange={(e) => setActionThreshold(Number(e.target.value))}
                  className="w-full cursor-pointer"
                  aria-label="Порог перехода в бой"
                />
              </div>
            </div>
          </div>

          {/* Transport Bar */}
          <div
            className="pt-6 border-t flex flex-wrap items-center justify-between gap-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="min-h-[44px] px-6 py-2.5 rounded-[4px] text-xs font-semibold flex items-center gap-2 border transition-colors"
                style={{
                  backgroundColor: theme.accentBg,
                  borderColor: theme.accentBorder,
                  color: '#F2EFE9',
                }}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Пауза</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Включить звук</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNextInCurrentVibe}
                className="min-h-[44px] px-4 py-2.5 rounded-[4px] text-xs font-medium flex items-center gap-1.5 border transition-colors"
                style={{
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  color: '#D6D1CB',
                }}
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Следующий</span>
              </button>
            </div>

            <div className="flex items-center gap-3 flex-1 min-w-[160px] max-w-xs">
              <span className="text-[11px] font-mono text-[#787370] w-8 text-right">
                {formatSeconds(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                step={0.5}
                value={currentTime}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  setCurrentTime(t);
                  if (audioRef.current) audioRef.current.currentTime = t;
                }}
                className="flex-1 cursor-pointer"
                aria-label="Позиция"
              />
              <span className="text-[11px] font-mono text-[#787370] w-8">
                {formatSeconds(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="p-2 text-[#8F8A87] hover:text-[#F2EFE9]"
                aria-label="Звук"
              >
                {isMuted ? (
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
                className="w-20 cursor-pointer"
                aria-label="Громкость"
              />
            </div>
          </div>

          {/* Bottom Section: 4 Architectural Genre Tiles */}
          <div
            className="pt-6 border-t space-y-3"
            style={{ borderColor: theme.border }}
          >
            <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#787370]">
              МУЗЫКАЛЬНОЕ НАПРАВЛЕНИЕ АВТОПИЛОТА
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'mix' as GenrePackId, title: 'Все лучшее', sub: 'Рок, Рэп, Электроника' },
                { id: 'rap-phonk' as GenrePackId, title: 'Рэп и Фонк', sub: 'Travis Scott, Скриптонит, BONES' },
                { id: 'rock-metal' as GenrePackId, title: 'Рок и Метал', sub: 'Deftones, Linkin Park, Rammstein' },
                { id: 'electronic' as GenrePackId, title: 'Электроника', sub: 'The Prodigy, Kavinsky, Pendulum' },
              ].map((pack) => {
                const active = selectedPack === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPack(pack.id)}
                    className="min-h-[60px] p-3.5 rounded-[4px] text-left border transition-colors flex flex-col justify-between"
                    style={{
                      backgroundColor: active ? theme.accentSoftBg : theme.bg,
                      borderColor: active ? theme.accentBorder : theme.border,
                    }}
                  >
                    <div className="text-xs font-semibold text-[#F2EFE9]">
                      {pack.title}
                    </div>
                    <div className="text-[11px] text-[#8A8582] mt-1">
                      {pack.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <footer
        className="px-6 py-3 border-t text-[11px] text-[#6E6A68] flex items-center justify-between"
        style={{ borderColor: theme.border }}
      >
        <span>GameVibe · Автоматическая адаптация музыки под игру</span>
        <span className="font-mono">{theme.name}</span>
      </footer>
    </div>
  );
}
