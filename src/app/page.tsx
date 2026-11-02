'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity,
  Cpu,
  Disc3,
  ExternalLink,
  Flame,
  Gamepad2,
  Heart,
  Layers,
  Music2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  UserCheck,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  INITIAL_INTEGRATIONS,
  INITIAL_PRESETS,
  INITIAL_USER_PROFILE,
  VIBE_STATES,
} from '@/lib/defaultData';
import {
  GamePreset,
  IntegrationPlugin,
  TelemetrySnapshot,
  TrackItem,
  UserProfile,
  VibeStateId,
} from '@/types/vibe';
import { stemSynth } from '@/lib/stemSynth';

type NavigationTab = 'cockpit' | 'community' | 'integrations' | 'profile';
type AudioOutputMode = 'ytm-embed' | 'stem-synth' | 'browser-bridge';

const VIBE_ORDER: VibeStateId[] = ['EXPLORE', 'STEALTH', 'COMBAT', 'BOSSFIGHT', 'VICTORY'];

export default function GameVibeApp() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('cockpit');
  const [presets, setPresets] = useState<GamePreset[]>(INITIAL_PRESETS);
  const [profile, setProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [integrations, setIntegrations] = useState<IntegrationPlugin[]>(INITIAL_INTEGRATIONS);

  const [currentVibe, setCurrentVibe] = useState<VibeStateId>('EXPLORE');
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    timestamp: Date.now(),
    activeWindowTitle: 'Сканирование процессов Windows...',
    detectedProcess: 'gamevibe_sensor.exe',
    matchedGamePresetId: 'universal-ai-dj',
    motionDelta: 22,
    crimsonIndex: 14,
    luminance: 48,
    audioPeakDb: 31,
    compositeIntensity: 26,
    inferredVibe: 'EXPLORE',
    captureMode: 'live-screen',
  });

  const [sensorMode, setSensorMode] = useState<'live-screen' | 'scenario-sim'>('live-screen');
  const [audioMode, setAudioMode] = useState<AudioOutputMode>('ytm-embed');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(75);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [trackQueue, setTrackQueue] = useState<TrackItem[]>(
    INITIAL_PRESETS[0].curatedTracks.EXPLORE
  );
  const [currentTrack, setCurrentTrack] = useState<TrackItem>(
    INITIAL_PRESETS[0].curatedTracks.EXPLORE[0]
  );
  const [isSearchingYtm, setIsSearchingYtm] = useState<boolean>(false);
  const [customSearchInput, setCustomSearchInput] = useState<string>('');
  const [lastTransitionReason, setLastTransitionReason] = useState<string>(
    'Инициализация AI-DJ: спокойный режим исследования'
  );

  // New Preset Modal State
  const [isNewPresetOpen, setIsNewPresetOpen] = useState<boolean>(false);
  const [newPresetGame, setNewPresetGame] = useState<string>('');
  const [newPresetTitle, setNewPresetTitle] = useState<string>('');
  const [newPresetExe, setNewPresetExe] = useState<string>('');
  const [newPresetDesc, setNewPresetDesc] = useState<string>('');
  const [newPresetExploreQ, setNewPresetExploreQ] = useState<string>(
    'ambient lofi exploration soundtrack'
  );
  const [newPresetCombatQ, setNewPresetCombatQ] = useState<string>(
    'aggressive darksynth phonk combat'
  );

  // New Genre Input State in Profile
  const [newGenreText, setNewGenreText] = useState<string>('');
  const [selectedGenreVibe, setSelectedGenreVibe] = useState<VibeStateId>('COMBAT');

  const activePreset =
    presets.find((p) => p.id === profile.activePresetId) || presets[0];

  const lastVibeSwitchRef = useRef<number>(0);

  // Load persisted store on mount
  useEffect(() => {
    fetch('/api/presets')
      .then((res) => res.json())
      .then((data) => {
        if (data?.presets?.length) setPresets(data.presets);
        if (data?.profile) setProfile(data.profile);
        if (data?.integrations?.length) setIntegrations(data.integrations);
      })
      .catch(() => {});
  }, []);

  // Fetch tracks from YouTube Music InnerTube API for a given vibe & preset
  const fetchTracksForVibe = useCallback(
    async (targetVibe: VibeStateId, presetObj: GamePreset, customQuery?: string) => {
      setIsSearchingYtm(true);
      const userGenres = profile.favoriteGenres[targetVibe]?.slice(0, 2).join(' ') || '';
      const baseQuery =
        customQuery ||
        `${presetObj.vibeQueries[targetVibe] || VIBE_STATES[targetVibe].defaultSearchQuery} ${userGenres}`.trim();

      try {
        const res = await fetch(
          `/api/ytmusic?vibe=${encodeURIComponent(targetVibe)}&q=${encodeURIComponent(baseQuery)}`
        );
        const data = await res.json();
        const curated = presetObj.curatedTracks[targetVibe] || [];
        const fetched: TrackItem[] = data?.tracks || [];

        const merged = [...curated, ...fetched].filter(
          (item, index, self) => index === self.findIndex((t) => t.videoId === item.videoId)
        );

        if (merged.length > 0) {
          setTrackQueue(merged);
          const nextTrack = customQuery ? merged[merged.length - 1] : merged[0];
          setCurrentTrack(nextTrack);

          // Sync with browser tab bridge
          fetch('/api/presets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SYNC_BRIDGE',
              bridgeTrack: {
                videoId: nextTrack.videoId,
                title: nextTrack.title,
                artist: nextTrack.artist,
                vibe: targetVibe,
                volume: isMuted ? 0 : volume,
              },
            }),
          }).catch(() => {});
        }
      } catch {
        const fallback = presetObj.curatedTracks[targetVibe] || INITIAL_PRESETS[0].curatedTracks.EXPLORE;
        setTrackQueue(fallback);
        if (fallback[0]) setCurrentTrack(fallback[0]);
      } finally {
        setIsSearchingYtm(false);
      }
    },
    [profile.favoriteGenres, isMuted, volume]
  );

  // Switch vibe state with reason
  const triggerVibeChange = useCallback(
    (nextVibe: VibeStateId, reason: string, forceImmediate = false) => {
      const now = Date.now();
      const cooldownMs = (profile.hysteresisCooldownSec || 8) * 1000;

      if (!forceImmediate && now - lastVibeSwitchRef.current < cooldownMs) {
        return;
      }

      lastVibeSwitchRef.current = now;
      setCurrentVibe(nextVibe);
      setLastTransitionReason(reason);

      if (audioMode === 'stem-synth' && isPlaying) {
        stemSynth.setVibe(nextVibe);
      }

      fetchTracksForVibe(nextVibe, activePreset);
    },
    [activePreset, audioMode, fetchTracksForVibe, isPlaying, profile.hysteresisCooldownSec]
  );

  // Poll live Windows telemetry
  useEffect(() => {
    if (sensorMode !== 'live-screen') return;

    const poll = async () => {
      try {
        const res = await fetch('/api/telemetry?mode=live-screen');
        const snap: TelemetrySnapshot = await res.json();
        setTelemetry(snap);

        if (
          profile.autoSwitchEnabled &&
          snap.inferredVibe &&
          snap.inferredVibe !== currentVibe
        ) {
          triggerVibeChange(
            snap.inferredVibe,
            `Авто-детекция экрана (${snap.detectedProcess}): накал ${snap.compositeIntensity}% → ${VIBE_STATES[snap.inferredVibe].shortLabel}`
          );
        }
      } catch {
        // ignore transient poll error
      }
    };

    poll();
    const timer = setInterval(poll, 2600);
    return () => clearInterval(timer);
  }, [sensorMode, profile.autoSwitchEnabled, currentVibe, triggerVibeChange]);

  // Manage Web Audio synth lifecycle when audioMode or play state changes
  useEffect(() => {
    if (audioMode === 'stem-synth' && isPlaying && !isMuted) {
      stemSynth.start(currentVibe, volume / 100);
    } else {
      stemSynth.stop();
    }
    return () => {
      if (audioMode !== 'stem-synth') {
        stemSynth.stop();
      }
    };
  }, [audioMode, isPlaying, isMuted, currentVibe, volume]);

  // Simulate specific in-game scenario
  const simulateGameScenario = async (targetVibe: VibeStateId) => {
    setSensorMode('scenario-sim');
    const presetsByVibe: Record<
      VibeStateId,
      { motion: number; crimson: number; luma: number; audio: number; reason: string }
    > = {
      EXPLORE: {
        motion: 22,
        crimson: 8,
        luma: 58,
        audio: 26,
        reason: 'Спокойное перемещение по локации, низкий оптический поток',
      },
      STEALTH: {
        motion: 31,
        crimson: 14,
        luma: 18,
        audio: 22,
        reason: 'Падение яркости кадра до 18% (темная зона / скрытность)',
      },
      COMBAT: {
        motion: 76,
        crimson: 34,
        luma: 50,
        audio: 82,
        reason: 'Резкий скачок движения кадра (76%) и пиков звука игры (82 дБ)',
      },
      BOSSFIGHT: {
        motion: 94,
        crimson: 78,
        luma: 44,
        audio: 96,
        reason: 'Критический красный спектр урона (78%) + максимальная динамика боссфайта',
      },
      VICTORY: {
        motion: 38,
        crimson: 6,
        luma: 84,
        audio: 48,
        reason: 'Спад боевой тревоги, высокая светлая гамма триумфа',
      },
    };

    const cfg = presetsByVibe[targetVibe];
    const composite = Math.round(cfg.motion * 0.42 + cfg.crimson * 0.33 + cfg.audio * 0.25);

    setTelemetry((prev) => ({
      ...prev,
      timestamp: Date.now(),
      motionDelta: cfg.motion,
      crimsonIndex: cfg.crimson,
      luminance: cfg.luma,
      audioPeakDb: cfg.audio,
      compositeIntensity: composite,
      inferredVibe: targetVibe,
      captureMode: 'auto-sim',
    }));

    triggerVibeChange(targetVibe, cfg.reason, true);
  };

  const handleSelectPreset = (preset: GamePreset) => {
    const updatedProfile = { ...profile, activePresetId: preset.id };
    setProfile(updatedProfile);
    fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_PROFILE', profile: updatedProfile }),
    }).catch(() => {});

    fetchTracksForVibe(currentVibe, preset);
    setLastTransitionReason(`Активирован профиль «${preset.presetName}» (${preset.gameTitle})`);
  };

  const handleToggleLike = async (presetId: string) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        const nextLiked = !p.isLiked;
        return {
          ...p,
          isLiked: nextLiked,
          likes: nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
        };
      })
    );
    await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'TOGGLE_LIKE', presetId }),
    }).catch(() => {});
  };

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetGame.trim() || !newPresetTitle.trim()) return;

    const created: Partial<GamePreset> = {
      gameTitle: newPresetGame.trim(),
      shortLabel: newPresetGame.trim().slice(0, 18),
      processNames: [newPresetExe.trim() || 'game.exe'],
      presetName: newPresetTitle.trim(),
      author: profile.username,
      authorHandle: profile.handle,
      category: 'Community Pack',
      description:
        newPresetDesc.trim() ||
        'Пользовательский адаптивный профиль с автоподбором через YouTube Music InnerTube.',
      vibeQueries: {
        EXPLORE: newPresetExploreQ,
        STEALTH: 'dark ambient stealth tension soundtrack',
        COMBAT: newPresetCombatQ,
        BOSSFIGHT: `${newPresetCombatQ} epic boss fight high intensity`,
        VICTORY: 'synthwave victory chill euphoria',
      },
    };

    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE_PRESET', preset: created }),
    });
    const data = await res.json();
    if (data?.store?.presets) {
      setPresets(data.store.presets);
      setProfile(data.store.profile);
    }
    setIsNewPresetOpen(false);
    setNewPresetGame('');
    setNewPresetTitle('');
    setNewPresetExe('');
    setNewPresetDesc('');
  };

  const handleToggleIntegration = async (integrationId: string) => {
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === integrationId ? { ...item, enabled: !item.enabled } : item
      )
    );
    await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'TOGGLE_INTEGRATION', integrationId }),
    }).catch(() => {});
  };

  const handleAddGenreTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreText.trim()) return;
    const existing = profile.favoriteGenres[selectedGenreVibe] || [];
    if (existing.includes(newGenreText.trim())) return;

    const updatedProfile: UserProfile = {
      ...profile,
      favoriteGenres: {
        ...profile.favoriteGenres,
        [selectedGenreVibe]: [...existing, newGenreText.trim()],
      },
    };
    setProfile(updatedProfile);
    setNewGenreText('');
    await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_PROFILE', profile: updatedProfile }),
    }).catch(() => {});
  };

  const handleRemoveGenreTag = async (vibeId: VibeStateId, genre: string) => {
    const updatedProfile: UserProfile = {
      ...profile,
      favoriteGenres: {
        ...profile.favoriteGenres,
        [vibeId]: profile.favoriteGenres[vibeId].filter((g) => g !== genre),
      },
    };
    setProfile(updatedProfile);
    await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_PROFILE', profile: updatedProfile }),
    }).catch(() => {});
  };

  const activeVibeConfig = VIBE_STATES[currentVibe];
  const [isPinnedOverlay, setIsPinnedOverlay] = useState<boolean>(false);
  const [isCompactHud, setIsCompactHud] = useState<boolean>(false);

  // Connect to Standalone Desktop Client IPC & Keyboard Hotkeys (Alt+1..5)
  useEffect(() => {
    const win = window as unknown as {
      gamevibeDesktop?: {
        onGlobalHotkeyVibe?: (cb: (v: VibeStateId) => void) => void;
        onOverlayModeChange?: (cb: (pinned: boolean) => void) => void;
      };
    };

    if (win.gamevibeDesktop?.onGlobalHotkeyVibe) {
      win.gamevibeDesktop.onGlobalHotkeyVibe((vibeId) => {
        simulateGameScenario(vibeId);
      });
    }
    if (win.gamevibeDesktop?.onOverlayModeChange) {
      win.gamevibeDesktop.onOverlayModeChange((pinned) => {
        setIsPinnedOverlay(pinned);
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
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
        simulateGameScenario(map[e.code]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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

  const handleToggleCompactHud = async () => {
    const next = !isCompactHud;
    setIsCompactHud(next);
    const win = window as unknown as {
      gamevibeDesktop?: { setCompactOverlay?: (c: boolean) => Promise<boolean> };
    };
    if (win.gamevibeDesktop?.setCompactOverlay) {
      await win.gamevibeDesktop.setCompactOverlay(next);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080A] text-zinc-100 flex flex-col justify-between relative overflow-x-hidden">
      {/* Standalone Desktop Client Titlebar & Global Hotkey Strip */}
      <div
        className="border-b border-white/10 bg-[#050608] px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[#FF6A00] font-bold">GAMEVIBE DESKTOP CLIENT .EXE</span>
          <span className="hidden sm:inline text-zinc-500">|</span>
          <span className="hidden sm:inline">
            Горячие клавиши в игре: <strong className="text-zinc-200">Alt+1..5</strong> (Смена вайба) ·{' '}
            <strong className="text-zinc-200">Alt+P</strong> (Поверх игры)
          </span>
        </div>

        <div
          className="flex items-center gap-2 pr-28 sm:pr-32"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={handleToggleAlwaysOnTop}
            className={`px-2.5 py-1 rounded border transition-all ${
              isPinnedOverlay
                ? 'bg-[#FF6A00] text-black border-[#FF6A00] font-bold'
                : 'bg-[#11141B] text-zinc-300 border-white/10 hover:text-white'
            }`}
          >
            {isPinnedOverlay ? '📌 Закреплено поверх игры' : '📌 Закрепить поверх игры'}
          </button>

          <button
            type="button"
            onClick={handleToggleCompactHud}
            className={`px-2.5 py-1 rounded border transition-all ${
              isCompactHud
                ? 'bg-emerald-500 text-black border-emerald-500 font-bold'
                : 'bg-[#11141B] text-zinc-300 border-white/10 hover:text-white'
            }`}
          >
            {isCompactHud ? 'Развернуть кокпит' : 'Мини-HUD'}
          </button>
        </div>
      </div>

      {/* Subtle Top Ambient Glow */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-72 opacity-25 blur-3xl transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${activeVibeConfig.accentHex}, transparent 70%)`,
        }}
      />

      {/* Top Navigation & System Status Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07080A]/90 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo + Live Vibe Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FF6A00] flex items-center justify-center text-black font-black shadow-[0_0_25px_rgba(255,106,0,0.45)]">
                <Disc3 className={`w-6 h-6 ${isPlaying ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black tracking-tight text-lg text-white">
                    GAMEVIBE
                  </span>
                  <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30">
                    v1.0 CORE
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Adaptive AI-DJ · YouTube Music InnerTube (Free)
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/10">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-zinc-300">
                Процесс: <strong className="text-white">{telemetry.detectedProcess}</strong>
              </span>
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Основная навигация">
            {[
              { id: 'cockpit', label: 'AI-DJ Кокпит', icon: Activity },
              { id: 'community', label: 'Подборки игроков', icon: Sparkles },
              { id: 'integrations', label: 'Интеграции (6)', icon: Layers },
              { id: 'profile', label: 'Аккаунт и Вкусы', icon: UserCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as NavigationTab)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-[#FF6A00] text-black shadow-[0_0_20px_rgba(255,106,0,0.35)]'
                      : 'bg-[#11141B] text-zinc-300 hover:bg-[#171B24] hover:text-white border border-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-normal">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6 relative z-10">
        {/* ============================================================
            TAB 1: AI-DJ COCKPIT (LIVE SENSOR + VIBE STATE MACHINE + PLAYER)
        ============================================================ */}
        {activeTab === 'cockpit' && (
          <div className="space-y-6">
            {/* Hero Telemetry Banner */}
            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#11141B] via-[#0C0E12] to-[#07080A] p-5 sm:p-6 shadow-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono uppercase bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30">
                      <Zap className="w-3.5 h-3.5" />
                      ТЕКУЩИЙ ВАЙБ: {activeVibeConfig.shortLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-white/5 text-zinc-300 border border-white/10">
                      {activeVibeConfig.bpmRange}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Anti-Cheat Safe (Win32 Optical)
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {activeVibeConfig.label}
                  </h1>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {activeVibeConfig.description}
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                    <span className="text-[#FF6A00]">Последний триггер:</span>
                    <span className="text-zinc-200">{lastTransitionReason}</span>
                  </div>
                </div>

                {/* Sensor Mode Switcher & Active Preset Pill */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 shrink-0">
                  <div className="rounded-xl bg-[#07080A]/90 border border-white/10 p-3 flex items-center gap-3">
                    <Gamepad2 className="w-5 h-5 text-[#FF6A00] shrink-0" />
                    <div>
                      <div className="text-[11px] font-mono uppercase text-zinc-400">
                        Активный профиль игры
                      </div>
                      <div className="text-sm font-bold text-white">
                        {activePreset.gameTitle} — {activePreset.presetName}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSensorMode('live-screen')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono uppercase flex items-center gap-2 border transition-all ${
                        sensorMode === 'live-screen'
                          ? 'bg-[#FF6A00]/20 text-[#FF6A00] border-[#FF6A00]'
                          : 'bg-[#07080A] text-zinc-400 border-white/10 hover:text-white'
                      }`}
                    >
                      <Cpu className="w-4 h-4" />
                      <span>Живой захват ПК</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setProfile((p) => ({ ...p, autoSwitchEnabled: !p.autoSwitchEnabled }))
                      }
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono uppercase flex items-center gap-2 border transition-all ${
                        profile.autoSwitchEnabled
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-[#07080A] text-zinc-400 border-white/10'
                      }`}
                    >
                      <Radio className="w-4 h-4" />
                      <span>
                        Авто-смена: {profile.autoSwitchEnabled ? 'ВКЛ' : 'ПАУЗА'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Telemetry Cockpit Blocks (Comfortable Padding, Full Readability) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <div className="rounded-xl bg-[#07080A]/90 border border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>ОПТИЧЕСКАЯ ДИНАМИКА</span>
                    <span className="text-[#FF6A00] font-bold">{telemetry.motionDelta}%</span>
                  </div>
                  <div className="text-xl font-black text-white">
                    {telemetry.motionDelta >= 60
                      ? 'Высокая скорость'
                      : telemetry.motionDelta >= 35
                      ? 'Средний темп'
                      : 'Статика / Спокойно'}
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#FF6A00] transition-all duration-500"
                      style={{ width: `${telemetry.motionDelta}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Разница соседних кадров экрана (бег, камера, экшен)
                  </p>
                </div>

                <div className="rounded-xl bg-[#07080A]/90 border border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>КРАСНЫЙ СПЕКТР (УРОН/БОСС)</span>
                    <span className="text-red-400 font-bold">{telemetry.crimsonIndex}%</span>
                  </div>
                  <div className="text-xl font-black text-white">
                    {telemetry.crimsonIndex >= 45
                      ? 'Критическая тревога'
                      : telemetry.crimsonIndex >= 25
                      ? 'Боевой контакт'
                      : 'Нормальный фон'}
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${telemetry.crimsonIndex}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Детекция полосок HP боссов, крови и вспышек взрывов
                  </p>
                </div>

                <div className="rounded-xl bg-[#07080A]/90 border border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>ОСВЕЩЕННОСТЬ СЦЕНЫ</span>
                    <span className="text-cyan-400 font-bold">{telemetry.luminance}%</span>
                  </div>
                  <div className="text-xl font-black text-white">
                    {telemetry.luminance <= 28
                      ? 'Тьма / Подземелье'
                      : telemetry.luminance >= 70
                      ? 'Яркий горизонт'
                      : 'Умеренный свет'}
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-500"
                      style={{ width: `${telemetry.luminance}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Определяет переход в режим «Стелс / Напряжение»
                  </p>
                </div>

                <div className="rounded-xl bg-[#07080A]/90 border border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>ИНТЕГРАЛЬНЫЙ НАКАЛ ВАЙБА</span>
                    <span className="text-amber-400 font-bold">
                      {telemetry.compositeIntensity} / 100
                    </span>
                  </div>
                  <div className="text-xl font-black text-white">
                    {VIBE_STATES[currentVibe].shortLabel} ({activeVibeConfig.bpmRange})
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 via-[#FF6A00] to-red-500 transition-all duration-500"
                      style={{ width: `${telemetry.compositeIntensity}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Окно: {telemetry.activeWindowTitle.slice(0, 38)}
                  </p>
                </div>
              </div>

              {/* Interactive Game Moment Simulator Bar */}
              <div className="mt-6 pt-5 border-t border-white/10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase text-[#FF6A00]">
                    Тест-стенд игровых моментов (Ручной или Авто-триггер)
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Нажмите на любую игровую ситуацию ниже, чтобы проверить, как AI-DJ перестроит музыку и темп прямо сейчас:
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {VIBE_ORDER.map((vibeId) => {
                    const cfg = VIBE_STATES[vibeId];
                    const active = currentVibe === vibeId;
                    return (
                      <button
                        key={vibeId}
                        type="button"
                        onClick={() => simulateGameScenario(vibeId)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                          active
                            ? 'bg-[#FF6A00] text-black border-[#FF6A00] shadow-[0_0_20px_rgba(255,106,0,0.4)]'
                            : 'bg-[#171B24] text-zinc-200 border-white/10 hover:border-[#FF6A00]/60 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: active ? '#000000' : cfg.accentHex,
                          }}
                        />
                        <span>{cfg.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Dual Column: Left = YouTube Music / Stem Deck, Right = Dynamic Track Queue & Search */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Active Audio Deck */}
              <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0C0E12] p-5 sm:p-6 flex flex-col justify-between space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono uppercase text-[#FF6A00]">
                      АУДИО-ДВИЖОК (БЕЗ ПОДПИСКИ)
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-0.5">
                      Пульт воспроизведения и морфинга
                    </h2>
                  </div>

                  {/* Output Engine Mode Selector */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-[#07080A] p-1 rounded-xl border border-white/10">
                    {[
                      { id: 'ytm-embed', label: 'YouTube Music Плеер' },
                      { id: 'stem-synth', label: 'FMOD Стемы (WebAudio)' },
                      { id: 'browser-bridge', label: 'Мост для браузера' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setAudioMode(mode.id as AudioOutputMode)}
                        className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          audioMode === mode.id
                            ? 'bg-[#FF6A00] text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode 1: Embedded YouTube Music Stream */}
                {audioMode === 'ytm-embed' && (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video">
                      <iframe
                        key={currentTrack.videoId}
                        title={currentTrack.title}
                        src={`https://www.youtube.com/embed/${currentTrack.videoId}?autoplay=${
                          isPlaying ? 1 : 0
                        }&mute=${isMuted ? 1 : 0}&enablejsapi=1&rel=0`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#11141B] p-4 border border-white/10">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#FF6A00]/20 text-[#FF6A00]">
                            {VIBE_STATES[currentTrack.vibe]?.shortLabel || 'Адаптивный'}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">
                            {currentTrack.genreTag}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">
                          {currentTrack.title}
                        </h3>
                        <p className="text-xs text-zinc-400">{currentTrack.artist}</p>
                      </div>

                      <a
                        href={`https://music.youtube.com/watch?v=${currentTrack.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#FF852B] text-black font-bold text-xs flex items-center gap-2 transition-all"
                      >
                        <span>Открыть в YouTube Music</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Mode 2: Real-Time WebAudio FMOD Stem Synthesizer */}
                {audioMode === 'stem-synth' && (
                  <div className="rounded-xl bg-[#11141B] border border-white/10 p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-mono uppercase text-emerald-400">
                          Процедурный 3-дорожечный движок (0 мс задержка)
                        </span>
                        <h3 className="text-lg font-bold text-white mt-1">
                          Динамическое сведение дорожек под вайб «{activeVibeConfig.shortLabel}»
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          Работает полностью автономно без интернета и подписок. При переходе в Бой или Боссфайт автоматически подмешивает жесткий саб-бас и ритмический пульс.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsPlaying((p) => !p)}
                        className={`min-h-[48px] px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2.5 transition-all ${
                          isPlaying
                            ? 'bg-red-500 text-white'
                            : 'bg-[#FF6A00] text-black shadow-[0_0_25px_rgba(255,106,0,0.4)]'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-4 h-4 fill-current" />
                            <span>Остановить стемы</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Запустить живой звук</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Stem Layers Visualizer */}
                    <div className="space-y-3 pt-2">
                      {[
                        {
                          name: 'Дорожка 1: Ambient Pad & Atmosphere',
                          level:
                            currentVibe === 'EXPLORE' || currentVibe === 'VICTORY'
                              ? 85
                              : 30,
                        },
                        {
                          name: 'Дорожка 2: Cyberpunk Sawtooth Sub-Bass',
                          level:
                            currentVibe === 'BOSSFIGHT'
                              ? 95
                              : currentVibe === 'COMBAT'
                              ? 75
                              : currentVibe === 'STEALTH'
                              ? 60
                              : 20,
                        },
                        {
                          name: 'Дорожка 3: High-Tempo Combat Pulse & Percussion',
                          level:
                            currentVibe === 'BOSSFIGHT'
                              ? 98
                              : currentVibe === 'COMBAT'
                              ? 80
                              : 25,
                        },
                      ].map((stem) => (
                        <div
                          key={stem.name}
                          className="rounded-lg bg-[#07080A] p-3 border border-white/5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-zinc-300">{stem.name}</span>
                            <span className="text-[#FF6A00] font-bold">{stem.level}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-[#FF6A00] transition-all duration-700"
                              style={{ width: `${stem.level}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode 3: Browser Tab Userscript Bridge */}
                {audioMode === 'browser-bridge' && (
                  <div className="rounded-xl bg-[#11141B] border border-white/10 p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <span className="text-xs font-mono uppercase text-[#FF6A00]">
                          Прямая синхронизация с вкладкой music.youtube.com
                        </span>
                        <h3 className="text-lg font-bold text-white">
                          Управление открытой вкладкой YouTube Music в браузере
                        </h3>
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          Если вы привыкли слушать музыку в обычной бесплатной вкладке браузера (с вашим блокировщиком рекламы и аккаунтом), установите наш скрипт в 1 клик. Он каждые 2 секунды получает текущий вайб от GameVibe и сам включает нужный трек.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <a
                        href="/api/userscript"
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[48px] px-4 py-3 rounded-xl bg-[#FF6A00] hover:bg-[#FF852B] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Скачать Userscript (gamevibe-ytm-bridge.user.js)</span>
                      </a>
                      <a
                        href={`https://music.youtube.com/watch?v=${currentTrack.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[48px] px-4 py-3 rounded-xl bg-[#171B24] hover:bg-white/10 text-white border border-white/10 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <ExternalLink className="w-4 h-4 text-[#FF6A00]" />
                        <span>Запустить текущую станцию в вкладке YTM</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Bottom Volume & Crossfade Bar */}
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPlaying((p) => !p)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] text-black font-bold text-xs flex items-center gap-2"
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-4 h-4 fill-current" />
                          <span>Пауза</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Старт AI-DJ</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsMuted((m) => !m)}
                      className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-[#171B24] text-zinc-200 hover:text-white border border-white/10 flex items-center justify-center"
                      aria-label="Переключить звук"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-red-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-[#FF6A00]" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          setIsMuted(false);
                          setVolume(Number(e.target.value));
                        }}
                        className="w-24 sm:w-32 accent-[#FF6A00] cursor-pointer"
                        aria-label="Громкость музыки"
                      />
                      <span className="text-xs font-mono text-zinc-300 w-9">
                        {isMuted ? '0%' : `${volume}%`}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-zinc-400 flex items-center gap-3">
                    <span>Кроссфейд: {profile.crossfadeDurationSec} сек</span>
                    <span>·</span>
                    <span>Анти-дребезг: {profile.hysteresisCooldownSec} сек</span>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Live YouTube Music InnerTube Search & Queue */}
              <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0C0E12] p-5 sm:p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono uppercase text-[#FF6A00]">
                        YOUTUBE MUSIC INNERTUBE (LIVE)
                      </span>
                      <h2 className="text-lg font-extrabold text-white mt-0.5">
                        Очередь треков под вайб «{activeVibeConfig.shortLabel}»
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchTracksForVibe(currentVibe, activePreset)}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-[#171B24] hover:bg-white/10 text-xs font-mono text-zinc-200 border border-white/10 flex items-center gap-1.5"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-[#FF6A00] ${
                          isSearchingYtm ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Обновить</span>
                    </button>
                  </div>

                  {/* Instant InnerTube Search Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (customSearchInput.trim()) {
                        fetchTracksForVibe(currentVibe, activePreset, customSearchInput.trim());
                      }
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customSearchInput}
                        onChange={(e) => setCustomSearchInput(e.target.value)}
                        placeholder="Найти любой трек или жанр в YouTube Music..."
                        className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl bg-[#07080A] border border-white/10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF6A00]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] text-black font-bold text-xs shrink-0"
                    >
                      Найти
                    </button>
                  </form>
                </div>

                {/* Track List */}
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {trackQueue.map((track) => {
                    const isCurrent = currentTrack.videoId === track.videoId;
                    return (
                      <div
                        key={track.videoId}
                        onClick={() => {
                          setCurrentTrack(track);
                          setIsPlaying(true);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-[#FF6A00]/15 border-[#FF6A00] shadow-[0_0_20px_rgba(255,106,0,0.15)]'
                            : 'bg-[#11141B] border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-12 h-12 rounded-lg object-cover shrink-0 bg-zinc-900"
                          />
                          <div className="space-y-0.5">
                            <div className="text-xs sm:text-sm font-bold text-white leading-snug">
                              {track.title}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {track.artist} · <span className="font-mono">{track.duration}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-[#FF6A00] text-black'
                              : 'bg-[#171B24] text-zinc-300 hover:text-white'
                          }`}
                          aria-label={`Включить ${track.title}`}
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
                  <span>Источник: YouTube Music InnerTube (Без API-ключа)</span>
                  <span className="text-emerald-400 font-mono">0 ₽ / FREE</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: COMMUNITY PRESETS HUB (ПОДБОРКИ ОТ ИГРОКОВ)
        ============================================================ */}
        {activeTab === 'community' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0C0E12] p-5 sm:p-6">
              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-[#FF6A00]">
                  COMMUNITY VIBE HUB · ОБЛАКО ПРЕСЕТОВ
                </span>
                <h1 className="text-2xl font-black text-white">
                  Готовые саундтрек-профили от сообщества игроков
                </h1>
                <p className="text-sm text-zinc-400">
                  Каждый пресет содержит настроенные пороги срабатывания (боссфайт, стелс, клатч) и поисковые формулы YouTube Music под конкретную игру.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsNewPresetOpen(true)}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-[#FF6A00] hover:bg-[#FF852B] text-black font-bold text-xs sm:text-sm flex items-center gap-2 shrink-0 shadow-[0_0_25px_rgba(255,106,0,0.35)]"
              >
                <Plus className="w-4 h-4" />
                <span>Создать свой пресет</span>
              </button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {presets.map((preset) => {
                const isSelected = profile.activePresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`rounded-2xl border p-6 bg-gradient-to-br ${
                      preset.coverGradient
                    } flex flex-col justify-between gap-5 transition-all ${
                      isSelected
                        ? 'border-[#FF6A00] shadow-[0_0_30px_rgba(255,106,0,0.2)]'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-black/60 text-[#FF6A00] border border-[#FF6A00]/30">
                            {preset.category}
                          </span>
                          <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-black/50 text-zinc-300 border border-white/10">
                            EXE: {preset.processNames.join(', ')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleLike(preset.id)}
                          className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5 border transition-all ${
                            preset.isLiked
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : 'bg-black/50 text-zinc-300 border-white/10 hover:text-white'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              preset.isLiked ? 'fill-red-400 text-red-400' : ''
                            }`}
                          />
                          <span>{preset.likes}</span>
                        </button>
                      </div>

                      <div>
                        <div className="text-xs font-mono text-zinc-400">
                          {preset.gameTitle} · Автор: {preset.author} ({preset.authorHandle})
                        </div>
                        <h2 className="text-xl font-black text-white mt-0.5">
                          {preset.presetName}
                        </h2>
                      </div>

                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {preset.description}
                      </p>

                      {/* Vibe Queries Preview */}
                      <div className="rounded-xl bg-black/60 border border-white/10 p-3.5 space-y-2">
                        <div className="text-[11px] font-mono uppercase text-zinc-400">
                          Формулы автоподбора в этом профиле:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-emerald-400 font-mono">Разведка: </span>
                            <span className="text-zinc-300">{preset.vibeQueries.EXPLORE}</span>
                          </div>
                          <div>
                            <span className="text-[#FF6A00] font-mono">Экшен/Бой: </span>
                            <span className="text-zinc-300">{preset.vibeQueries.COMBAT}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                      <span className="text-xs font-mono text-zinc-400">
                        Установок: {preset.downloads}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          handleSelectPreset(preset);
                          setActiveTab('cockpit');
                        }}
                        className={`min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-emerald-500 text-black'
                            : 'bg-[#FF6A00] hover:bg-[#FF852B] text-black'
                        }`}
                      >
                        <Flame className="w-4 h-4" />
                        <span>
                          {isSelected ? 'Активный профиль (Открыть кокпит)' : 'Подключить этот пресет'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 3: INTEGRATIONS HUB (ЧЕМ БОЛЬШЕ ИНТЕГРАЦИЙ, ТЕМ ЛУЧШЕ)
        ============================================================ */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#0C0E12] p-5 sm:p-6 space-y-2">
              <span className="text-xs font-mono uppercase text-[#FF6A00]">
                МОДУЛЬНАЯ АРХИТЕКТУРА ИНТЕГРАЦИЙ
              </span>
              <h1 className="text-2xl font-black text-white">
                Подключенные источники музыки, сенсоры и игровые API
              </h1>
              <p className="text-sm text-zinc-400">
                Включайте и комбинируйте модули: от бесплатного протокола YouTube Music InnerTube и Tampermonkey-моста до официального Game State Integration для CS2 / Dota 2.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {integrations.map((plugin) => (
                <div
                  key={plugin.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all ${
                    plugin.enabled
                      ? 'bg-[#0C0E12] border-[#FF6A00]/50'
                      : 'bg-[#0C0E12]/60 border-white/10 opacity-80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-mono uppercase bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30">
                        {plugin.badgeText}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {plugin.endpointOrProtocol}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-white">{plugin.name}</h2>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      {plugin.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-zinc-400">
                      Статус: {plugin.enabled ? 'Включен' : 'Отключен'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleIntegration(plugin.id)}
                      className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        plugin.enabled
                          ? 'bg-[#FF6A00] text-black'
                          : 'bg-[#171B24] text-zinc-200 border border-white/10 hover:text-white'
                      }`}
                    >
                      {plugin.enabled ? 'Активен' : 'Включить модуль'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 4: USER PROFILE & TASTE MATRIX (УЧЕТНАЯ ЗАПИСЬ И ВКУСЫ)
        ============================================================ */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Profile Card */}
            <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0C0E12] p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#FF6A00] text-black font-black text-2xl flex items-center justify-center shrink-0">
                  {profile.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-mono uppercase text-[#FF6A00]">
                    {profile.level}
                  </span>
                  <h1 className="text-2xl font-black text-white">{profile.username}</h1>
                  <p className="text-xs font-mono text-zinc-400">{profile.handle}</p>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                    Никнейм куратора в сообществе
                  </label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, username: e.target.value }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#07080A] border border-white/10 text-sm text-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1.5">
                    <span>Длительность DJ-кроссфейда</span>
                    <span className="text-[#FF6A00]">{profile.crossfadeDurationSec} сек</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={profile.crossfadeDurationSec}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        crossfadeDurationSec: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#FF6A00]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1.5">
                    <span>Задержка анти-дребезга (Hysteresis Cooldown)</span>
                    <span className="text-[#FF6A00]">{profile.hysteresisCooldownSec} сек</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={30}
                    value={profile.hysteresisCooldownSec}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        hysteresisCooldownSec: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#FF6A00]"
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Не дает трекам переключаться слишком часто при коротких вспышках на экране.
                  </p>
                </div>
              </div>
            </div>

            {/* Taste Matrix by Vibe */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0C0E12] p-6 space-y-5">
              <div>
                <span className="text-xs font-mono uppercase text-[#FF6A00]">
                  МАТРИЦА МУЗЫКАЛЬНОГО ВКУСА ИГРОКА
                </span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  Какие жанры AI-DJ должен искать для вас в разных состояниях
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Эти теги автоматически добавляются к запросам YouTube Music при смене обстановки в игре.
                </p>
              </div>

              <form onSubmit={handleAddGenreTag} className="flex flex-wrap gap-2">
                <select
                  value={selectedGenreVibe}
                  onChange={(e) => setSelectedGenreVibe(e.target.value as VibeStateId)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#07080A] border border-white/10 text-xs font-mono text-white"
                >
                  {VIBE_ORDER.map((v) => (
                    <option key={v} value={v}>
                      {VIBE_STATES[v].shortLabel}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={newGenreText}
                  onChange={(e) => setNewGenreText(e.target.value)}
                  placeholder="Добавить жанр (например, Witch House, Post-Rock, Neurofunk)..."
                  className="flex-1 min-w-[200px] min-h-[44px] px-3.5 py-2 rounded-xl bg-[#07080A] border border-white/10 text-xs sm:text-sm text-white"
                />

                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] text-black font-bold text-xs"
                >
                  Добавить жанр
                </button>
              </form>

              <div className="space-y-3">
                {VIBE_ORDER.map((vibeId) => {
                  const cfg = VIBE_STATES[vibeId];
                  const tags = profile.favoriteGenres[vibeId] || [];
                  return (
                    <div
                      key={vibeId}
                      className="rounded-xl bg-[#11141B] border border-white/5 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-white">
                          {cfg.shortLabel} ({cfg.bpmRange})
                        </span>
                        <span className="text-zinc-400">{cfg.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((genre) => (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => handleRemoveGenreTag(vibeId, genre)}
                            className="min-h-[36px] px-3 py-1 rounded-lg bg-[#07080A] hover:bg-red-500/20 text-xs text-zinc-200 hover:text-red-300 border border-white/10 flex items-center gap-1.5 transition-all"
                          >
                            <span>{genre}</span>
                            <span className="text-zinc-500">×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Community Preset Modal */}
      {isNewPresetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsNewPresetOpen(false)}
        >
          <div
            className="max-w-lg w-full rounded-2xl border border-white/15 bg-[#0C0E12] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">
                Опубликовать новый пресет игры
              </h2>
              <button
                type="button"
                onClick={() => setIsNewPresetOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 text-zinc-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePreset} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Название игры
                </label>
                <input
                  type="text"
                  required
                  value={newPresetGame}
                  onChange={(e) => setNewPresetGame(e.target.value)}
                  placeholder="Например: The Witcher 3 / Helldivers 2"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#07080A] border border-white/10 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Название вашей подборки
                </label>
                <input
                  type="text"
                  required
                  value={newPresetTitle}
                  onChange={(e) => setNewPresetTitle(e.target.value)}
                  placeholder="Например: Slavonic Dark Folk & Heavy Metal"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#07080A] border border-white/10 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Процесс игры (EXE для автоопределения)
                </label>
                <input
                  type="text"
                  value={newPresetExe}
                  onChange={(e) => setNewPresetExe(e.target.value)}
                  placeholder="witcher3.exe"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#07080A] border border-white/10 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Что искать в YouTube Music при Спокойном исследовании:
                </label>
                <input
                  type="text"
                  value={newPresetExploreQ}
                  onChange={(e) => setNewPresetExploreQ(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#07080A] border border-white/10 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Что искать в YouTube Music во время Боя / Экшена:
                </label>
                <input
                  type="text"
                  value={newPresetCombatQ}
                  onChange={(e) => setNewPresetCombatQ(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#07080A] border border-white/10 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Описание особенностей пресета
                </label>
                <textarea
                  rows={2}
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="Кратко опишите атмосферу подборки..."
                  className="w-full p-3 rounded-xl bg-[#07080A] border border-white/10 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPresetOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#FF6A00] text-black font-bold text-xs"
                >
                  Сохранить и активировать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Status Bar */}
      <footer className="border-t border-white/10 bg-[#07080A] py-3 px-4 sm:px-6 text-xs text-zinc-400">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-[#FF6A00]" />
            <span>
              GameVibe Desktop Engine v1.0 · Локальный сервер: http://localhost:3000
            </span>
          </div>
          <div className="font-mono text-zinc-400">
            Протокол: InnerTube WEB_REMIX + Win32 Optical Telemetry
          </div>
        </div>
      </footer>
    </div>
  );
}
