import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { GsiStateSnapshot, ScenePacing, SceneTagId } from '@/types/vibe';

export interface LoLMemoryState {
  lastHealth: number;
  lastMaxHealth: number;
  lastKills: number;
  lastAssists: number;
  lastCombatUntilMs: number;
  lastEventId: number;
}

const DEFAULT_LOL_MEMORY: LoLMemoryState = {
  lastHealth: 600,
  lastMaxHealth: 600,
  lastKills: 0,
  lastAssists: 0,
  lastCombatUntilMs: 0,
  lastEventId: -1,
};

let lolMemory: LoLMemoryState = { ...DEFAULT_LOL_MEMORY };
let sc2CombatUntilMs = 0;

function makeBridgeSnapshot(params: {
  game: GsiStateSnapshot['game'];
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

/**
 * Pure parser for Riot's official League of Legends Live Client Data API
 * (`https://127.0.0.1:2999/liveclientdata/allgamedata`). Zero memory reading.
 */
export function parseLoLLiveClientPayload(
  payload: any,
  memory: LoLMemoryState = DEFAULT_LOL_MEMORY,
  nowMs: number = Date.now()
): { snapshot: GsiStateSnapshot | null; memory: LoLMemoryState } {
  if (!payload || typeof payload !== 'object') {
    return { snapshot: null, memory };
  }

  const activePlayer = payload.activePlayer || {};
  const allPlayers = Array.isArray(payload.allPlayers) ? payload.allPlayers : [];
  const events: any[] = Array.isArray(payload.events?.Events) ? payload.events.Events : [];
  const gameData = payload.gameData || {};

  const activeName = String(activePlayer.summonerName || activePlayer.riotIdGameName || '').toLowerCase();
  const me =
    allPlayers.find(
      (p: any) =>
        activeName &&
        (String(p?.summonerName || '').toLowerCase() === activeName ||
          String(p?.riotIdGameName || '').toLowerCase() === activeName)
    ) || allPlayers[0] || {};

  const champ = String(me?.championName || activePlayer.championName || 'Champion').trim();
  const scores = me?.scores || {};
  const kills = Number(scores.kills || 0);
  const assists = Number(scores.assists || 0);
  const isDead = Boolean(me?.isDead);
  const respawnTimer = Math.round(Number(me?.respawnTimer || 0));

  // Check GameEnd event first
  const recentEnd = events.find((e) => e?.EventName === 'GameEnd');
  if (recentEnd) {
    const isWin = String(recentEnd.Result || '').toLowerCase() === 'win';
    return {
      memory,
      snapshot: makeBridgeSnapshot({
        game: 'lol',
        gameTitle: 'League of Legends',
        providerAppId: 2999,
        phase: isWin ? 'victory' : 'defeat',
        sceneTag: isWin ? 'victory_triumph' : 'tragedy_drama',
        sceneNameRu: isWin ? 'Победа в матче League of Legends!' : 'Поражение / Итоги (LoL)',
        energy: isWin ? 72 : 24,
        tension: isWin ? 20 : 48,
        valence: isWin ? 94 : -65,
        pacing: 'steady',
        summary: isWin ? `LoL API: Нексус разрушен — Победа (${champ})` : `LoL API: Матч завершён (${champ})`,
        location: gameData.mapName || 'Summoners Rift',
      }),
    };
  }

  if (isDead || respawnTimer > 0) {
    return {
      memory: {
        ...memory,
        lastHealth: 0,
        lastCombatUntilMs: 0,
      },
      snapshot: makeBridgeSnapshot({
        game: 'lol',
        gameTitle: 'League of Legends',
        providerAppId: 2999,
        phase: 'respawn',
        sceneTag: 'respawn_downtime',
        sceneNameRu: `Таверна / Респавн (${champ}${respawnTimer > 0 ? ` · ${respawnTimer}с` : ''})`,
        energy: 18,
        tension: 20,
        valence: -18,
        pacing: 'still',
        summary: `LoL API: ${champ} ожидает возрождения (${respawnTimer}с)`,
        location: 'Серый экран / Респавн',
        isRespawning: true,
        respawnSeconds: respawnTimer,
      }),
    };
  }

  const stats = activePlayer.championStats || {};
  const maxHp = Math.max(1, Number(stats.maxHealth || 600));
  const curHp = Math.max(0, Number(stats.currentHealth ?? maxHp));
  const hpPct = Math.round((curHp / maxHp) * 100);
  const gameTime = Number(gameData.gameTime || 0);

  if (gameTime > 0 && gameTime < 85) {
    return {
      memory: { ...memory, lastHealth: curHp, lastMaxHealth: maxHp },
      snapshot: makeBridgeSnapshot({
        game: 'lol',
        gameTitle: 'League of Legends',
        providerAppId: 2999,
        phase: 'pre_game',
        sceneTag: 'stealth_infiltrate',
        sceneNameRu: `Выход на линию / Заход (${champ})`,
        energy: 38,
        tension: 44,
        valence: 12,
        pacing: 'steady',
        summary: `LoL API: Начальная стадия до миньонов (${champ})`,
        location: gameData.mapName || 'Ущелье призывателей',
      }),
    };
  }

  const hpDropRatio = memory.lastHealth > curHp ? (memory.lastHealth - curHp) / maxHp : 0;
  const gotKillOrAssist = kills > memory.lastKills || assists > memory.lastAssists;

  // Check very recent events (within 10s of current gameTime)
  let bossObjectiveRecent = false;
  let aceRecent = false;
  let maxEventId = memory.lastEventId;
  for (const ev of events) {
    const eid = Number(ev?.EventID ?? -1);
    if (eid > maxEventId) maxEventId = eid;
    const evTime = Number(ev?.EventTime ?? -999);
    if (gameTime - evTime <= 10 && gameTime - evTime >= 0) {
      const name = String(ev?.EventName || '');
      if (name === 'BaronKill' || name === 'DragonKill' || name === 'HeraldKill' || name === 'HordeKill') {
        bossObjectiveRecent = true;
      } else if (name === 'Ace') {
        aceRecent = true;
      }
    }
  }

  const inFightNow = hpDropRatio >= 0.06 || gotKillOrAssist || bossObjectiveRecent || aceRecent;
  const nextCombatUntil = inFightNow ? nowMs + 7500 : memory.lastCombatUntilMs;
  const inCombat = inFightNow || nowMs < nextCombatUntil;

  const nextMem: LoLMemoryState = {
    lastHealth: curHp,
    lastMaxHealth: maxHp,
    lastKills: kills,
    lastAssists: assists,
    lastCombatUntilMs: nextCombatUntil,
    lastEventId: maxEventId,
  };

  if (bossObjectiveRecent || aceRecent) {
    return {
      memory: nextMem,
      snapshot: makeBridgeSnapshot({
        game: 'lol',
        gameTitle: 'League of Legends',
        providerAppId: 2999,
        phase: 'objective_boss',
        sceneTag: 'boss_climax',
        sceneNameRu: `Объектив / Барон / Дракон (${champ})`,
        energy: 90,
        tension: 90,
        valence: 10,
        pacing: 'driving',
        summary: `LoL API: Ключевая схватка за объект или Эйс (${champ})`,
        location: 'Логово Дракона / Барона',
        inCombat: true,
      }),
    };
  }

  if (hpPct > 0 && hpPct <= 24 && inCombat) {
    return {
      memory: nextMem,
      snapshot: makeBridgeSnapshot({
        game: 'lol',
        gameTitle: 'League of Legends',
        providerAppId: 2999,
        phase: 'escape_low_hp',
        sceneTag: 'chase_escape',
        sceneNameRu: `Критическое HP (${hpPct}%) · ${champ}`,
        energy: 86,
        tension: 92,
        valence: -42,
        pacing: 'frantic',
        summary: `LoL API: Мало здоровья (${hpPct}%) в бою (${champ})`,
        location: 'Бой / Выживание',
        inCombat: true,
      }),
    };
  }

  if (inCombat) {
    return {
      memory: nextMem,
      snapshot: makeBridgeSnapshot({
        game: 'lol',
        gameTitle: 'League of Legends',
        providerAppId: 2999,
        phase: 'teamfight',
        sceneTag: 'teamfight_clash',
        sceneNameRu: `Тимфайт / Стычка (${champ} · ${hpPct}% HP)`,
        energy: 84,
        tension: 82,
        valence: -10,
        pacing: 'driving',
        summary: `LoL API: Активная схватка (${champ}, ${hpPct}% HP)`,
        location: gameData.mapName || 'Summoners Rift',
        inCombat: true,
      }),
    };
  }

  return {
    memory: nextMem,
    snapshot: makeBridgeSnapshot({
      game: 'lol',
      gameTitle: 'League of Legends',
      providerAppId: 2999,
      phase: 'laning',
      sceneTag: 'explore_wander',
      sceneNameRu: `Лейнинг / Фарм (${champ})`,
      energy: 42,
      tension: 28,
      valence: 15,
      pacing: 'steady',
      summary: `LoL API: Спокойный фарм и контроль карты (${champ})`,
      location: gameData.mapName || 'Summoners Rift',
    }),
  };
}

/**
 * Pure parser for Blizzard's official StarCraft II Client Web API
 * (`http://127.0.0.1:6119/ui` & `/game`). Zero memory reading.
 */
export function parseSc2ApiPayloads(
  uiPayload: any,
  gamePayload: any,
  nowMs: number = Date.now()
): GsiStateSnapshot | null {
  if (!uiPayload && !gamePayload) return null;

  const activeScreens: string[] = Array.isArray(uiPayload?.activeScreens)
    ? uiPayload.activeScreens.map(String)
    : [];

  if (activeScreens.length > 0) {
    const joined = activeScreens.join(' ');
    const isScore = /score|victory|defeat/i.test(joined);
    return makeBridgeSnapshot({
      game: 'sc2',
      gameTitle: 'StarCraft II',
      providerAppId: 6119,
      phase: isScore ? 'score_screen' : 'menu_lobby',
      sceneTag: 'menu_lobby',
      sceneNameRu: isScore ? 'Итоги матча (StarCraft II)' : 'Лобби / Меню StarCraft II',
      energy: 20,
      tension: 15,
      valence: 12,
      pacing: 'still',
      summary: `SC2 API: Экран ${activeScreens[0]}`,
      location: 'Battle.net / Меню SC2',
    });
  }

  const players: any[] = Array.isArray(gamePayload?.players) ? gamePayload.players : [];
  const mainPlayer = players.find((p) => p?.type === 'user') || players[0];
  const result = String(mainPlayer?.result || 'Undecided');

  if (result === 'Victory') {
    return makeBridgeSnapshot({
      game: 'sc2',
      gameTitle: 'StarCraft II',
      providerAppId: 6119,
      phase: 'victory',
      sceneTag: 'victory_triumph',
      sceneNameRu: 'Победа в StarCraft II!',
      energy: 72,
      tension: 20,
      valence: 92,
      pacing: 'steady',
      summary: 'SC2 API: Противник повержен — Победа!',
      location: 'Матч StarCraft II',
    });
  }

  if (result === 'Defeat') {
    return makeBridgeSnapshot({
      game: 'sc2',
      gameTitle: 'StarCraft II',
      providerAppId: 6119,
      phase: 'defeat',
      sceneTag: 'tragedy_drama',
      sceneNameRu: 'Поражение (StarCraft II)',
      energy: 26,
      tension: 50,
      valence: -65,
      pacing: 'steady',
      summary: 'SC2 API: База потеряна — Поражение',
      location: 'Матч StarCraft II',
    });
  }

  const displayTime = Number(gamePayload?.displayTime || 0);
  const isLateMacroOrFight = displayTime >= 240;
  if (isLateMacroOrFight && nowMs > sc2CombatUntilMs) {
    sc2CombatUntilMs = nowMs + 5000;
  }

  return makeBridgeSnapshot({
    game: 'sc2',
    gameTitle: 'StarCraft II',
    providerAppId: 6119,
    phase: displayTime < 150 ? 'opening_macro' : 'tactical_rts',
    sceneTag: displayTime < 150 ? 'explore_wander' : 'skirmish_combat',
    sceneNameRu:
      displayTime < 150
        ? `Развитие базы (${Math.round(displayTime)}с)`
        : `Тактический матч StarCraft II`,
    energy: displayTime < 150 ? 44 : 68,
    tension: displayTime < 150 ? 30 : 62,
    valence: 12,
    pacing: displayTime < 150 ? 'steady' : 'driving',
    summary: `SC2 API: Матч в реальном времени (${Math.round(displayTime)}с)`,
    location: gamePayload?.isReplay ? 'Просмотр реплея' : 'Поле боя SC2',
  });
}

const POE_TOWN_KEYWORDS = [
  'hideout',
  'lioneye',
  'forest encampment',
  'sarn',
  'highgate',
  'overseer',
  'oriath',
  'karui shores',
  'rogue harbour',
  'menagerie',
  'kingsmarch',
  'clearfell encampment',
  'ardura caravan',
  'ziggurat encampment',
];

const POE_BOSS_KEYWORDS = [
  'maven',
  'shaper',
  'elder',
  'sirus',
  'absence of',
  'searing exarch',
  'eater of worlds',
  'kitava',
  'dominus',
  'malachai',
  'innocence',
  'arbiter',
  'trialmaster',
  'pinnacle',
];

/**
 * Pure parser for Path of Exile 1/2 `Client.txt` tail lines.
 */
export function parsePathOfExileLogTail(tailText: string): GsiStateSnapshot | null {
  if (!tailText) return null;
  const lines = tailText.split(/\r?\n/).filter(Boolean).reverse();

  for (const line of lines) {
    if (/\bhas been slain\.?$/i.test(line)) {
      return makeBridgeSnapshot({
        game: 'poe',
        gameTitle: 'Path of Exile',
        providerAppId: 238960,
        phase: 'respawn',
        sceneTag: 'respawn_downtime',
        sceneNameRu: 'Персонаж погиб (Path of Exile)',
        energy: 20,
        tension: 25,
        valence: -40,
        pacing: 'still',
        summary: 'PoE Log: Персонаж пал в бою',
        location: 'Ожидание возрождения',
        isRespawning: true,
      });
    }

    const enterMatch = line.match(/:\s*You have entered (.+?)\./i);
    if (enterMatch?.[1]) {
      const zone = enterMatch[1].trim();
      const lower = zone.toLowerCase();

      if (POE_BOSS_KEYWORDS.some((kw) => lower.includes(kw))) {
        return makeBridgeSnapshot({
          game: 'poe',
          gameTitle: 'Path of Exile',
          providerAppId: 238960,
          phase: 'boss_arena',
          sceneTag: 'boss_climax',
          sceneNameRu: `Арена босса: ${zone}`,
          energy: 92,
          tension: 94,
          valence: -25,
          pacing: 'frantic',
          summary: `PoE Log: Вход на арену босса (${zone})`,
          location: zone,
          inCombat: true,
        });
      }

      if (POE_TOWN_KEYWORDS.some((kw) => lower.includes(kw))) {
        return makeBridgeSnapshot({
          game: 'poe',
          gameTitle: 'Path of Exile',
          providerAppId: 238960,
          phase: 'town_hideout',
          sceneTag: 'cozy_hub',
          sceneNameRu: `Убежище / Город: ${zone}`,
          energy: 24,
          tension: 12,
          valence: 32,
          pacing: 'still',
          summary: `PoE Log: Безопасная зона (${zone})`,
          location: zone,
        });
      }

      return makeBridgeSnapshot({
        game: 'poe',
        gameTitle: 'Path of Exile',
        providerAppId: 238960,
        phase: 'combat_zone',
        sceneTag: 'skirmish_combat',
        sceneNameRu: `Локация / Карта: ${zone}`,
        energy: 72,
        tension: 64,
        valence: -12,
        pacing: 'driving',
        summary: `PoE Log: Переход в локацию ${zone}`,
        location: zone,
        inCombat: true,
      });
    }
  }
  return null;
}

/**
 * Pure parser for Minecraft `latest.log` tail lines.
 */
export function parseMinecraftLogTail(tailText: string): GsiStateSnapshot | null {
  if (!tailText) return null;
  const lines = tailText.split(/\r?\n/).filter(Boolean).reverse();

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.includes('was slain by') ||
      lower.includes('fell from a high place') ||
      lower.includes('tried to swim in lava') ||
      lower.includes('blew up') ||
      lower.includes('was killed by')
    ) {
      return makeBridgeSnapshot({
        game: 'minecraft',
        gameTitle: 'Minecraft',
        providerAppId: 25565,
        phase: 'death',
        sceneTag: 'respawn_downtime',
        sceneNameRu: 'Возрождение (Minecraft)',
        energy: 18,
        tension: 25,
        valence: -35,
        pacing: 'still',
        summary: 'Minecraft Log: Событие смерти игрока',
        location: 'Экран возрождения',
        isRespawning: true,
      });
    }

    if (
      lower.includes('ender dragon') ||
      lower.includes('wither') ||
      lower.includes('warden') ||
      lower.includes('raid')
    ) {
      return makeBridgeSnapshot({
        game: 'minecraft',
        gameTitle: 'Minecraft',
        providerAppId: 25565,
        phase: 'boss_encounter',
        sceneTag: 'boss_climax',
        sceneNameRu: 'Босс-событие в Minecraft',
        energy: 86,
        tension: 88,
        valence: -10,
        pacing: 'driving',
        summary: 'Minecraft Log: Встреча с боссом / Рейд',
        location: 'Босс-арена Minecraft',
        inCombat: true,
      });
    }

    if (lower.includes('the nether') || lower.includes('nether fortress') || lower.includes('ancient city')) {
      return makeBridgeSnapshot({
        game: 'minecraft',
        gameTitle: 'Minecraft',
        providerAppId: 25565,
        phase: 'dark_biome',
        sceneTag: 'horror_dread',
        sceneNameRu: 'Незер / Глубокие пещеры (Minecraft)',
        energy: 44,
        tension: 66,
        valence: -55,
        pacing: 'steady',
        summary: 'Minecraft Log: Опасное измерение',
        location: 'Незер / Подземелье',
      });
    }

    if (lower.includes('the end') || lower.includes('end city')) {
      return makeBridgeSnapshot({
        game: 'minecraft',
        gameTitle: 'Minecraft',
        providerAppId: 25565,
        phase: 'end_vista',
        sceneTag: 'vista_wonder',
        sceneNameRu: 'Измерение Края (Minecraft)',
        energy: 42,
        tension: 45,
        valence: 30,
        pacing: 'steady',
        summary: 'Minecraft Log: Космическая панорама Края',
        location: 'The End',
      });
    }
  }
  return null;
}

