import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const APP_STATE_FILE = path.join(process.cwd(), 'data', 'app-state.json');

export async function GET() {
  try {
    if (fs.existsSync(APP_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(APP_STATE_FILE, 'utf-8'));
      return NextResponse.json(data);
    }
  } catch {
    // fallback
  }
  return NextResponse.json({
    isPlaying: false,
    duckingEnabled: true,
    volume: 80,
    activeVibe: 'EXPLORE',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dir = path.dirname(APP_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const currentData = fs.existsSync(APP_STATE_FILE)
      ? JSON.parse(fs.readFileSync(APP_STATE_FILE, 'utf-8'))
      : {};

    const updated = {
      ...currentData,
      ...body,
      updatedAt: Date.now(),
    };

    fs.writeFileSync(APP_STATE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return NextResponse.json({ success: true, state: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
