'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ExternalLink,
  Monitor,
  Pause,
  Pin,
  Play,
  Radio,
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
  const [actionThreshold, setActionThreshold] = useState<number>(45);
  const [syncSystemPlayer, setSyncSystemPlayer] = useState<boolean>(false);

  // Prepared track pools per Vibe state so Autopilot switches instantaneously
  const [poolsByVibe, setPoolsByVibe] = useState<Record<VibeStateId, TrackItem[]>>({
    EXPLORE: [FALLBACK_REAL_TRACKS[0], FALLBACK_REAL_TRACKS[1]],
    STEALTH: [FALLBACK_REAL_TRACKS[1]],
    COMBAT: [FALLBACK_REAL_TRACKS[2]],
    BOSSFIGHT: [FALLBACK_REAL_TRACKS[3], FALLBACK_REAL_TRACKS[4]],
    VICTORY: [FALLBACK_REAL_TRACKS[0]],
  });

  const [currentTrack, setCurrentTrack] = useState<TrackItem>(FALLBACK_REAL_TRACKS[0]);
  const [autopilotReason, setAutopilotReason] = useState<string>(
    'Автопилот следит за экраном · Спокойная сцена'
  );
  const [isLoadingPack, setIsLoadingPack] = useState<boolean>(false);

  // Audio playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Real Windows Screen Telemetry
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    timestamp: Date.now(),
    activeWindowTitle: 'Рабочий стол Windows',
    detectedProcess: 'explorer.exe',
    runningWindows: [],
    motionDelta: 14,
    crimsonIndex: 6,
    luminance: 46,
    compositeIntensity: 18,
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

  // Preload tracks for all 4 game scenes when Genre Pack changes
  const preloadPackPools = useCallback(async (packId: GenrePackId) => {
    setIsLoadingPack(true);
    try {
      const results = await Promise.all(
        ACTIVE_VIBES.map(async (vibe) => {
          const res = await fetch(
            `/api/ytmusic?pack=${encodeURIComponent(packId)}&vibe=${encodeURIComponent(vibe)}`
          );
          const data = await res.json();
          return {
            vibe,
            tracks: Array.isArray(data?.tracks) && data.tracks.length > 0
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
    } finally {
      setIsLoadingPack(false);
    }
  }, [currentVibe]);

  useEffect(() => {
    preloadPackPools(selectedPack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPack]);

  // Automatically switch Vibe & Track when screen state changes
  const applyAutopilotVibe = useCallback(
    (nextVibe: VibeStateId, reason: string, forceNow = false) => {
      const now = Date.now();
      if (!forceNow && now - lastSwitchTimeRef.current < 9000) {
        return;
      }
      lastSwitchTimeRef.current = now;
      setCurrentVibe(nextVibe);
      setAutopilotReason(reason);

      const pool = poolsByVibe[nextVibe] || FALLBACK_REAL_TRACKS;
      const nextIdx = (trackIndexByVibeRef.current[nextVibe] || 0) % Math.max(1, pool.length);
      trackIndexByVibeRef.current[nextVibe] = nextIdx + 1;

      const chosenTrack = pool[nextIdx] || pool[0];
      if (chosenTrack) {
        setCurrentTrack(chosenTrack);
        setIsPlaying(true);

        // Sync with browser tab userscript bridge
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

      // If user enabled external system player sync (Spotify / Yandex Music / Browser), trigger Next Track on scene change
      if (syncSystemPlayer) {
        fetch('/api/system-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'NEXT_TRACK' }),
        }).catch(() => {});
      }
    },
    [poolsByVibe, isMuted, volume, syncSystemPlayer]
  );

  // Poll live Windows screen sensor every 2 seconds
  useEffect(() => {
    if (!autopilotEnabled) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/telemetry');
        const snap: TelemetrySnapshot = await res.json();
        setTelemetry(snap);

        // Determine target vibe using user's actionThreshold slider
        let detectedVibe: VibeStateId = 'EXPLORE';
        if (snap.crimsonIndex >= 45 || snap.compositeIntensity >= actionThreshold + 30) {
          detectedVibe = 'BOSSFIGHT';
        } else if (snap.motionDelta >= actionThreshold || snap.compositeIntensity >= actionThreshold) {
          detectedVibe = 'COMBAT';
        } else if (snap.luminance <= 24) {
          detectedVibe = 'STEALTH';
        } else {
          detectedVibe = 'EXPLORE';
        }

        if (detectedVibe !== currentVibe) {
          applyAutopilotVibe(
            detectedVibe,
            `Автопилот (${snap.detectedProcess}): динамика экрана ${snap.motionDelta}%, яркость ${snap.luminance}% → ${VIBE_STATES[detectedVibe].label}`
          );
        }
      } catch {
        // ignore transient error
      }
    };

    poll();
    const timer = setInterval(poll, 2000);
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

  // Cycle next track within the current Vibe pool when song finishes
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

  // Demo Game Moment Cycle (so user can test how Autopilot reacts to game changes in 1 click)
  const handleSimulateGameMomentChange = () => {
    const order: VibeStateId[] = ['EXPLORE', 'STEALTH', 'COMBAT', 'BOSSFIGHT'];
    const nextVibe = order[(order.indexOf(currentVibe) + 1) % order.length];

    const simMetrics: Record<
      VibeStateId,
      { motion: number; crimson: number; luma: number; reason: string }
    > = {
      EXPLORE: {
        motion: 16,
        crimson: 5,
        luma: 54,
        reason: 'На экране спокойное исследование (движение 16%) → включен спокойный трек',
      },
      STEALTH: {
        motion: 24,
        crimson: 10,
        luma: 16,
        reason: 'Темная локация на экране (яркость 16%) → включен ночной / стелс вайб',
      },
      COMBAT: {
        motion: 74,
        crimson: 30,
        luma: 48,
        reason: 'На экране начался экшен (движение 74%) → автопилот включил боевой трек',
      },
      BOSSFIGHT: {
        motion: 92,
        crimson: 75,
        luma: 42,
        reason: 'Пик боя и вспышки урона (92%) → автопилот включил максимальный драйв',
      },
      VICTORY: {
        motion: 30,
        crimson: 5,
        luma: 75,
        reason: 'Бой завершен → плавный переход',
      },
    };

    const m = simMetrics[nextVibe];
    setTelemetry((prev) => ({
      ...prev,
      motionDelta: m.motion,
      crimsonIndex: m.crimson,
      luminance: m.luma,
      compositeIntensity: Math.round(m.motion * 0.65 + m.crimson * 0.35),
      inferredVibe: nextVibe,
    }));

    applyAutopilotVibe(nextVibe, m.reason, true);
  };

  const openInPlatform = async (
    platform: 'ytmusic' | 'spotify' | 'yandex' | 'soundcloud',
    track: TrackItem
  ) => {
    const q = encodeURIComponent(`${track.artist} ${track.title}`);
    const urls: Record<string, string> = {
      ytmusic: track.videoId
        ? `https://music.youtube.com/watch?v=${track.videoId}`
        : `https://music.youtube.com/search?q=${q}`,
      spotify: `spotify:search:${q}`,
      yandex: `https://music.yandex.ru/search?text=${q}`,
      soundcloud: `https://soundcloud.com/search?q=${q}`,
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
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 flex flex-col justify-between select-none">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 30)}
        onEnded={handleNextInCurrentVibe}
      />

      {/* Minimal Top Bar */}
      <header
        className="border-b border-zinc-900 bg-[#0A0A0C] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                autopilotEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
              }`}
            />
            <span className="font-semibold text-sm tracking-tight text-white">
              GameVibe
            </span>
          </div>
          <span className="text-zinc-800">·</span>
          <span className="text-xs text-zinc-400">
            Окно: <strong className="text-zinc-200 font-medium">{telemetry.detectedProcess}</strong>
          </span>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 lg:pr-28"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={() => setSyncSystemPlayer((s) => !s)}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              syncSystemPlayer
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'
            }`}
            title="Автоматически переключать трек и в запущенном плеере Windows (Яндекс Музыка / Spotify)"
          >
            {syncSystemPlayer ? 'Системный плеер ПК: синхр.' : 'Системный плеер ПК: выкл'}
          </button>

          <button
            type="button"
            onClick={handleToggleAlwaysOnTop}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
              isPinnedOverlay
                ? 'bg-white text-black border-white font-semibold'
                : 'bg-zinc-950 text-zinc-300 border-zinc-800/80 hover:bg-zinc-900'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>Поверх игры</span>
          </button>
        </div>
      </header>

      {/* Center Minimalist Workspace */}
      <main className="flex-1 max-w-[920px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col justify-center space-y-6">
        {/* 1. AUTOPILOT HERO CARD: WHAT IS IN GAME -> WHAT IS PLAYING */}
        <section className="rounded-2xl bg-[#111114] border border-zinc-800/80 p-5 sm:p-7 space-y-6">
          {/* Top Row: Autopilot Status & Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-zinc-800/70">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeVibeCfg.accentHex }}
                />
                <span className="text-xs font-medium text-zinc-400">
                  Сейчас в игре определено:
                </span>
                <span className="text-xs font-semibold text-white">
                  {activeVibeCfg.label}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{autopilotReason}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateGameMomentChange}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-800 transition-colors"
              >
                Проверить смену сцены
              </button>

              <button
                type="button"
                onClick={() => setAutopilotEnabled((a) => !a)}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                  autopilotEnabled
                    ? 'bg-[#FF6A00] text-black'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{autopilotEnabled ? 'Авторежим: ВКЛ' : 'Авторежим: ПАУЗА'}</span>
              </button>
            </div>
          </div>

          {/* Middle Row: Now Playing Track (Selected Automatically by Program) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Track Cover + Metadata */}
            <div className="md:col-span-7 flex items-center gap-4">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shrink-0 bg-zinc-900 border border-zinc-800"
              />
              <div className="space-y-1.5 min-w-0">
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                  {activeVibeCfg.shortLabel} · {currentTrack.genreTag}
                </span>
                <h1 className="text-lg sm:text-xl font-bold text-white leading-snug">
                  {currentTrack.title}
                </h1>
                <p className="text-sm text-zinc-400">
                  {currentTrack.artist} · <span className="text-zinc-500">{currentTrack.album}</span>
                </p>

                {/* Direct Links to Open in External Platforms */}
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'ytmusic' as const, label: 'YouTube Music' },
                    { id: 'spotify' as const, label: 'Spotify' },
                    { id: 'yandex' as const, label: 'Я.Музыка' },
                    { id: 'soundcloud' as const, label: 'SoundCloud' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openInPlatform(p.id, currentTrack)}
                      className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/90 text-[11px] text-zinc-300 flex items-center gap-1"
                    >
                      <span>{p.label}</span>
                      <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Screen Sensor Bars & Sensitivity */}
            <div className="md:col-span-5 rounded-xl bg-[#0C0C0E] border border-zinc-800/70 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Движение в игре</span>
                </span>
                <span className="font-mono text-zinc-200">{telemetry.motionDelta}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className="h-full bg-[#FF6A00] transition-all duration-500"
                  style={{ width: `${telemetry.motionDelta}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-zinc-400">Порог включения экшена</span>
                <span className="font-mono text-zinc-300">{actionThreshold}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                value={actionThreshold}
                onChange={(e) => setActionThreshold(Number(e.target.value))}
                className="w-full h-1 accent-[#FF6A00] cursor-pointer"
                aria-label="Порог включения экшена"
              />
            </div>
          </div>

          {/* Bottom Row of Card: Minimal Audio Transport & Volume */}
          <div className="pt-4 border-t border-zinc-800/70 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center gap-2 transition-transform active:scale-95"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Пауза</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Включить звук</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNextInCurrentVibe}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs flex items-center gap-1.5"
                title="Другой трек для этой же сцены"
              >
                <SkipForward className="w-4 h-4" />
                <span>Другой трек</span>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2.5 flex-1 min-w-[180px] max-w-sm">
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
                  const t = Number(e.target.value);
                  setCurrentTime(t);
                  if (audioRef.current) audioRef.current.currentTime = t;
                }}
                className="flex-1 h-1 accent-white cursor-pointer"
                aria-label="Позиция воспроизведения"
              />
              <span className="text-[11px] font-mono text-zinc-500 w-8">
                {formatSeconds(duration)}
              </span>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
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
                className="w-20 accent-white cursor-pointer"
                aria-label="Громкость"
              />
            </div>
          </div>
        </section>

        {/* 2. ONE-CLICK TASTE SELECTOR FOR AUTOPILOT */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Какую музыку ставить автопилоту
            </h2>
            {isLoadingPack && (
              <span className="text-xs text-zinc-500">Загрузка треков...</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(GENRE_PACKS) as GenrePackId[]).map((packKey) => {
              const pack = GENRE_PACKS[packKey];
              const active = selectedPack === packKey;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPack(pack.id)}
                  className={`p-4 rounded-xl text-left transition-all border flex flex-col justify-between gap-2 ${
                    active
                      ? 'bg-zinc-900 border-white text-white'
                      : 'bg-[#111114] border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-xs font-bold text-white leading-snug">
                    {pack.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 leading-relaxed">
                    {pack.artistsSummary}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. PREPARED TRACKS BY GAME SCENE (READ-ONLY AUTOPILOT CHAMBER) */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Наготове у автопилота под моменты в игре
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ACTIVE_VIBES.map((vibeId) => {
              const cfg = VIBE_STATES[vibeId];
              const pool = poolsByVibe[vibeId] || [];
              const previewTrack = pool[0];
              const isCurrentScene = currentVibe === vibeId;

              return (
                <div
                  key={vibeId}
                  onClick={() =>
                    applyAutopilotVibe(
                      vibeId,
                      `Проверка сцены «${cfg.label}»`,
                      true
                    )
                  }
                  className={`p-3.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-3 ${
                    isCurrentScene
                      ? 'bg-zinc-900/90 border-[#FF6A00]/70'
                      : 'bg-[#111114] border-zinc-800/70 hover:border-zinc-700'
                  }`}
                >
                  {previewTrack && (
                    <img
                      src={previewTrack.thumbnail}
                      alt={previewTrack.title}
                      className="w-11 h-11 rounded-lg object-cover shrink-0 bg-zinc-900"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: cfg.accentHex }}
                      />
                      <span className="text-[11px] font-medium text-zinc-400">
                        {cfg.shortLabel}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white mt-0.5 leading-snug">
                      {previewTrack ? previewTrack.title : 'Загрузка...'}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {previewTrack ? previewTrack.artist : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-900 px-4 sm:px-6 py-3 text-[11px] text-zinc-500 flex flex-wrap items-center justify-between gap-2">
        <span>GameVibe Autopilot v1.0 · Автоматическая адаптация музыки под экран игры</span>
        <a
          href="/api/userscript"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-400 hover:text-white underline"
        >
          Скрипт авто-синхронизации для вкладки YouTube Music
        </a>
      </footer>
    </div>
  );
}
