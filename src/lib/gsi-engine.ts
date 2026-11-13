import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { GsiStateSnapshot, ScenePacing, SceneTagId } from '@/types/vibe';

export interface GsiMetricsMemory {
  lastHealthPercent: number;
  lastKills: number;
  lastAssists: number;
  lastCombatUntilMs: number;
  lastCs2Health: number;
  lastCs2Kills: number;
  lastTimestamp: number;
}

const DEFAULT_MEMORY: GsiMetricsMemory = {
  lastHealthPercent: 100,
  lastKills: 0,
  lastAssists: 0,
  lastCombatUntilMs: 0,
  lastCs2Health: 100,
  lastCs2Kills: 0,
  lastTimestamp: 0,
};

function makeSnapshot(params: {
  game: 'dota2' | 'cs2';
  gameTitle: string;
  providerAppId: number;
  phase: string;
  sceneTag: SceneTagId;
  sceneNameRu: string;
  energy: number;
  tension: number;
  valence: number;
  pacing: ScenePacing;
  summary: string;
  location: string;
  isRespawning?: boolean;
  respawnSeconds?: number;
  inCombat?: boolean;
}): GsiStateSnapshot {
  return {
    timestamp: Date.now(),
    game: params.game,
    gameTitle: params.gameTitle,
    providerAppId: params.providerAppId,
    phase: params.phase,
    sceneTag: params.sceneTag,
    sceneNameRu: params.sceneNameRu,
    energy: params.energy,
    tension: params.tension,
    valence: params.valence,
    pacing: params.pacing,
    summary: params.summary,
    location: params.location,
    isRespawning: Boolean(params.isRespawning),
    respawnSeconds: Number(params.respawnSeconds || 0),
    inCombat: Boolean(params.inCombat),
  };
}