function readTailUtf8(filePath: string, maxBytes = 4096): string {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    if (!stat.size || Date.now() - stat.mtimeMs > 180_000) return '';
    const start = Math.max(0, stat.size - maxBytes);
    const len = stat.size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return buf.toString('utf8');
  } catch {
    return '';
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore close error
      }
    }
  }
}

function fetchLocalJson<T>(urlStr: string, isHttps: boolean, timeoutMs = 180): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const lib = isHttps ? https : http;
      const req = lib.get(
        urlStr,
        {
          timeout: timeoutMs,
          ...(isHttps ? { rejectUnauthorized: false } : {}),
        },
        (res) => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            resolve(null);
            return;
          }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
            if (body.length > 512_000) req.destroy();
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(body) as T);
            } catch {
              resolve(null);
            }
          });
        }
      );
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

export async function pollLoLLiveClient(): Promise<GsiStateSnapshot | null> {
  const payload = await fetchLocalJson<any>(
    'https://127.0.0.1:2999/liveclientdata/allgamedata',
    true,
    180
  );
  if (!payload) return null;
  const parsed = parseLoLLiveClientPayload(payload, lolMemory);
  lolMemory = parsed.memory;
  return parsed.snapshot;
}

export async function pollSc2ClientApi(): Promise<GsiStateSnapshot | null> {
  const [ui, game] = await Promise.all([
    fetchLocalJson<any>('http://127.0.0.1:6119/ui', false, 150),
    fetchLocalJson<any>('http://127.0.0.1:6119/game', false, 150),
  ]);
  if (!ui && !game) return null;
  return parseSc2ApiPayloads(ui, game);
}

