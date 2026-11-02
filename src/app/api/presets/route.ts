import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { INITIAL_INTEGRATIONS, INITIAL_PRESETS, INITIAL_USER_PROFILE } from '@/lib/defaultData';
import { GamePreset, IntegrationPlugin, UserProfile } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const STORE_PATH = path.join(process.cwd(), 'data', 'store.json');

interface StoreSchema {
  presets: GamePreset[];
  profile: UserProfile;
  integrations: IntegrationPlugin[];
  activeBridgeTrack: {
    videoId: string;
    title: string;
    artist: string;
    vibe: string;
    volume: number;
    updatedAt: number;
  } | null;
}

function readStore(): StoreSchema {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw) as StoreSchema;
    }
  } catch {
    // fallback to default
  }

  const initial: StoreSchema = {
    presets: INITIAL_PRESETS,
    profile: INITIAL_USER_PROFILE,
    integrations: INITIAL_INTEGRATIONS,
    activeBridgeTrack: null,
  };

  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }

  return initial;
}

function writeStore(data: StoreSchema) {
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
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const store = readStore();

    if (body.action === 'TOGGLE_LIKE' && body.presetId) {
      store.presets = store.presets.map((p) => {
        if (p.id !== body.presetId) return p;
        const nextLiked = !p.isLiked;
        return {
          ...p,
          isLiked: nextLiked,
          likes: nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
        };
      });
    } else if (body.action === 'CREATE_PRESET' && body.preset) {
      const newPreset: GamePreset = {
        ...INITIAL_PRESETS[0],
        ...body.preset,
        id: `custom-${Date.now()}`,
        likes: 1,
        downloads: 1,
        isLiked: true,
      };
      store.presets = [newPreset, ...store.presets];
      store.profile.activePresetId = newPreset.id;
    } else if (body.action === 'UPDATE_PROFILE' && body.profile) {
      store.profile = {
        ...store.profile,
        ...body.profile,
      };
    } else if (body.action === 'TOGGLE_INTEGRATION' && body.integrationId) {
      store.integrations = store.integrations.map((item) =>
        item.id === body.integrationId ? { ...item, enabled: !item.enabled } : item
      );
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