function parseDota2Gsi(
  payload: any,
  memory: GsiMetricsMemory
): { snapshot: GsiStateSnapshot; memory: GsiMetricsMemory } {
  const now = Date.now();
  const mapState = String(payload?.map?.game_state || '');
  const hero = payload?.hero || {};
  const player = payload?.player || {};
  const heroName = String(hero?.name || '')
    .replace('npc_dota_hero_', '')
    .replace(/_/g, ' ')
    .trim();

  // Lobby, Main Menu, Hero Selection, Strategy Time
  if (
    !mapState ||
    mapState === 'DOTA_GAMERULES_STATE_INIT' ||
    mapState === 'DOTA_GAMERULES_STATE_WAIT_FOR_PLAYERS_TO_LOAD' ||
    mapState === 'DOTA_GAMERULES_STATE_HERO_SELECTION' ||
    mapState === 'DOTA_GAMERULES_STATE_STRATEGY_TIME' ||
    mapState === 'DOTA_GAMERULES_STATE_TEAM_SHOWCASE'
  ) {
    const isDraft =
      mapState === 'DOTA_GAMERULES_STATE_HERO_SELECTION' ||
      mapState === 'DOTA_GAMERULES_STATE_STRATEGY_TIME';
    return {
      memory,
      snapshot: makeSnapshot({
        game: 'dota2',
        gameTitle: 'Dota 2',
        providerAppId: 570,
        phase: isDraft ? 'hero_selection' : 'main_menu',
        sceneTag: 'menu_lobby',
        sceneNameRu: isDraft ? 'Драфт / Выбор героя (Dota 2)' : 'Главное меню / Поиск матча Dota 2',
        energy: isDraft ? 24 : 15,
        tension: isDraft ? 30 : 12,
        valence: 10,
        pacing: 'still',
        summary: isDraft
          ? 'GSI: Стадия выбора героев и стратегии в Dota 2'
          : 'GSI: Игрок в главном меню или лобби Dota 2',
        location: isDraft ? 'Экран драфта Dota 2' : 'Меню Dota 2',
      }),
    };
  }

  // Post-game Win / Loss
  if (mapState === 'DOTA_GAMERULES_STATE_POST_GAME') {
    const winTeam = String(payload?.map?.win_team || '').toLowerCase();
    const myTeam = String(player?.team_name || '').toLowerCase();
    const isWin = Boolean(winTeam && myTeam && winTeam === myTeam);
    return {
      memory,
      snapshot: makeSnapshot({
        game: 'dota2',
        gameTitle: 'Dota 2',
        providerAppId: 570,
        phase: isWin ? 'victory' : 'defeat',
        sceneTag: isWin ? 'victory_triumph' : 'tragedy_drama',
        sceneNameRu: isWin ? 'Победа в матче Dota 2!' : 'Итоги матча / Поражение (Dota 2)',
        energy: isWin ? 68 : 26,
        tension: isWin ? 20 : 48,
        valence: isWin ? 92 : -65,
        pacing: 'steady',
        summary: isWin ? 'GSI: Трон врага пал — Победа!' : 'GSI: Матч завершён (Dota 2)',
        location: 'Послематчевый экран Dota 2',
      }),
    };
  }

  // Pre-game before horn
  if (mapState === 'DOTA_GAMERULES_STATE_PRE_GAME') {
    return {
      memory,
      snapshot: makeSnapshot({
        game: 'dota2',
        gameTitle: 'Dota 2',
        providerAppId: 570,
        phase: 'pre_game',
        sceneTag: 'stealth_infiltrate',
        sceneNameRu: 'Выход на руны / Подготовка (Dota 2)',
        energy: 42,
        tension: 48,
        valence: 12,
        pacing: 'steady',
        summary: `GSI: До выхода крипов (${heroName || 'Dota 2'})`,
        location: 'Линия / Борьба за руны',
      }),
    };
  }

  // Active Match: Dead -> Respawn Downtime
  const respawnSeconds = Number(hero?.respawn_seconds || 0);
  const isDead = hero?.alive === false || respawnSeconds > 0;
  if (isDead) {
    return {
      memory: {
        ...memory,
        lastHealthPercent: 0,
        lastCombatUntilMs: 0,
        lastTimestamp: now,
      },
      snapshot: makeSnapshot({
        game: 'dota2',
        gameTitle: 'Dota 2',
        providerAppId: 570,
        phase: 'respawn',
        sceneTag: 'respawn_downtime',
        sceneNameRu: `Таверна / Респавн${respawnSeconds > 0 ? ` (${respawnSeconds}с)` : ''}`,
        energy: 18,
        tension: 20,
        valence: -18,
        pacing: 'still',
        summary: `GSI: Герой ${heroName || ''} в таверне (до возрождения ${respawnSeconds}с)`,
        location: 'Наблюдение за картой (Таверна)',
        isRespawning: true,
        respawnSeconds,
      }),
    };
  }

  // Alive in active match: detect real teamfight / skirmish / low-HP escape
  const hp = typeof hero?.health_percent === 'number' ? hero.health_percent : 100;
  const kills = Number(player?.kills || 0);
  const assists = Number(player?.assists || 0);
  const recentDmg = Number(hero?.recent_damage || 0);
  const hpDropped = memory.lastHealthPercent - hp >= 8;
  const gotKillOrAssist = kills > memory.lastKills || assists > memory.lastAssists;
  const inFightNow = hpDropped || gotKillOrAssist || recentDmg > 0 || Boolean(hero?.stunned) || Boolean(hero?.silenced);

  const nextCombatUntil = inFightNow ? now + 7500 : memory.lastCombatUntilMs;
  const inCombat = inFightNow || now < nextCombatUntil;

  const nextMem: GsiMetricsMemory = {
    ...memory,
    lastHealthPercent: hp,
    lastKills: kills,
    lastAssists: assists,
    lastCombatUntilMs: nextCombatUntil,
    lastTimestamp: now,
  };

  if (hp > 0 && hp <= 24 && inCombat) {
    return {
      memory: nextMem,
      snapshot: makeSnapshot({
        game: 'dota2',
        gameTitle: 'Dota 2',
        providerAppId: 570,
        phase: 'escape_low_hp',
        sceneTag: 'chase_escape',
        sceneNameRu: `Критическое HP (${hp}%) / Отход`,
        energy: 86,
        tension: 92,
        valence: -45,
        pacing: 'frantic',
        summary: `GSI: Критический уровень здоровья (${hp}%) в замесе (${heroName || 'Dota 2'})`,
        location: 'Замес / Отход',
        inCombat: true,
      }),
    };
  }

  if (inCombat) {
    return {
      memory: nextMem,
      snapshot: makeSnapshot({
        game: 'dota2',
        gameTitle: 'Dota 2',
        providerAppId: 570,
        phase: 'teamfight',
        sceneTag: 'teamfight_clash',
        sceneNameRu: `Замес / Схватка (${heroName || 'Dota 2'})`,
        energy: 84,
        tension: 82,
        valence: -10,
        pacing: 'driving',
        summary: `GSI: Боевое столкновение (${heroName || 'герой'}, HP ${hp}%)`,
        location: 'Линия / Замес',
        inCombat: true,
      }),
    };
  }

  return {
    memory: nextMem,
    snapshot: makeSnapshot({
      game: 'dota2',
      gameTitle: 'Dota 2',
      providerAppId: 570,
      phase: 'laning_farm',
      sceneTag: 'explore_wander',
      sceneNameRu: `Фарм и перемещение (${heroName || 'Dota 2'})`,
      energy: 44,
      tension: 30,
      valence: 16,
      pacing: 'steady',
      summary: `GSI: Спокойная игра на карте (${heroName || 'герой'}, HP ${hp}%)`,
      location: 'Карта Dota 2',
    }),
  };
}