const POE_LOG_CANDIDATES = [
  'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt',
  'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt',
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt',
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt',
  'D:\\SteamLibrary\\steamapps\\common\\Path of Exile\\logs\\Client.txt',
  'D:\\SteamLibrary\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt',
];

function buildMinecraftLogPath(subpath: string[]): string {
  const envMap = process.env as Record<string, string | undefined>;
  const appDataVal = envMap['APPDATA'];
  const baseSegments = appDataVal ? [appDataVal] : [os.homedir(), 'AppData', 'Roaming'];
  return baseSegments.concat(subpath).join(path.sep);
}

function getMinecraftLogCandidates(): string[] {
  return [
    buildMinecraftLogPath(['.minecraft', 'logs', 'latest.log']),
    buildMinecraftLogPath(['PrismLauncher', 'instances', 'latest', '.minecraft', 'logs', 'latest.log']),
  ];
}

function findFirstExistingLog(candidates: string[]): string | null {
  for (const candidate of candidates) {
    try {
      const fd = fs.openSync(candidate, 'r');
      fs.closeSync(fd);
      return candidate;
    } catch {
      // ignore missing or locked path
    }
  }
  return null;
}

export function pollPathOfExileLog(): GsiStateSnapshot | null {
  const poePath = findFirstExistingLog(POE_LOG_CANDIDATES);
  if (!poePath) return null;
  const tail = readTailUtf8(poePath);
  return tail ? parsePathOfExileLogTail(tail) : null;
}

