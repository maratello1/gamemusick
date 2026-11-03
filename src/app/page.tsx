'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Pause,
  Pin,
  Play,
  SkipForward,
  Sparkles,
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

function formatSeconds(sec: number): string {
  if (!sec || !Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GameVibeAutopilot() {
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

  // Preload tracks for all game scenes when Genre Pack changes
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
        // keep fallback pools
      }
    },
    [currentVibe]
  );

  useEffect(() => {
    preloadPackPools(selectedPack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPack]);

  // Smoothly crossfade and switch track when game state changes
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

  // Poll live Windows screen & input sensor every 1.5s
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

  // Sync HTML5 Audio element
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
  const isHighIntensity = currentVibe === 'COMBAT' || currentVibe === 'BOSSFIGHT';

  return (
    <div className="min-h-screen bg-[#04050A] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Galactic Nebula Background Glow */}
      <div
        className="pointer-events-none fixed inset-0 transition-all duration-1000"
        style={{
          background: isHighIntensity
            ? 'radial-gradient(circle at 50% 25%, rgba(168, 85, 247, 0.22) 0%, rgba(99, 102, 241, 0.12) 40%, rgba(4, 5, 10, 0) 75%)'
            : 'radial-gradient(circle at 50% 25%, rgba(99, 102, 241, 0.18) 0%, rgba(56, 189, 248, 0.08) 40%, rgba(4, 5, 10, 0) 75%)',
        }}
      />

      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 30)}
        onEnded={handleNextInCurrentVibe}
      />

      {/* Minimalist Centered Galactic Container */}
      <main className="w-full max-w-[680px] relative z-10 space-y-5">
        {/* Top Minimal Header Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-1"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="font-bold text-sm tracking-wide text-white">GameVibe</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">
              {telemetry.detectedProcess}
            </span>
          </div>

          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={handleSimulateGameMomentChange}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-slate-300 transition-colors"
            >
              Тест смены сцены
            </button>

            <button
              type="button"
              onClick={handleToggleAlwaysOnTop}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                isPinnedOverlay
                  ? 'bg-violet-500/25 text-violet-200 border-violet-400/40'
                  : 'bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]'
              }`}
            >
              <Pin className="w-3 h-3" />
              <span>Поверх игры</span>
            </button>
          </div>
        </div>

        {/* Main Galactic Autopilot Capsule */}
        <section className="rounded-3xl bg-[#0A0C16]/85 backdrop-blur-2xl border border-indigo-300/15 shadow-[0_24px_80px_rgba(4,6,20,0.95)] p-6 sm:p-8 space-y-6">
          {/* Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/[0.06]">
            <div>
              <div className="text-xs text-slate-400">
                Режим игры сейчас:{' '}
                <span className="text-violet-300 font-semibold">
                  {activeVibeCfg.label}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {activeVibeCfg.description}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAutopilotEnabled((a) => !a)}
              className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                autopilotEnabled
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_0_25px_rgba(139,92,246,0.4)]'
                  : 'bg-white/[0.05] text-slate-400 border border-white/[0.08]'
              }`}
            >
              {autopilotEnabled ? 'Авторежим активен' : 'Авторежим на паузе'}
            </button>
          </div>

          {/* Track + Activity Sensor */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            <div className="sm:col-span-7 flex items-center gap-4">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-24 h-24 rounded-2xl object-cover shrink-0 bg-slate-900 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
              />
              <div className="space-y-1 min-w-0">
                <div className="text-xs text-violet-300/90 font-medium">
                  {currentTrack.genreTag}
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-white leading-snug">
                  {currentTrack.title}
                </h1>
                <p className="text-sm text-slate-400">
                  {currentTrack.artist}
                </p>
                <p className="text-xs text-slate-500">
                  {currentTrack.album}
                </p>
              </div>
            </div>

            {/* Clean Activity & Sensitivity Box */}
            <div className="sm:col-span-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Активность в игре</span>
                  <span className="font-mono text-indigo-300">{telemetry.motionDelta}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 transition-all duration-500"
                    style={{ width: `${telemetry.motionDelta}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Порог экшена</span>
                  <span className="font-mono text-slate-300">{actionThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  value={actionThreshold}
                  onChange={(e) => setActionThreshold(Number(e.target.value))}
                  className="w-full h-1 cursor-pointer"
                  aria-label="Порог включения экшена"
                />
              </div>
            </div>
          </div>

          {/* Transport & Volume */}
          <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold text-xs flex items-center gap-2 shadow-[0_0_24px_rgba(124,58,237,0.35)] transition-all active:scale-95"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Пауза</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Запустить звук</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNextInCurrentVibe}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] text-xs flex items-center gap-1.5"
              >
                <SkipForward className="w-4 h-4" />
                <span>Следующий</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5 flex-1 min-w-[160px]">
              <span className="text-[11px] font-mono text-slate-500 w-8 text-right">
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
                className="flex-1 h-1 cursor-pointer"
                aria-label="Позиция трека"
              />
              <span className="text-[11px] font-mono text-slate-500 w-8">
                {formatSeconds(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="p-2 text-slate-400 hover:text-white"
                aria-label="Звук"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-indigo-300" />
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
        </section>

        {/* Minimalist 4-Pill Taste Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { id: 'mix' as GenrePackId, name: 'Все лучшее' },
            { id: 'rap-phonk' as GenrePackId, name: 'Рэп и Фонк' },
            { id: 'rock-metal' as GenrePackId, name: 'Рок и Метал' },
            { id: 'electronic' as GenrePackId, name: 'Электроника' },
          ].map((item) => {
            const active = selectedPack === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedPack(item.id)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all border ${
                  active
                    ? 'bg-indigo-500/20 text-white border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                    : 'bg-[#0A0C16]/70 text-slate-400 border-white/[0.06] hover:text-slate-200 hover:border-white/15'
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