function parseCs2Gsi(
  payload: any,
  memory: GsiMetricsMemory
): { snapshot: GsiStateSnapshot; memory: GsiMetricsMemory } {
  const now = Date.now();
  const activity = String(payload?.player?.activity || '').toLowerCase();
  const map = payload?.map || null;
  const round = payload?.round || null;
  const mapName = String(map?.name || 'CS2').replace('de_', '').toUpperCase();
  const mapPhase = String(map?.phase || '').toLowerCase();
  const roundPhase = String(round?.phase || '').toLowerCase();

  // Main menu or missing map
  if (activity === 'menu' || !map) {
    return {
      memory,
      snapshot: makeSnapshot({
        game: 'cs2',
        gameTitle: 'Counter-Strike 2',
        providerAppId: 730,
        phase: 'main_menu',
        sceneTag: 'menu_lobby',
        sceneNameRu: 'Главное меню / Поиск матча CS2',
        energy: 16,
        tension: 12,
        valence: 12,
        pacing: 'still',
        summary: 'GSI: Игрок в главном меню или лобби CS2',
        location: 'Меню Counter-Strike 2',
      }),
    };
  }

  // Match over
  if (mapPhase === 'gameover') {
    return {
      memory,
      snapshot: makeSnapshot({
        game: 'cs2',
        gameTitle: 'Counter-Strike 2',
        providerAppId: 730,
        phase: 'gameover',
        sceneTag: 'victory_triumph',
        sceneNameRu: `Итоги матча (${mapName})`,
        energy: 54,
        tension: 25,
        valence: 45,
        pacing: 'steady',
        summary: `GSI: Матч на ${mapName} завершён`,
        location: mapName,
      }),
    };
  }

  // Warmup
  if (mapPhase === 'warmup') {
    return {
      memory,
      snapshot: makeSnapshot({
        game: 'cs2',
        gameTitle: 'Counter-Strike 2',
        providerAppId: 730,
        phase: 'warmup',
        sceneTag: 'skirmish_combat',
        sceneNameRu: `Разминка перед матчем (${mapName})`,
        energy: 64,
        tension: 40,
        valence: 20,
        pacing: 'driving',
        summary: `GSI: Разминка на карте ${mapName}`,
        location: mapName,
      }),
    };
  }

  // Round over
  if (roundPhase === 'over') {
    const winTeam = String(round?.win_team || '').toUpperCase();
    const myTeam = String(payload?.player?.team || '').toUpperCase();
    const roundWon = Boolean(winTeam && myTeam && winTeam === myTeam);
    return {
      memory: { ...memory, lastCombatUntilMs: 0 },
      snapshot: makeSnapshot({
        game: 'cs2',
        gameTitle: 'Counter-Strike 2',
        providerAppId: 730,
        phase: 'round_over',
        sceneTag: roundWon ? 'victory_triumph' : 'tragedy_drama',
        sceneNameRu: roundWon ? `Раунд выигран (${mapName})` : `Раунд проигран (${mapName})`,
        energy: roundWon ? 58 : 26,
        tension: 24,
        valence: roundWon ? 75 : -45,
        pacing: 'steady',
        summary: `GSI: Раунд завершён на ${mapName}`,
        location: mapName,
      }),
    };
  }

  // Freezetime (Buy phase)
  if (roundPhase === 'freezetime') {
    return {
      memory: { ...memory, lastCs2Health: 100, lastCombatUntilMs: 0 },
      snapshot: makeSnapshot({
        game: 'cs2',
        gameTitle: 'Counter-Strike 2',
        providerAppId: 730,
        phase: 'freezetime',
        sceneTag: 'menu_lobby',
        sceneNameRu: `Закуп перед раундом (${mapName})`,
        energy: 28,
        tension: 30,
        valence: 10,
        pacing: 'still',
        summary: `GSI: Фаза закупа на карте ${mapName}`,
        location: `${mapName} · Спавн`,
      }),
    };
  }

  // Live round: inspect health / bomb / flash / kills
  const state = payload?.player?.state || {};
  const hp = typeof state.health === 'number' ? state.health : 100;
  const roundKills = Number(state.round_kills || 0);
  const flashed = Number(state.flashed || 0);
  const burning = Number(state.burning || 0);
  const isSpec = hp <= 0;

  if (isSpec) {
    return {
      memory: { ...memory, lastCs2Health: 0, lastCombatUntilMs: 0, lastTimestamp: now },
      snapshot: makeSnapshot({
        game: 'cs2',
        gameTitle: 'Counter-Strike 2',
        providerAppId: 730,
        phase: 'spectating',
        sceneTag: 'respawn_downtime',
        sceneNameRu: `Наблюдение за тиммейтами (${mapName})`,
        energy: 18,
        tension: 22,
        valence: -15,
        pacing: 'still',
        summary: `GSI: Выбыли из раунда на ${mapName} — режим спектатора`,
        location: `${mapName} · Спектатор`,
        isRespawning: true,
      }),
    };
  }

  const bombState = String(round?.bomb || '').toLowerCase();
  const hpDropped = memory.lastCs2Health - hp >= 5;
  const gotKill = roundKills > memory.lastCs2Kills;
  const inFightNow = hpDropped || gotKill || flashed > 35 || burning > 20;
  const nextCombatUntil = inFightNow ? now + 6500 : memory.lastCombatUntilMs;
  const inCombat = inFightNow || now < nextCombatUntil;

  const nextMem: GsiMetricsMemory = {
    ...memory,
    lastCs2Health: hp,
    lastCs2Kills: roundKills,
    lastCombatUntilMs: nextCombatUntil,
    lastTimestamp: now,
  };

  if (bombState === 'planted') {
    return {
      memory: nextMem,
      snapshot: makeSnapshot({
        game: 'cs2',
        gameTitle: 'Counter-Strike 2',
        providerAppId: 730,
        phase: 'bomb_planted',
        sceneTag: 'chase_escape',
        sceneNameRu: `Бомба установлена! Клатч (${mapName})`,
        energy: 86,
        tension: 94,
        valence: -35,
        pacing: 'frantic',
        summary: `GSI: Бомба установлена на ${mapName} (HP ${hp}%)`,
        location: `${mapName} · Плент`,
        inCombat: true,
      }),
    };
  }

  if (inCombat) {
    return {
      memory: nextMem,
      snapshot: makeSnapshot({
        game: 'cs2',
        gameTitle: 'Counter-Strike 2',
        providerAppId: 730,
        phase: 'firefight',
        sceneTag: 'teamfight_clash',
        sceneNameRu: `Перестрелка / Клатч (${mapName} · ${hp} HP)`,
        energy: 84,
        tension: 84,
        valence: -15,
        pacing: 'driving',
        summary: `GSI: Активная перестрелка на ${mapName} (фокус на шагах)`,
        location: mapName,
        inCombat: true,
      }),
    };
  }

  return {
    memory: nextMem,
    snapshot: makeSnapshot({
      game: 'cs2',
      gameTitle: 'Counter-Strike 2',
      providerAppId: 730,
      phase: 'tactical_live',
      sceneTag: 'stealth_infiltrate',
      sceneNameRu: `Тактическая фаза раунда (${mapName})`,
      energy: 46,
      tension: 58,
      valence: 0,
      pacing: 'steady',
      summary: `GSI: Раунд в процессе на ${mapName} (${hp} HP)`,
      location: mapName,
    }),
  };
}

