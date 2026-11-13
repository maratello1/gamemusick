import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  buildGsiCfgContent,
  detectSteamGameCfgDirs,
  GsiMetricsMemory,
  parseGsiPayload,
} from '@/lib/gsi-engine';
import { GsiStateSnapshot } from '@/types/vibe';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const GSI_FILE = path.join(DATA_DIR, 'live-gsi.json');
const GSI_TMP = path.join(DATA_DIR, 'live-gsi.tmp.json');

let gsiMemory: GsiMetricsMemory = {
  lastHealthPercent: 100,
  lastKills: 0,
  lastAssists: 0,
  lastCombatUntilMs: 0,
  lastCs2Health: 100,
  lastCs2Kills: 0,
  lastTimestamp: 0,
};

function readLatestGsi(): { gsiActive: boolean; gsi: GsiStateSnapshot | null } {
  try {
    if (!fs.existsSync(GSI_FILE)) return { gsiActive: false, gsi: null };
    const stat = fs.statSync(GSI_FILE);
    const isFresh = Date.now() - stat.mtimeMs < 15000;
    const raw = JSON.parse(fs.readFileSync(GSI_FILE, 'utf8')) as GsiStateSnapshot;
    const gsiActive = Boolean(isFresh && raw && raw.game);
    return { gsiActive, gsi: gsiActive ? raw : null };
  } catch {
    return { gsiActive: false, gsi: null };
  }
}

export async function GET() {
  const { gsiActive, gsi } = readLatestGsi();
  const steam = detectSteamGameCfgDirs();
  return NextResponse.json({
    ok: true,
    gsiActive,
    gsi,
    steam,
    cfgSamples: {
      dota2: buildGsiCfgContent('dota2'),
      cs2: buildGsiCfgContent('cs2'),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. One-click GSI config installer for Steam Dota 2 & CS2 directories
    if (body?.action === 'install_cfg') {
      const steam = detectSteamGameCfgDirs();
      const installed: { game: string; filePath: string }[] = [];
      const errors: { game: string; error: string }[] = [];

      const targets: Array<{ key: 'dota2' | 'cs2'; label: string; dir: string | null }> = [
        { key: 'dota2', label: 'Dota 2', dir: steam.dota2Dir },
        { key: 'cs2', label: 'CS2', dir: steam.cs2Dir },
      ];

      for (const target of targets) {
        if (!target.dir) continue;
        try {
          const outFile = path.join(target.dir, steam.cfgFileName);
          fs.writeFileSync(outFile, buildGsiCfgContent(target.key), 'utf8');
          installed.push({ game: target.label, filePath: outFile });
        } catch (err) {
          errors.push({ game: target.label, error: String(err) });
        }
      }

      return NextResponse.json({
        ok: errors.length === 0,
        installed,
        errors,
        steam: detectSteamGameCfgDirs(),
      });
    }

    // 2. Live HTTP telemetry packet from Dota 2 / CS2 client
    const { snapshot, memory } = parseGsiPayload(body, gsiMemory);
    gsiMemory = memory;

    if (snapshot) {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(GSI_TMP, JSON.stringify(snapshot), 'utf8');
      fs.renameSync(GSI_TMP, GSI_FILE);
    }

    return NextResponse.json({ ok: true, accepted: Boolean(snapshot), snapshot });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
