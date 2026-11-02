import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { INITIAL_GAME_PROFILES } from '@/lib/defaultData';
import { GameRuleProfile, TrackItem } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const STORE_PATH = path.join(process.cwd(), 'data', 'store-v2.json');

interface CleanStoreSchema {
  gameProfiles: GameRuleProfile[];
  activeGameProfileId: string;
  savedTracks: TrackItem[];
  autoSwitchEnabled: boolean;
  cooldownSec: number;
  activeBridgeTrack: {
    videoId: string;
    title: string;
    artist: string;
    vibe: string;
    volume: number;
    updatedAt: number;
  } | null;
}

function readStore(): CleanStoreSchema {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw) as CleanStoreSchema;
    }
  } catch {
    // fallback
  }

  const initial: CleanStoreSchema = {
    gameProfiles: INITIAL_GAME_PROFILES,
    activeGameProfileId: 'universal',
    savedTracks: [],
    autoSwitchEnabled: true,
    cooldownSec: 10,
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

function writeStore(data: CleanStoreSchema) {
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

    if (body.action === 'SELECT_GAME_PROFILE' && body.profileId) {
      store.activeGameProfileId = String(body.profileId);
    } else if (body.action === 'ADD_GAME_PROFILE' && body.gameProfile) {
      const created: GameRuleProfile = {
        ...INITIAL_GAME_PROFILES[0],
        ...body.gameProfile,
        id: `game-${Date.now()}`,
      };
      store.gameProfiles = [created, ...store.gameProfiles];
      store.activeGameProfileId = created.id;
    } else if (body.action === 'TOGGLE_SAVE_TRACK' && body.track) {
      const t = body.track as TrackItem;
      const exists = store.savedTracks.some((item) => item.id === t.id);
      if (exists) {
        store.savedTracks = store.savedTracks.filter((item) => item.id !== t.id);
      } else {
        store.savedTracks = [t, ...store.savedTracks];
      }
    } else if (body.action === 'SYNC_BRIDGE' && body.bridgeTrack) {
      store.activeBridgeTrack = {
        ...body.bridgeTrack,
        updatedAt: Date.now(),
      };
    }

    writeStore(store);
    return NextResponse.json({ ok: true, store });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