export function parseGsiPayload(
  payload: any,
  memory: GsiMetricsMemory = DEFAULT_MEMORY
): { snapshot: GsiStateSnapshot | null; memory: GsiMetricsMemory } {
  const appId = Number(payload?.provider?.appid || 0);
  const name = String(payload?.provider?.name || '').toLowerCase();

  if (appId === 570 || name.includes('dota')) {
    return parseDota2Gsi(payload, memory);
  }
  if (appId === 730 || name.includes('counter-strike') || name.includes('csgo') || name.includes('cs2')) {
    return parseCs2Gsi(payload, memory);
  }
  return { snapshot: null, memory };
}

export function buildGsiCfgContent(game: 'dota2' | 'cs2', port = 3001): string {
  if (game === 'dota2') {
    return `"GameMusick Dota 2 GSI"
{
    "uri"           "http://127.0.0.1:${port}/api/gsi"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.5"
    "heartbeat"     "5.0"
    "data"
    {
        "provider"      "1"
        "map"           "1"
        "player"        "1"
        "hero"          "1"
        "abilities"     "1"
        "items"         "0"
    }
}
`;
  }
  return `"GameMusick CS2 GSI"
{
    "uri"           "http://127.0.0.1:${port}/api/gsi"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.5"
    "heartbeat"     "5.0"
    "data"
    {
        "provider"          "1"
        "map"               "1"
        "round"             "1"
        "player_id"         "1"
        "player_state"      "1"
        "player_match_stats" "1"
    }
}
`;
}

