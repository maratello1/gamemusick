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
  Pin,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  SkipForward,
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

const SPECTRUM_WEIGHTS = [
  0.32, 0.48, 0.65, 0.82, 0.55, 0.92, 0.74, 0.61, 0.88, 0.96, 0.72, 0.54, 0.79,
  0.91, 0.66, 0.45, 0.84, 0.95, 0.77, 0.58, 0.69, 0.87, 0.62, 0.49, 0.76, 0.93,
  0.81, 0.59, 0.44, 0.71, 0.86, 0.64, 0.52, 0.78, 0.89, 0.57, 0.41, 0.68, 0.53,
  0.37,
];

export default function GameVibeApp() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('cockpit');
  const [presets, setPresets] = useState<GamePreset[]>(INITIAL_PRESETS);
  const [profile, setProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [integrations, setIntegrations] = useState<IntegrationPlugin[]>(INITIAL_INTEGRATIONS);

  const [currentVibe, setCurrentVibe] = useState<VibeStateId>('EXPLORE');
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    timestamp: Date.now(),
    activeWindowTitle: 'Windows Desktop / GameVibe Studio',
    detectedProcess: 'explorer.exe',
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
    'Ожидание боевого триггера · Спокойное исследование'
  );

  const [isPinnedOverlay, setIsPinnedOverlay] = useState<boolean>(false);
  const [isCompactHud, setIsCompactHud] = useState<boolean>(false);

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

  // Fetch tracks from YouTube Music InnerTube API
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
        const fallback =
          presetObj.curatedTracks[targetVibe] || INITIAL_PRESETS[0].curatedTracks.EXPLORE;
        setTrackQueue(fallback);
        if (fallback[0]) setCurrentTrack(fallback[0]);
      } finally {
        setIsSearchingYtm(false);
      }
    },
    [profile.favoriteGenres, isMuted, volume]
  );

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
            `Авто-триггер (${snap.detectedProcess}): индекс ${snap.compositeIntensity}% → ${VIBE_STATES[snap.inferredVibe].shortLabel}`
          );
        }
      } catch {
        // ignore
      }
    };

    poll();
    const timer = setInterval(poll, 2600);
    return () => clearInterval(timer);
  }, [sensorMode, profile.autoSwitchEnabled, currentVibe, triggerVibeChange]);

  // Manage Web Audio synth lifecycle
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

  const simulateGameScenario = useCallback(
    async (targetVibe: VibeStateId) => {
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
          reason: 'Спокойное исследование мира · Низкий оптический поток',
        },
        STEALTH: {
          motion: 31,
          crimson: 14,
          luma: 18,
          audio: 22,
          reason: 'Падение освещенности до 18% · Темный сектор / Стелс',
        },
        COMBAT: {
          motion: 76,
          crimson: 34,
          luma: 50,
          audio: 82,
          reason: 'Высокая динамика кадра (76%) + пики выстрелов (82 дБ)',
        },
        BOSSFIGHT: {
          motion: 94,
          crimson: 78,
          luma: 44,
          audio: 96,
          reason: 'Красный спектр урона (78%) + максимальный темп боссфайта',
        },
        VICTORY: {
          motion: 38,
          crimson: 6,
          luma: 84,
          audio: 48,
          reason: 'Завершение боя · Эйфория и послебоевое остывание',
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
    },
    [triggerVibeChange]
  );

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
  }, [simulateGameScenario]);

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

  const handleSelectPreset = (preset: GamePreset) => {
    const updatedProfile = { ...profile, activePresetId: preset.id };
    setProfile(updatedProfile);
    fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_PROFILE', profile: updatedProfile }),
    }).catch(() => {});

    fetchTracksForVibe(currentVibe, preset);
    setLastTransitionReason(`Профиль: ${preset.gameTitle} — ${preset.presetName}`);
  };

  const handleNextTrack = () => {
    const idx = trackQueue.findIndex((t) => t.videoId === currentTrack.videoId);
    const nextIdx = (idx + 1) % Math.max(1, trackQueue.length);
    if (trackQueue[nextIdx]) {
      setCurrentTrack(trackQueue[nextIdx]);
      setIsPlaying(true);
    }
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

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#060709] text-[#F4F5F8] flex flex-col justify-between relative select-none">
      {/* Subtle Ambient Aura Behind Studio */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20 transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at 42% 18%, ${activeVibeConfig.accentHex}33 0%, transparent 55%)`,
        }}
      />

      {/* =====================================================================
          1. CUSTOM FRAMELESS DESKTOP TITLEBAR
      ===================================================================== */}
      <header
        className="h-11 shrink-0 border-b border-white/[0.07] bg-[#050608]/95 backdrop-blur-md px-3.5 flex items-center justify-between gap-2 z-30"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#FF6A00] flex items-center justify-center text-black shadow-[0_0_16px_rgba(255,106,0,0.6)]">
              <Disc3 className={`w-3.5 h-3.5 ${isPlaying ? 'animate-spin' : ''}`} />
            </div>
            <span className="font-extrabold tracking-wider text-xs uppercase text-white">
              GAMEVIBE
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30">
              STUDIO 1.0
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-2.5 border-l border-white/[0.08] text-[11px] font-mono text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>WIN32 SENSOR:</span>
            <span className="text-zinc-200 font-semibold">{telemetry.detectedProcess}</span>
          </div>
        </div>

        {/* Center Hotkey Hints */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
          <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-zinc-300">
            ALT + 1..5
          </span>
          <span>Смена вайба в игре</span>
          <span className="text-zinc-600 mx-1">·</span>
          <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-zinc-300">
            ALT + P
          </span>
          <span>Оверлей поверх игры</span>
        </div>

        {/* Right Window Mode Controls */}
        <div
          className="flex items-center gap-2 pr-28 sm:pr-32"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={handleToggleAlwaysOnTop}
            className={`min-h-[30px] px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-1.5 border transition-all ${
              isPinnedOverlay
                ? 'bg-[#FF6A00] text-black border-[#FF6A00] font-bold shadow-[0_0_14px_rgba(255,106,0,0.4)]'
                : 'bg-[#10131B] text-zinc-300 border-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            <Pin className="w-3 h-3" />
            <span>{isPinnedOverlay ? 'ПОВЕРХ ИГРЫ: ВКЛ' : 'ПОВЕРХ ИГРЫ'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleCompactHud}
            className={`min-h-[30px] px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
              isCompactHud
                ? 'bg-emerald-500 text-black border-emerald-500 font-bold'
                : 'bg-[#10131B] text-zinc-300 border-white/[0.08] hover:text-white'
            }`}
          >
            {isCompactHud ? 'FULL STUDIO' : 'MINI-HUD'}
          </button>
        </div>
      </header>

      {/* =====================================================================
          2. MAIN 3-PANE DESKTOP WORKSPACE
      ===================================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative z-10">
        {/* -------------------------------------------------------------------
            LEFT SIDEBAR: NAVIGATION + QUICK GAME PROFILE SWITCHER
        ------------------------------------------------------------------- */}
        <aside className="lg:w-[248px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.07] bg-[#080A0F]/90 flex flex-col justify-between p-3 gap-4">
          <div className="space-y-4">
            {/* Navigation Menu */}
            <nav className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1" aria-label="Навигация">
              {[
                { id: 'cockpit', label: 'AI-DJ Студия', sub: 'Телеметрия и поток', icon: Activity },
                { id: 'community', label: 'Пресеты игр', sub: `${presets.length} профилей`, icon: Sparkles },
                { id: 'integrations', label: 'Интеграции', sub: '6 модулей ядра', icon: Layers },
                { id: 'profile', label: 'Мои вкусы', sub: profile.username, icon: UserCheck },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id as NavigationTab)}
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-all relative ${
                      active
                        ? 'bg-[#141824] text-white border border-[#FF6A00]/40 shadow-[inset_3px_0_0_#FF6A00]'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        active ? 'bg-[#FF6A00] text-black' : 'bg-[#10131B] text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight">{item.label}</div>
                      <div className="text-[10px] font-mono text-zinc-500 leading-tight mt-0.5">
                        {item.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Quick Game Preset Selector right inside Sidebar */}
            <div className="hidden lg:block pt-3 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  АКТИВНЫЙ ПРОФИЛЬ ИГРЫ
                </span>
                <button
                  type="button"
                  onClick={() => setIsNewPresetOpen(true)}
                  className="text-[11px] font-mono text-[#FF6A00] hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Новый</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-0.5">
                {presets.map((p) => {
                  const selected = p.id === activePreset.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`w-full min-h-[44px] px-2.5 py-2 rounded-xl text-left transition-all flex items-center justify-between gap-2 border ${
                        selected
                          ? 'bg-[#FF6A00]/12 border-[#FF6A00]/50 text-white'
                          : 'bg-[#0D1017] border-white/[0.05] text-zinc-400 hover:text-zinc-200 hover:border-white/15'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white leading-snug">
                          {p.shortLabel}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 leading-tight">
                          {p.category}
                        </div>
                      </div>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          selected ? 'bg-[#FF6A00] shadow-[0_0_8px_#FF6A00]' : 'bg-zinc-700'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Sensor Control Widget */}
          <div className="hidden lg:flex flex-col gap-2 rounded-xl bg-[#0D1017] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>EAC / Vanguard Safe</span>
              </span>
              <span className="text-[10px] font-mono text-[#FF6A00]">1 FPS GDI+</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setSensorMode('live-screen')}
                className={`min-h-[36px] px-2 py-1.5 rounded-lg text-[10px] font-mono uppercase border transition-all ${
                  sensorMode === 'live-screen'
                    ? 'bg-[#FF6A00] text-black border-[#FF6A00] font-bold'
                    : 'bg-[#080A0F] text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                Захват ПК
              </button>
              <button
                type="button"
                onClick={() =>
                  setProfile((p) => ({ ...p, autoSwitchEnabled: !p.autoSwitchEnabled }))
                }
                className={`min-h-[36px] px-2 py-1.5 rounded-lg text-[10px] font-mono uppercase border transition-all ${
                  profile.autoSwitchEnabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-[#080A0F] text-zinc-400 border-white/10'
                }`}
              >
                {profile.autoSwitchEnabled ? 'Авто: ВКЛ' : 'Авто: ВЫКЛ'}
              </button>
            </div>
          </div>
        </aside>

        {/* -------------------------------------------------------------------
            CENTER WORKSPACE: STUDIO CANVAS / COMMUNITY / INTEGRATIONS / PROFILE
        ------------------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 min-w-0">
          {activeTab === 'cockpit' && (
            <>
              {/* TOP STUDIO DECK: VIBE RADAR + SPECTRUM + HARDWARE TELEMETRY */}
              <section className="studio-panel rounded-2xl p-4 sm:p-5 space-y-4 relative overflow-hidden">
                {/* Top Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono uppercase font-bold"
                        style={{
                          backgroundColor: `${activeVibeConfig.accentHex}22`,
                          color: activeVibeConfig.accentHex,
                          border: `1px solid ${activeVibeConfig.accentHex}55`,
                        }}
                      >
                        <Zap className="w-3 h-3" />
                        ВАЙБ: {activeVibeConfig.shortLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white/[0.05] text-zinc-300 border border-white/[0.08]">
                        {activeVibeConfig.bpmRange}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white/[0.03] text-zinc-400">
                        Профиль: <strong className="text-zinc-200">{activePreset.gameTitle}</strong>
                      </span>
                    </div>

                    <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                      {activeVibeConfig.label}
                    </h1>
                    <p className="text-xs text-zinc-400">
                      {lastTransitionReason}
                    </p>
                  </div>

                  {/* Output Engine Mode Selector Pills */}
                  <div className="flex flex-wrap items-center gap-1 bg-[#07090D] p-1 rounded-xl border border-white/[0.08]">
                    {[
                      { id: 'ytm-embed', label: 'YTM Поток' },
                      { id: 'stem-synth', label: 'FMOD Стемы' },
                      { id: 'browser-bridge', label: 'Мост браузера' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setAudioMode(mode.id as AudioOutputMode)}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          audioMode === mode.id
                            ? 'bg-[#FF6A00] text-black shadow-[0_0_12px_rgba(255,106,0,0.4)]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* INTERACTIVE 5-NODE VIBE STATE MATRIX & SPECTRUM VISUALIZER */}
                <div className="rounded-xl bg-[#07090D]/90 border border-white/[0.07] p-3.5 space-y-3 relative overflow-hidden">
                  {/* Live Animated 40-Bar Audio/Optical Spectrum */}
                  <div className="h-14 flex items-end justify-between gap-1 px-1 pt-2">
                    {SPECTRUM_WEIGHTS.map((w, idx) => {
                      const scale = Math.max(
                        14,
                        Math.min(
                          100,
                          Math.round(w * (telemetry.compositeIntensity * 0.85 + 22))
                        )
                      );
                      return (
                        <div
                          key={idx}
                          className={`flex-1 rounded-t transition-all duration-300 ${
                            isPlaying ? 'eq-bar' : ''
                          }`}
                          style={{
                            height: `${scale}%`,
                            animationDelay: `${(idx % 7) * 0.11}s`,
                            background:
                              idx % 3 === 0
                                ? activeVibeConfig.accentHex
                                : 'rgba(255, 106, 0, 0.42)',
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* 5 Interactive Vibe Trigger Nodes */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-white/[0.06]">
                    {VIBE_ORDER.map((vibeId, idx) => {
                      const cfg = VIBE_STATES[vibeId];
                      const active = currentVibe === vibeId;
                      return (
                        <button
                          key={vibeId}
                          type="button"
                          onClick={() => simulateGameScenario(vibeId)}
                          className={`min-h-[48px] px-3 py-2 rounded-xl text-left transition-all border flex flex-col justify-between ${
                            active
                              ? 'bg-[#FF6A00] text-black border-[#FF6A00] shadow-[0_0_20px_rgba(255,106,0,0.35)]'
                              : 'bg-[#0E1118] text-zinc-300 border-white/[0.07] hover:border-[#FF6A00]/50 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full text-[10px] font-mono">
                            <span className={active ? 'text-black/80 font-bold' : 'text-zinc-500'}>
                              0{idx + 1} · ALT+{idx + 1}
                            </span>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: active ? '#000' : cfg.accentHex,
                              }}
                            />
                          </div>
                          <div className="text-xs font-extrabold tracking-tight mt-1">
                            {cfg.shortLabel}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4 PRECISION HARDWARE TELEMETRY METERS */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'OPTICAL MOTION',
                      sub: 'Динамика кадра',
                      value: `${telemetry.motionDelta}%`,
                      pct: telemetry.motionDelta,
                      color: '#FF6A00',
                    },
                    {
                      label: 'CRIMSON FLASH',
                      sub: 'Спектр урона / Босс',
                      value: `${telemetry.crimsonIndex}%`,
                      pct: telemetry.crimsonIndex,
                      color: '#EF4444',
                    },
                    {
                      label: 'SCENE LUMINANCE',
                      sub: 'Свет / Стелс-триггер',
                      value: `${telemetry.luminance}%`,
                      pct: telemetry.luminance,
                      color: '#06B6D4',
                    },
                    {
                      label: 'VIBE INTENSITY',
                      sub: activeVibeConfig.bpmRange,
                      value: `${telemetry.compositeIntensity} / 100`,
                      pct: telemetry.compositeIntensity,
                      color: '#10B981',
                    },
                  ].map((meter) => (
                    <div
                      key={meter.label}
                      className="rounded-xl bg-[#090B10] border border-white/[0.06] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-zinc-400">{meter.label}</span>
                        <span className="font-bold text-white">{meter.value}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 rounded-full"
                          style={{
                            width: `${meter.pct}%`,
                            backgroundColor: meter.color,
                          }}
                        />
                      </div>
                      <div className="text-[11px] text-zinc-400">{meter.sub}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* BOTTOM STUDIO DECK: STREAM DECK + 3-STEM FMOD MIXER */}
              <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                {/* Left 7 Cols: Active Audio Stream / FMOD / Bridge Deck */}
                <div className="xl:col-span-7 studio-panel rounded-2xl p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#FF6A00]" />
                      <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                        {audioMode === 'ytm-embed'
                          ? 'YOUTUBE MUSIC INNERTUBE STREAM'
                          : audioMode === 'stem-synth'
                          ? 'FMOD WEB-AUDIO PROCEDURAL SYNTH'
                          : 'TAMPERMONKEY BROWSER TAB BRIDGE'}
                      </h2>
                    </div>
                    <a
                      href={`https://music.youtube.com/watch?v=${currentTrack.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-[#FF6A00] hover:underline flex items-center gap-1"
                    >
                      <span>Открыть в YTM</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {audioMode === 'ytm-embed' && (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-7 rounded-xl overflow-hidden border border-white/10 bg-black aspect-video max-h-[195px] w-full">
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

                      <div className="sm:col-span-5 space-y-2.5 p-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30">
                          {currentTrack.genreTag}
                        </span>
                        <h3 className="text-sm font-bold text-white leading-snug">
                          {currentTrack.title}
                        </h3>
                        <p className="text-xs text-zinc-400">{currentTrack.artist}</p>
                        <div className="pt-1 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setIsPlaying((p) => !p)}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FF6A00] text-black font-bold text-xs flex items-center gap-1.5"
                          >
                            {isPlaying ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>Стоп</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Играть</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleNextTrack}
                            className="min-h-[40px] px-3 py-2 rounded-xl bg-[#141824] text-zinc-200 hover:text-white border border-white/10 text-xs flex items-center gap-1"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            <span>След.</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {audioMode === 'stem-synth' && (
                    <div className="rounded-xl bg-[#080A0F] border border-white/[0.06] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-mono text-emerald-400">
                          АВТОНОМНЫЙ FMOD-СИНТЕЗАТОР · ЗАДЕРЖКА 0 МС
                        </div>
                        <h3 className="text-sm font-bold text-white">
                          Многодорожечный генератор адаптивных слоев
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Плавно подмешивает саб-бас и боевой пульс при росте интенсивности кадра.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPlaying((p) => !p)}
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FF6A00] text-black font-bold text-xs shrink-0 flex items-center gap-2"
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-4 h-4 fill-current" />
                            <span>Остановить</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Запустить стемы</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {audioMode === 'browser-bridge' && (
                    <div className="rounded-xl bg-[#080A0F] border border-white/[0.06] p-4 space-y-3">
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Установите наш скрипт в расширение Tampermonkey, чтобы GameVibe автоматически управлял вашей открытой вкладкой <code className="text-[#FF6A00]">music.youtube.com</code> без подписки:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href="/api/userscript"
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6A00] text-black font-bold text-xs flex items-center gap-2"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Установить Userscript</span>
                        </a>
                        <a
                          href={`https://music.youtube.com/watch?v=${currentTrack.videoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#141824] text-white border border-white/10 text-xs flex items-center gap-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#FF6A00]" />
                          <span>Открыть вкладку YTM</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right 5 Cols: Live 3-Stem FMOD Channel Mixer */}
                <div className="xl:col-span-5 studio-panel rounded-2xl p-4 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#FF6A00]" />
                      <span>МИКШЕР СЛОЕВ (STEM MATRIX)</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#FF6A00]">
                      XFADE {profile.crossfadeDurationSec}.0s
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      {
                        label: 'CH 01 // AMBIENT PAD',
                        level:
                          currentVibe === 'EXPLORE' || currentVibe === 'VICTORY' ? 88 : 28,
                      },
                      {
                        label: 'CH 02 // CYBER SUB-BASS',
                        level:
                          currentVibe === 'BOSSFIGHT'
                            ? 95
                            : currentVibe === 'COMBAT'
                            ? 78
                            : currentVibe === 'STEALTH'
                            ? 62
                            : 22,
                      },
                      {
                        label: 'CH 03 // COMBAT PULSE',
                        level:
                          currentVibe === 'BOSSFIGHT'
                            ? 98
                            : currentVibe === 'COMBAT'
                            ? 84
                            : 24,
                      },
                    ].map((ch) => (
                      <div
                        key={ch.label}
                        className="rounded-xl bg-[#090B10] border border-white/[0.05] px-3 py-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-300">{ch.label}</span>
                          <span className="text-[#FF6A00] font-bold">{ch.level}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className="h-full bg-[#FF6A00] transition-all duration-700"
                            style={{ width: `${ch.level}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* =================================================================
              TAB 2: COMMUNITY PRESETS HUB
          ================================================================= */}
          {activeTab === 'community' && (
            <div className="space-y-4">
              <div className="studio-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-mono uppercase text-[#FF6A00]">
                    COMMUNITY VIBE HUB
                  </span>
                  <h1 className="text-xl font-extrabold text-white mt-0.5">
                    Подборки и пресеты от игроков
                  </h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Готовые профили с привязкой к .EXE процессу игры и настроенными формулами YouTube Music.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewPresetOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#FF852B] text-black font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(255,106,0,0.35)]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Создать свой пресет</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {presets.map((preset) => {
                  const isSelected = profile.activePresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className={`studio-panel rounded-2xl p-5 flex flex-col justify-between gap-4 border ${
                        isSelected ? 'border-[#FF6A00]' : 'border-white/[0.07]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30">
                              {preset.category}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.05] text-zinc-300">
                              {preset.processNames.join(', ')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleLike(preset.id)}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 border ${
                              preset.isLiked
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-white/[0.04] text-zinc-300 border-white/10'
                            }`}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                preset.isLiked ? 'fill-red-400 text-red-400' : ''
                              }`}
                            />
                            <span>{preset.likes}</span>
                          </button>
                        </div>

                        <div>
                          <div className="text-xs font-mono text-zinc-400">
                            {preset.gameTitle} · {preset.authorHandle}
                          </div>
                          <h2 className="text-base font-extrabold text-white mt-0.5">
                            {preset.presetName}
                          </h2>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {preset.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between">
                        <span className="text-[11px] font-mono text-zinc-400">
                          Установок: {preset.downloads}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectPreset(preset);
                            setActiveTab('cockpit');
                          }}
                          className={`min-h-[40px] px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-500 text-black'
                              : 'bg-[#FF6A00] text-black hover:bg-[#FF852B]'
                          }`}
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Активен' : 'Выбрать профиль'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 3: INTEGRATIONS HUB
          ================================================================= */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <div className="studio-panel rounded-2xl p-5">
                <span className="text-[11px] font-mono uppercase text-[#FF6A00]">
                  MODULAR ARCHITECTURE
                </span>
                <h1 className="text-xl font-extrabold text-white mt-0.5">
                  Подключенные модули и игровые интеграции
                </h1>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="studio-panel rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/30">
                          {plugin.badgeText}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {plugin.endpointOrProtocol}
                        </span>
                      </div>
                      <h2 className="text-sm font-bold text-white">{plugin.name}</h2>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {plugin.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400">
                        {plugin.enabled ? 'Модуль активен' : 'Отключен'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleIntegration(plugin.id)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                          plugin.enabled
                            ? 'bg-[#FF6A00] text-black'
                            : 'bg-[#141824] text-zinc-300 border border-white/10'
                        }`}
                      >
                        {plugin.enabled ? 'Включен' : 'Включить'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 4: USER TASTE MATRIX & SETTINGS
          ================================================================= */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="xl:col-span-5 studio-panel rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#FF6A00] text-black font-black text-lg flex items-center justify-center">
                    {profile.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-[#FF6A00]">{profile.level}</div>
                    <h1 className="text-lg font-extrabold text-white">{profile.username}</h1>
                    <div className="text-xs font-mono text-zinc-400">{profile.handle}</div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-white/[0.07]">
                  <div>
                    <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                      <span>Кроссфейд переходов</span>
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
                    <div className="flex justify-between text-xs font-mono text-zinc-300 mb-1">
                      <span>Анти-дребезг (Cooldown)</span>
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
                  </div>
                </div>
              </div>

              <div className="xl:col-span-7 studio-panel rounded-2xl p-5 space-y-4">
                <div>
                  <span className="text-[11px] font-mono uppercase text-[#FF6A00]">
                    МАТРИЦА ЖАНРОВ ИГРОКА
                  </span>
                  <h2 className="text-base font-extrabold text-white mt-0.5">
                    Любимые жанры по состояниям игры
                  </h2>
                </div>

                <form onSubmit={handleAddGenreTag} className="flex flex-wrap gap-2">
                  <select
                    value={selectedGenreVibe}
                    onChange={(e) => setSelectedGenreVibe(e.target.value as VibeStateId)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#080A0F] border border-white/10 text-xs font-mono text-white"
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
                    placeholder="Жанр (например, Witch House, Neurofunk)..."
                    className="flex-1 min-w-[180px] min-h-[40px] px-3 py-1.5 rounded-xl bg-[#080A0F] border border-white/10 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#FF6A00] text-black font-bold text-xs"
                  >
                    Добавить
                  </button>
                </form>

                <div className="space-y-2">
                  {VIBE_ORDER.map((vibeId) => (
                    <div
                      key={vibeId}
                      className="rounded-xl bg-[#090B10] border border-white/[0.06] p-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold text-white font-mono">
                        {VIBE_STATES[vibeId].shortLabel}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(profile.favoriteGenres[vibeId] || []).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleRemoveGenreTag(vibeId, g)}
                            className="px-2.5 py-1 rounded-lg bg-[#121622] hover:bg-red-500/20 text-[11px] text-zinc-200 border border-white/10"
                          >
                            {g} ×
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* -------------------------------------------------------------------
            RIGHT INSPECTOR DOCK: LIVE YOUTUBE MUSIC INNERTUBE QUEUE & SEARCH
        ------------------------------------------------------------------- */}
        <aside className="lg:w-[340px] xl:w-[370px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.07] bg-[#080A0F]/95 flex flex-col min-h-0 p-3.5 gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF6A00]">
                YOUTUBE MUSIC INNERTUBE
              </span>
              <h2 className="text-sm font-extrabold text-white">
                Поток под «{activeVibeConfig.shortLabel}»
              </h2>
            </div>

            <button
              type="button"
              onClick={() => fetchTracksForVibe(currentVibe, activePreset)}
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#121622] hover:bg-white/10 text-[11px] font-mono text-zinc-200 border border-white/[0.08] flex items-center gap-1.5"
            >
              <RefreshCw
                className={`w-3 h-3 text-[#FF6A00] ${isSearchingYtm ? 'animate-spin' : ''}`}
              />
              <span>Обновить</span>
            </button>
          </div>

          {/* Search Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customSearchInput.trim()) {
                fetchTracksForVibe(currentVibe, activePreset, customSearchInput.trim());
              }
            }}
            className="flex gap-1.5"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customSearchInput}
                onChange={(e) => setCustomSearchInput(e.target.value)}
                placeholder="Поиск в YouTube Music..."
                className="w-full min-h-[38px] pl-8 pr-2.5 py-1.5 rounded-xl bg-[#0D1017] border border-white/[0.08] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF6A00]"
              />
            </div>
            <button
              type="submit"
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FF6A00] text-black font-bold text-xs shrink-0"
            >
              Найти
            </button>
          </form>

          {/* Scrollable Track Cards */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 max-h-[360px] lg:max-h-none">
            {trackQueue.map((track) => {
              const isCurrent = currentTrack.videoId === track.videoId;
              return (
                <div
                  key={track.videoId}
                  onClick={() => {
                    setCurrentTrack(track);
                    setIsPlaying(true);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isCurrent
                      ? 'bg-[#FF6A00]/14 border-[#FF6A00]/60 shadow-[0_4px_20px_rgba(255,106,0,0.14)]'
                      : 'studio-card'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-white/10">
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-bold text-white leading-snug">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-1.5">
                        <span>{track.artist}</span>
                        <span>·</span>
                        <span className="font-mono text-[#FF6A00]">{track.duration}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-[#FF6A00] text-black'
                        : 'bg-[#141824] text-zinc-300 hover:text-white'
                    }`}
                    aria-label={`Включить ${track.title}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* =====================================================================
          3. PERSISTENT BOTTOM SPOTIFY / METROLIST-STYLE PLAYER DOCK
      ===================================================================== */}
      <footer className="h-20 shrink-0 border-t border-white/[0.08] bg-[#080A0F]/95 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4 z-30">
        {/* Left: Now Playing Artwork & Track Info */}
        <div className="flex items-center gap-3 min-w-0 max-w-[340px]">
          <img
            src={currentTrack.thumbnail}
            alt={currentTrack.title}
            className={`w-12 h-12 rounded-xl object-cover shrink-0 border ${
              isPlaying ? 'border-[#FF6A00] shadow-[0_0_15px_rgba(255,106,0,0.35)]' : 'border-white/10'
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-[#FF6A00]/20 text-[#FF6A00]">
                {activeVibeConfig.shortLabel}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {currentTrack.duration}
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-white leading-tight mt-0.5">
              {currentTrack.title}
            </div>
            <div className="text-[11px] text-zinc-400">{currentTrack.artist}</div>
          </div>
        </div>

        {/* Center: Transport Controls + Live Waveform Progress */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="w-10 h-10 rounded-full bg-[#FF6A00] hover:bg-[#FF852B] text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,106,0,0.45)] transition-transform active:scale-95"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNextTrack}
              className="w-9 h-9 rounded-xl bg-[#121622] hover:bg-white/10 text-zinc-200 border border-white/[0.08] flex items-center justify-center"
              aria-label="Следующий трек"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 w-full">
            <span className="text-[10px] font-mono text-zinc-500">LIVE</span>
            <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-[#FF6A00] to-amber-400 rounded-full" />
            </div>
            <span className="text-[10px] font-mono text-[#FF6A00]">
              {activeVibeConfig.bpmRange}
            </span>
          </div>
        </div>

        {/* Right: Volume & Direct YTM Link */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            className="w-9 h-9 rounded-xl bg-[#121622] text-zinc-300 hover:text-white border border-white/[0.08] flex items-center justify-center"
            aria-label="Звук"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#FF6A00]" />
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
            className="w-24 accent-[#FF6A00] cursor-pointer"
            aria-label="Громкость"
          />
          <span className="text-xs font-mono text-zinc-300 w-9">
            {isMuted ? '0%' : `${volume}%`}
          </span>
        </div>
      </footer>

      {/* Create Community Preset Modal */}
      {isNewPresetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsNewPresetOpen(false)}
        >
          <div
            className="max-w-md w-full studio-panel rounded-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-white">
                Создать новый пресет игры
              </h2>
              <button
                type="button"
                onClick={() => setIsNewPresetOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 text-zinc-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePreset} className="space-y-3">
              <input
                type="text"
                required
                value={newPresetGame}
                onChange={(e) => setNewPresetGame(e.target.value)}
                placeholder="Игра (например, The Witcher 3)"
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#080A0F] border border-white/10 text-xs text-white"
              />
              <input
                type="text"
                required
                value={newPresetTitle}
                onChange={(e) => setNewPresetTitle(e.target.value)}
                placeholder="Название профиля (например, Dark Folk & Metal)"
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#080A0F] border border-white/10 text-xs text-white"
              />
              <input
                type="text"
                value={newPresetExe}
                onChange={(e) => setNewPresetExe(e.target.value)}
                placeholder="EXE процесс (witcher3.exe)"
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#080A0F] border border-white/10 text-xs text-white"
              />
              <input
                type="text"
                value={newPresetExploreQ}
                onChange={(e) => setNewPresetExploreQ(e.target.value)}
                placeholder="Запрос для разведки..."
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#080A0F] border border-white/10 text-xs text-white"
              />
              <input
                type="text"
                value={newPresetCombatQ}
                onChange={(e) => setNewPresetCombatQ(e.target.value)}
                placeholder="Запрос для боя..."
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#080A0F] border border-white/10 text-xs text-white"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPresetOpen(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6A00] text-black font-bold text-xs"
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
