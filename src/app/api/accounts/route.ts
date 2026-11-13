import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  AccountsStore,
  SceneBucketId,
  ScenePlaylist,
  UserAccount,
} from '@/types/account';
import { TrackItem } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const ACCOUNTS_FILE = path.join(process.cwd(), 'data', 'accounts.json');
const LEGACY_FILE = path.join(process.cwd(), 'data', 'user-playlists.json');

const AVATAR_COLORS = [
  '#6E1D2F', // Burgundy / GameVibe Brand
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Red
];

function createDefaultScenePlaylist(name: string, gameTag = 'Для любых игр'): ScenePlaylist {
  const now = Date.now();
  return {
    id: `pl-${now}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    gameTag,
    description: 'ИИ-режиссер автоматически переключает треки из этих сцен под геймплей',
    createdAt: now,
    updatedAt: now,
    scenes: {
      EXPLORE: [
        {
          id: 'yt-7G7yCE2nZ1Y',
          videoId: '7G7yCE2nZ1Y',
          title: 'Symphony of Sorrow ~ Relaxing Castlevania Music',
          artist: 'Cry Café',
          album: 'Ambient Collection',
          duration: '51:52',
          thumbnail: 'https://i.ytimg.com/vi/7G7yCE2nZ1Y/hq720.jpg',
          vibe: 'EXPLORE',
          genreTag: 'Ambient & Relax',
        },
      ],
      COMBAT: [
        {
          id: 'yt-qUwTedLyvGc',
          videoId: 'qUwTedLyvGc',
          title: 'Isaac vs. Carmilla Theme | Ultra Epic Remake',
          artist: 'Castlevania Soundtrack',
          album: 'Battle OST',
          duration: '03:01',
          thumbnail: 'https://i.ytimg.com/vi/qUwTedLyvGc/hq720.jpg',
          vibe: 'COMBAT',
          genreTag: 'Battle Action',
        },
      ],
      BOSSFIGHT: [
        {
          id: 'yt-ffg31qA_kDE',
          videoId: 'ffg31qA_kDE',
          title: 'Godskin Apostles — Final Phase Orchestral Mix',
          artist: 'Elden Ring OST',
          album: 'Boss Themes',
          duration: '04:42',
          thumbnail: 'https://i.ytimg.com/vi/ffg31qA_kDE/hq720.jpg',
          vibe: 'BOSSFIGHT',
          genreTag: 'Boss Fight',
        },
      ],
      DRAMA: [
        {
          id: 'yt-F9vA7L8H4xI',
          videoId: 'F9vA7L8H4xI',
          title: 'Priscilla Song (The Wolven Storm Instrumental)',
          artist: 'The Witcher 3 OST',
          album: 'Cinematic Story',
          duration: '03:35',
          thumbnail: 'https://i.ytimg.com/vi/F9vA7L8H4xI/hq720.jpg',
          vibe: 'DRAMA',
          genreTag: 'Story & Drama',
        },
      ],
      MAJESTIC: [
        {
          id: 'yt-fd3a189vcVc',
          videoId: 'fd3a189vcVc',
          title: 'Secunda — Night Sky Atmosphere',
          artist: 'Jeremy Soule',
          album: 'Skyrim Atmospheres',
          duration: '02:05',
          thumbnail: 'https://i.ytimg.com/vi/fd3a189vcVc/hq720.jpg',
          vibe: 'MAJESTIC',
          genreTag: 'Vista & Panorama',
        },
      ],
      STEALTH: [
        {
          id: 'yt-eb6_J1dq1hk',
          videoId: 'eb6_J1dq1hk',
          title: 'Dark Cyberpunk Stealth Drone Mix',
          artist: 'Cryo Chamber',
          album: 'Noir Infiltration',
          duration: '04:15',
          thumbnail: 'https://i.ytimg.com/vi/eb6_J1dq1hk/hq720.jpg',
          vibe: 'STEALTH',
          genreTag: 'Stealth & Tension',
        },
      ],
    },
  };
}

function createDefaultAccount(username = 'Игрок', color = '#6E1D2F'): UserAccount {
  const now = Date.now();
  const id = `usr-${now}-${Math.random().toString(36).slice(2, 6)}`;
  const starterPlaylist = createDefaultScenePlaylist('Мой первый игровой сет', 'Для любых игр');

  return {
    id,
    username,
    avatarColor: color,
    createdAt: now,
    favoriteGenres: ['rock', 'rap', 'electronic', 'ambient'],
    favoriteArtists: ['Deftones', 'Kavinsky', 'Brian Eno'],
    customArtistsText: '',
    gameGenres: ['RPG и Открытый мир', 'Шутеры / Соревновательные'],
    driveMode: 'balanced',
    languagePref: 'all',
    vocalPref: 'mixed',
    playlists: [starterPlaylist],
    selectedPlaylistId: starterPlaylist.id,
    useCustomPlaylistInAutopilot: false,
  };
}

function loadAccountsStore(): AccountsStore {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
        return {
          activeAccountId: parsed.activeAccountId || parsed.accounts[0].id,
          accounts: parsed.accounts,
        };
      }
    }
  } catch {
    // ignore
  }

  // Migrate legacy profile from user-playlists.json if available
  let legacyUsername = 'Игрок';
  try {
    if (fs.existsSync(LEGACY_FILE)) {
      const raw = fs.readFileSync(LEGACY_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.accountProfile?.username) {
        legacyUsername = parsed.accountProfile.username;
      }
    }
  } catch {
    // ignore
  }

  const defaultAcc = createDefaultAccount(legacyUsername, '#6E1D2F');
  const initialStore: AccountsStore = {
    activeAccountId: defaultAcc.id,
    accounts: [defaultAcc],
  };

  saveAccountsStore(initialStore);
  return initialStore;
}

function saveAccountsStore(store: AccountsStore): void {
  try {
    const dir = path.dirname(ACCOUNTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Accounts API Error saving store]', err);
  }
}

export async function GET() {
  const store = loadAccountsStore();
  let active = store.accounts.find((a) => a.id === store.activeAccountId);
  if (!active && store.accounts.length > 0) {
    active = store.accounts[0];
    store.activeAccountId = active.id;
    saveAccountsStore(store);
  }

  return NextResponse.json({
    activeAccountId: store.activeAccountId,
    activeAccount: active,
    accounts: store.accounts.map((a) => ({
      id: a.id,
      username: a.username,
      avatarColor: a.avatarColor,
      playlistsCount: a.playlists?.length || 0,
      createdAt: a.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '').toUpperCase();
    const store = loadAccountsStore();

    let activeAccount = store.accounts.find((a) => a.id === store.activeAccountId);
    if (!activeAccount) {
      activeAccount = store.accounts[0] || createDefaultAccount();
      store.activeAccountId = activeAccount.id;
    }

    // 1. CREATE ACCOUNT
    if (action === 'CREATE_ACCOUNT') {
      const username = String(body.username || '').trim() || `Игрок ${store.accounts.length + 1}`;
      const color = String(body.avatarColor || AVATAR_COLORS[store.accounts.length % AVATAR_COLORS.length]);
      const newAcc = createDefaultAccount(username, color);
      store.accounts.push(newAcc);
      store.activeAccountId = newAcc.id;
      saveAccountsStore(store);

      return NextResponse.json({
        ok: true,
        message: `Профиль ${username} создан`,
        activeAccountId: newAcc.id,
        activeAccount: newAcc,
        accounts: store.accounts,
      });
    }

    // 2. SWITCH ACCOUNT
    if (action === 'SWITCH_ACCOUNT') {
      const targetId = String(body.accountId || '');
      const found = store.accounts.find((a) => a.id === targetId);
      if (!found) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      store.activeAccountId = found.id;
      saveAccountsStore(store);

      return NextResponse.json({
        ok: true,
        activeAccountId: found.id,
        activeAccount: found,
        accounts: store.accounts,
      });
    }

    // 3. DELETE ACCOUNT
    if (action === 'DELETE_ACCOUNT') {
      const targetId = String(body.accountId || '');
      if (store.accounts.length <= 1) {
        return NextResponse.json(
          { error: 'Нельзя удалить единственный профиль' },
          { status: 400 }
        );
      }
      store.accounts = store.accounts.filter((a) => a.id !== targetId);
      if (store.activeAccountId === targetId) {
        store.activeAccountId = store.accounts[0].id;
      }
      saveAccountsStore(store);

      const nextActive = store.accounts.find((a) => a.id === store.activeAccountId);
      return NextResponse.json({
        ok: true,
        activeAccountId: store.activeAccountId,
        activeAccount: nextActive,
        accounts: store.accounts,
      });
    }

    // 4. UPDATE ACCOUNT PROFILE & PREFERENCES
    if (action === 'UPDATE_PROFILE') {
      if (body.username) activeAccount.username = String(body.username).trim();
      if (body.avatarColor) activeAccount.avatarColor = String(body.avatarColor);
      if (Array.isArray(body.favoriteGenres)) activeAccount.favoriteGenres = body.favoriteGenres;
      if (Array.isArray(body.favoriteArtists)) activeAccount.favoriteArtists = body.favoriteArtists;
      if (typeof body.customArtistsText === 'string') activeAccount.customArtistsText = body.customArtistsText;
      if (Array.isArray(body.gameGenres)) activeAccount.gameGenres = body.gameGenres;
      if (body.driveMode) activeAccount.driveMode = body.driveMode;
      if (body.selectedPlaylistId !== undefined) activeAccount.selectedPlaylistId = body.selectedPlaylistId;
      if (body.useCustomPlaylistInAutopilot !== undefined) {
        activeAccount.useCustomPlaylistInAutopilot = Boolean(body.useCustomPlaylistInAutopilot);
      }

      saveAccountsStore(store);
      return NextResponse.json({
        ok: true,
        activeAccount,
      });
    }

    // 5. CREATE SCENE-BASED PLAYLIST
    if (action === 'CREATE_PLAYLIST') {
      const name = String(body.name || '').trim() || 'Новый сценарный сет';
      const gameTag = String(body.gameTag || '').trim() || 'Для любых игр';
      const description = String(body.description || '').trim();

      const newPl = createDefaultScenePlaylist(name, gameTag);
      if (description) newPl.description = description;

      // Initialize all 6 scenes cleanly
      newPl.scenes = {
        EXPLORE: [],
        COMBAT: [],
        BOSSFIGHT: [],
        DRAMA: [],
        MAJESTIC: [],
        STEALTH: [],
      };

      if (!activeAccount.playlists) activeAccount.playlists = [];
      activeAccount.playlists.push(newPl);
      activeAccount.selectedPlaylistId = newPl.id;

      saveAccountsStore(store);
      return NextResponse.json({
        ok: true,
        playlist: newPl,
        activeAccount,
      });
    }

    // 6. UPDATE PLAYLIST INFO
    if (action === 'UPDATE_PLAYLIST') {
      const plId = String(body.playlistId || '');
      const pl = activeAccount.playlists.find((p) => p.id === plId);
      if (!pl) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

      if (body.name) pl.name = String(body.name).trim();
      if (body.gameTag) pl.gameTag = String(body.gameTag).trim();
      if (body.description !== undefined) pl.description = String(body.description).trim();
      if (body.setActiveInAutopilot !== undefined) {
        activeAccount.useCustomPlaylistInAutopilot = Boolean(body.setActiveInAutopilot);
        activeAccount.selectedPlaylistId = pl.id;
      }
      pl.updatedAt = Date.now();

      saveAccountsStore(store);
      return NextResponse.json({
        ok: true,
        playlist: pl,
        activeAccount,
      });
    }

    // 7. DELETE PLAYLIST
    if (action === 'DELETE_PLAYLIST') {
      const plId = String(body.playlistId || '');
      activeAccount.playlists = activeAccount.playlists.filter((p) => p.id !== plId);
      if (activeAccount.selectedPlaylistId === plId) {
        activeAccount.selectedPlaylistId = activeAccount.playlists[0]?.id || undefined;
      }

      saveAccountsStore(store);
      return NextResponse.json({
        ok: true,
        activeAccount,
      });
    }

    // 8. ADD TRACK TO SCENE (e.g. EXPLORE / COMBAT / BOSSFIGHT / DRAMA / MAJESTIC / STEALTH)
    if (action === 'ADD_TRACK_TO_SCENE') {
      const plId = String(body.playlistId || '');
      const sceneId = (String(body.sceneId || body.scene || 'EXPLORE').toUpperCase()) as SceneBucketId;
      const track = body.track as TrackItem;

      if (!track || !track.title) {
        return NextResponse.json({ error: 'Missing track data' }, { status: 400 });
      }

      const pl = activeAccount.playlists.find((p) => p.id === plId);
      if (!pl) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

      if (!pl.scenes) {
        pl.scenes = {
          EXPLORE: [],
          COMBAT: [],
          BOSSFIGHT: [],
          DRAMA: [],
          MAJESTIC: [],
          STEALTH: [],
        };
      }
      if (!Array.isArray(pl.scenes[sceneId])) {
        pl.scenes[sceneId] = [];
      }

      // Check duplicate
      const alreadyHas = pl.scenes[sceneId].some(
        (t) => (t.videoId && t.videoId === track.videoId) || t.id === track.id
      );

      if (!alreadyHas) {
        pl.scenes[sceneId].push({
          ...track,
          vibe: sceneId,
        });
        pl.updatedAt = Date.now();
        saveAccountsStore(store);
      }

      return NextResponse.json({
        ok: true,
        playlist: pl,
        activeAccount,
      });
    }

    // 9. REMOVE TRACK FROM SCENE
    if (action === 'REMOVE_TRACK_FROM_SCENE') {
      const plId = String(body.playlistId || '');
      const sceneId = (String(body.sceneId || body.scene || 'EXPLORE').toUpperCase()) as SceneBucketId;
      const trackId = String(body.trackId || '');

      const pl = activeAccount.playlists.find((p) => p.id === plId);
      if (!pl || !pl.scenes || !Array.isArray(pl.scenes[sceneId])) {
        return NextResponse.json({ error: 'Track or scene not found' }, { status: 404 });
      }

      pl.scenes[sceneId] = pl.scenes[sceneId].filter((t) => t.id !== trackId && t.videoId !== trackId);
      pl.updatedAt = Date.now();
      saveAccountsStore(store);

      return NextResponse.json({
        ok: true,
        playlist: pl,
        activeAccount,
      });
    }

    // 10. IMPORT PLAYLIST FROM SHARE CODE OR JSON
    if (action === 'IMPORT_PLAYLIST') {
      const rawData = body.playlistData;
      let parsedPl: Partial<ScenePlaylist> | null = null;

      if (typeof rawData === 'string') {
        const trimmed = rawData.trim();
        if (trimmed.startsWith('GV2:')) {
          const b64 = trimmed.slice(4);
          const decoded = Buffer.from(b64, 'base64').toString('utf-8');
          parsedPl = JSON.parse(decoded);
        } else {
          parsedPl = JSON.parse(trimmed);
        }
      } else if (rawData && typeof rawData === 'object') {
        parsedPl = rawData as Partial<ScenePlaylist>;
      }

      if (!parsedPl || typeof parsedPl !== 'object') {
        return NextResponse.json({ error: 'Некорректный формат подборки' }, { status: 400 });
      }

      const now = Date.now();
      const bucketIds: SceneBucketId[] = ['EXPLORE', 'COMBAT', 'BOSSFIGHT', 'DRAMA', 'MAJESTIC', 'STEALTH'];
      const cleanScenes: Record<SceneBucketId, TrackItem[]> = {
        EXPLORE: [],
        COMBAT: [],
        BOSSFIGHT: [],
        DRAMA: [],
        MAJESTIC: [],
        STEALTH: [],
      };

      if (parsedPl.scenes && typeof parsedPl.scenes === 'object') {
        for (const bId of bucketIds) {
          const list = (parsedPl.scenes as Record<string, unknown>)[bId];
          if (Array.isArray(list)) {
            cleanScenes[bId] = list
              .filter((t): t is TrackItem => Boolean(t && typeof t === 'object' && 'title' in t))
              .map((t) => ({
                id: String(t.id || `yt-${t.videoId || Math.random().toString(36).slice(2, 7)}`),
                videoId: t.videoId ? String(t.videoId) : '',
                title: String(t.title || 'Track'),
                artist: String(t.artist || 'Unknown Artist'),
                album: String(t.album || 'Imported Scene'),
                duration: String(t.duration || '03:30'),
                thumbnail: String(
                  t.thumbnail ||
                    (t.videoId
                      ? `https://i.ytimg.com/vi/${t.videoId}/hq720.jpg`
                      : 'https://i.ytimg.com/vi/7G7yCE2nZ1Y/hq720.jpg')
                ),
                vibe: bId,
                genreTag: String(t.genreTag || bId),
              }));
          }
        }
      }

      const importedPl: ScenePlaylist = {
        id: `pl-${now}-${Math.random().toString(36).slice(2, 6)}`,
        name: String(parsedPl.name || 'Импортированная подборка').trim(),
        gameTag: String(parsedPl.gameTag || 'Для любых игр').trim(),
        description: String(
          parsedPl.description || 'Импортированный сценарный сет для ИИ-режиссера'
        ).trim(),
        createdAt: now,
        updatedAt: now,
        scenes: cleanScenes,
      };

      if (!activeAccount.playlists) activeAccount.playlists = [];
      activeAccount.playlists.push(importedPl);
      activeAccount.selectedPlaylistId = importedPl.id;
      activeAccount.useCustomPlaylistInAutopilot = true;

      saveAccountsStore(store);
      return NextResponse.json({
        ok: true,
        playlist: importedPl,
        activeAccount,
      });
    }

    // 11. ADD CUSTOM FLEXIBLE SCENE RULE TO PLAYLIST
    if (action === 'ADD_CUSTOM_SCENE') {
      const plId = String(body.playlistId || '');
      const name = String(body.name || '').trim();
      const musicBrief = String(body.musicBrief || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Укажите название сцены' }, { status: 400 });
      }
      const pl = activeAccount.playlists.find((p) => p.id === plId);
      if (!pl) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

      if (!Array.isArray(pl.customScenes)) pl.customScenes = [];
      const newRule = {
        id: `csc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        description: String(body.description || name).trim(),
        musicBrief: musicBrief || name,
        keywords: Array.isArray(body.keywords)
          ? body.keywords.map((k: unknown) => String(k).trim()).filter(Boolean)
          : name.toLowerCase().split(/[\s,]+/).filter(Boolean),
        targetEnergy: Math.max(0, Math.min(100, Number(body.targetEnergy ?? 45))),
        targetTension: Math.max(0, Math.min(100, Number(body.targetTension ?? 45))),
        targetValence: Math.max(-100, Math.min(100, Number(body.targetValence ?? 0))),
        accentColor: String(body.accentColor || '#FF6A00'),
        tracks: [],
      };
      pl.customScenes.push(newRule);
      pl.updatedAt = Date.now();
      saveAccountsStore(store);

      return NextResponse.json({
        ok: true,
        customScene: newRule,
        playlist: pl,
        activeAccount,
      });
    }

    // 12. ADD TRACK TO CUSTOM SCENE RULE
    if (action === 'ADD_TRACK_TO_CUSTOM_SCENE') {
      const plId = String(body.playlistId || '');
      const customSceneId = String(body.customSceneId || '');
      const track = body.track as TrackItem;
      const pl = activeAccount.playlists.find((p) => p.id === plId);
      const rule = pl?.customScenes?.find((c) => c.id === customSceneId);
      if (!pl || !rule || !track?.title) {
        return NextResponse.json({ error: 'Scene or track not found' }, { status: 404 });
      }
      if (!Array.isArray(rule.tracks)) rule.tracks = [];
      const exists = rule.tracks.some(
        (t) => (t.videoId && t.videoId === track.videoId) || t.id === track.id
      );
      if (!exists) {
        rule.tracks.push(track);
        pl.updatedAt = Date.now();
        saveAccountsStore(store);
      }
      return NextResponse.json({ ok: true, playlist: pl, activeAccount });
    }

    // 13. REMOVE CUSTOM SCENE RULE OR TRACK FROM CUSTOM SCENE RULE
    if (action === 'REMOVE_CUSTOM_SCENE') {
      const plId = String(body.playlistId || '');
      const customSceneId = String(body.customSceneId || '');
      const pl = activeAccount.playlists.find((p) => p.id === plId);
      if (!pl) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
      pl.customScenes = (pl.customScenes || []).filter((c) => c.id !== customSceneId);
      pl.updatedAt = Date.now();
      saveAccountsStore(store);
      return NextResponse.json({ ok: true, playlist: pl, activeAccount });
    }

    if (action === 'REMOVE_TRACK_FROM_CUSTOM_SCENE') {
      const plId = String(body.playlistId || '');
      const customSceneId = String(body.customSceneId || '');
      const trackId = String(body.trackId || '');
      const pl = activeAccount.playlists.find((p) => p.id === plId);
      const rule = pl?.customScenes?.find((c) => c.id === customSceneId);
      if (!pl || !rule) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
      rule.tracks = (rule.tracks || []).filter((t) => t.id !== trackId && t.videoId !== trackId);
      pl.updatedAt = Date.now();
      saveAccountsStore(store);
      return NextResponse.json({ ok: true, playlist: pl, activeAccount });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