export function pollMinecraftLog(): GsiStateSnapshot | null {
  const mcPath = findFirstExistingLog(getMinecraftLogCandidates());
  if (!mcPath) return null;
  const tail = readTailUtf8(mcPath);
  return tail ? parseMinecraftLogTail(tail) : null;
}

/**
 * Selects only the matching native telemetry poller for the active foreground game
 * so idle polling cost stays near 0ms.
 */
export async function pollActiveNativeGameBridge(
  detectedProcess: string
): Promise<GsiStateSnapshot | null> {
  const proc = (detectedProcess || '').toLowerCase();
  if (!proc) return null;

  if (proc.includes('league') || proc.includes('lol')) {
    return pollLoLLiveClient();
  }
  if (proc.includes('sc2') || proc.includes('starcraft')) {
    return pollSc2ClientApi();
  }
  if (proc.includes('pathofexile') || proc.includes('poe')) {
    return pollPathOfExileLog();
  }
  if (proc.includes('minecraft') || proc.includes('javaw')) {
    return pollMinecraftLog();
  }
  return null;
}

export function getInstalledNativeLogBridges() {
  const poePath = findFirstExistingLog(POE_LOG_CANDIDATES);
  const mcPath = findFirstExistingLog(getMinecraftLogCandidates());
  return {
    lolEndpoint: 'https://127.0.0.1:2999/liveclientdata/allgamedata',
    sc2Endpoint: 'http://127.0.0.1:6119/ui',
    poeLogFound: Boolean(poePath),
    poeLogPath: poePath,
    minecraftLogFound: Boolean(mcPath),
    minecraftLogPath: mcPath,
  };
}