function getSteamRootPaths(): string[] {
  const roots = new Set<string>();
  try {
    const out = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m?.[1]) {
      roots.add(path.normalize(m[1].trim()));
    }
  } catch {
    // ignore if Steam registry key missing
  }

  for (const fallback of [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'D:\\SteamLibrary',
    'E:\\SteamLibrary',
  ]) {
    if (fs.existsSync(fallback)) roots.add(fallback);
  }

  // Parse libraryfolders.vdf to discover custom drives (E:, F:, etc.)
  for (const base of [...roots]) {
    const vdf = path.join(base, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(vdf)) {
      try {
        const text = fs.readFileSync(vdf, 'utf8');
        const matches = text.matchAll(/"path"\s+"([^"]+)"/gi);
        for (const match of matches) {
          const libPath = path.normalize(match[1].replace(/\\\\/g, '\\'));
          if (fs.existsSync(libPath)) roots.add(libPath);
        }
      } catch {
        // ignore parse issues
      }
    }
  }
  return [...roots];
}

export function detectSteamGameCfgDirs() {
  const libs = getSteamRootPaths();
  let dota2Dir = '';
  let cs2Dir = '';

  for (const lib of libs) {
    const dotaCandidate = path.join(lib, 'steamapps', 'common', 'dota 2 beta', 'game', 'dota', 'cfg');
    if (!dota2Dir && fs.existsSync(dotaCandidate)) {
      dota2Dir = dotaCandidate;
    }
    const cs2Candidate = path.join(lib, 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg');
    if (!cs2Dir && fs.existsSync(cs2Candidate)) {
      cs2Dir = cs2Candidate;
    }
  }

  const fileName = 'gamestate_integration_gamemusick.cfg';
  return {
    dota2Dir: dota2Dir || null,
    cs2Dir: cs2Dir || null,
    dota2Installed: Boolean(dota2Dir && fs.existsSync(path.join(dota2Dir, fileName))),
    cs2Installed: Boolean(cs2Dir && fs.existsSync(path.join(cs2Dir, fileName))),
    cfgFileName: fileName,
  };
}
