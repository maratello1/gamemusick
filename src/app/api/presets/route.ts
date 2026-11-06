import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TrackItem, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const STORE_PATH = path.join(process.cwd(), 'data', 'user-playlists.json');

export interface AiLearningModel {
  artistWeights: Record<string, number>;
  genreWeights: Record<string, number>;
  gameProfiles: Record<string, { preferredGenres: string[]; favoriteArtists: string[] }>;
  totalListens: number;
  totalSkips: number;
}

export interface UserAccountProfile {
  username: string;
  favoriteGenres: string[];
  favoriteArtists: string[];
  customArtistsText: string;
  gameGenres: string[];
  driveMode: 'immersion' | 'balanced' | 'high-drive';
  languagePref: 'all' | 'foreign' | 'ru';
  vocalPref: 'vocal' | 'mixed' | 'instrumental';
  createdAt: number;
}

export interface UserPlaylist {
  id: string;
  name: string;
  gameTag: string;
  tracks: TrackItem[];
  createdAt: number;
}

interface UserStoreSchema {
  accountProfile: UserAccountProfile | null;
  userPlaylists: UserPlaylist[];
  aiLearningModel?: AiLearningModel;
  activeBridgeTrack: {
    videoId: string;
    title: string;
    artist: string;
    vibe: string;
    volume: number;
    updatedAt: number;
  } | null;
}

function readStore(): UserStoreSchema {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        accountProfile: parsed.accountProfile || null,
        userPlaylists: Array.isArray(parsed.userPlaylists) ? parsed.userPlaylists : [],
        aiLearningModel: parsed.aiLearningModel || {
          artistWeights: {},
          genreWeights: {},
          gameProfiles: {},
          totalListens: 0,
          totalSkips: 0,
        },
        activeBridgeTrack: parsed.activeBridgeTrack || null,
      };
    }
  } catch {
    // ignore
  }

  const initial: UserStoreSchema = {
    accountProfile: null,
    userPlaylists: [],
    activeBridgeTrack: null,
  };

  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
  } catch {
    // ignore
  }

  return initial;
}

function writeStore(data: UserStoreSchema) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

export async function GET() {
  const store = readStore();
  return NextResponse.json(store, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const store = readStore();

    if (body.action === 'SAVE_ACCOUNT_PROFILE' && body.profile) {
      store.accountProfile = {
        username: String(body.profile.username || 'Игрок').trim(),
        favoriteGenres: Array.isArray(body.profile.favoriteGenres)
          ? body.profile.favoriteGenres
          : [],
        favoriteArtists: Array.isArray(body.profile.favoriteArtists)
          ? body.profile.favoriteArtists
          : [],
        customArtistsText: String(body.profile.customArtistsText || '').trim(),
        gameGenres: Array.isArray(body.profile.gameGenres) ? body.profile.gameGenres : [],
        driveMode: body.profile.driveMode || 'balanced',
        languagePref: body.profile.languagePref || 'all',
        vocalPref: body.profile.vocalPref || 'mixed',
        createdAt: Date.now(),
      };
      writeStore(store);
      return NextResponse.json({ ok: true, accountProfile: store.accountProfile, store });
    }

    if (body.action === 'CREATE_PLAYLIST' && body.name) {
      const created: UserPlaylist = {
        id: `pl-${Date.now()}`,
        name: String(body.name).trim(),
        gameTag: String(body.gameTag || 'Любая игра').trim(),
        tracks: [],
        createdAt: Date.now(),
      };
      store.userPlaylists.push(created);
      writeStore(store);
      return NextResponse.json({ ok: true, playlist: created, store });
    }

    if (body.action === 'DELETE_PLAYLIST' && body.playlistId) {
      store.userPlaylists = store.userPlaylists.filter((p) => p.id !== body.playlistId);
      writeStore(store);
      return NextResponse.json({ ok: true, store });
    }

    if (body.action === 'ADD_TRACK_TO_PLAYLIST' && body.playlistId && body.track) {
      const pl = store.userPlaylists.find((p) => p.id === body.playlistId);
      if (pl) {
        const track = body.track as TrackItem;
        const exists = pl.tracks.some((t) => t.id === track.id);
        if (!exists) {
          pl.tracks.push(track);
        }
      }
      writeStore(store);
      return NextResponse.json({ ok: true, store });
    }

    if (body.action === 'UPDATE_TRACK_VIBE' && body.playlistId && body.trackId && body.vibe) {
      const pl = store.userPlaylists.find((p) => p.id === body.playlistId);
      if (pl) {
        pl.tracks = pl.tracks.map((t) =>
          t.id === body.trackId ? { ...t, vibe: body.vibe as VibeStateId } : t
        );
      }
      writeStore(store);
      return NextResponse.json({ ok: true, store });
    }

    if (body.action === 'REMOVE_TRACK_FROM_PLAYLIST' && body.playlistId && body.trackId) {
      const pl = store.userPlaylists.find((p) => p.id === body.playlistId);
      if (pl) {
        pl.tracks = pl.tracks.filter((t) => t.id !== body.trackId);
      }
      writeStore(store);
      return NextResponse.json({ ok: true, store });
    }

    if (body.action === 'SYNC_BRIDGE' && body.bridgeTrack) {
      store.activeBridgeTrack = {
        ...body.bridgeTrack,
        updatedAt: Date.now(),
      };
      writeStore(store);
      return NextResponse.json({ ok: true, store });
    }

    if (body.action === 'RECORD_AI_FEEDBACK') {
      if (!store.aiLearningModel) {
        store.aiLearningModel = {
          artistWeights: {},
          genreWeights: {},
          gameProfiles: {},
          totalListens: 0,
          totalSkips: 0,
        };
      }
      const model = store.aiLearningModel;
      const { artist, genre, game, isCompletion, isFastSkip } = body;

      if (artist) {
        const aKey = String(artist).toLowerCase().trim();
        model.artistWeights[aKey] = (model.artistWeights[aKey] || 0) + (isCompletion ? 2 : isFastSkip ? -1 : 0);
      }
      if (genre) {
        const gKey = String(genre).toLowerCase().trim();
        model.genreWeights[gKey] = (model.genreWeights[gKey] || 0) + (isCompletion ? 2 : isFastSkip ? -1 : 0);
      }
      if (game && artist && isCompletion) {
        const gKey = String(game).toLowerCase().trim();
        if (!model.gameProfiles[gKey]) {
          model.gameProfiles[gKey] = { preferredGenres: [], favoriteArtists: [] };
        }
        const prof = model.gameProfiles[gKey];
        const aKey = String(artist).trim();
        if (!prof.favoriteArtists.includes(aKey)) prof.favoriteArtists.push(aKey);
      }

      if (isCompletion) model.totalListens++;
      if (isFastSkip) model.totalSkips++;

      writeStore(store);
      return NextResponse.json({ ok: true, aiLearningModel: model, store });
    }

    return NextResponse.json({ ok: true, store });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
