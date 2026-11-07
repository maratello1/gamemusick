import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'user-integrations.json');

export interface UserIntegrationsConfig {
  playbackEngine: 'youtube' | 'spotify' | 'apple';
  gemini: {
    enabled: boolean;
    apiKey: string;
    model: string;
    intervalSec: number;
    isValidated: boolean;
    lastTested?: number;
  };
  spotify: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    connected: boolean;
  };
  appleMusic: {
    enabled: boolean;
    developerToken: string;
    connected: boolean;
  };
}

const DEFAULT_CONFIG: UserIntegrationsConfig = {
  playbackEngine: 'youtube',
  gemini: {
    enabled: false,
    apiKey: '',
    model: 'gemini-3.5-flash',
    intervalSec: 10,
    isValidated: false,
  },
  spotify: {
    enabled: false,
    clientId: '',
    clientSecret: '',
    connected: false,
  },
  appleMusic: {
    enabled: false,
    developerToken: '',
    connected: false,
  },
};

function readConfig(): UserIntegrationsConfig {
  try {
    let cfg: UserIntegrationsConfig = DEFAULT_CONFIG;
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      cfg = {
        ...DEFAULT_CONFIG,
        ...parsed,
        gemini: { ...DEFAULT_CONFIG.gemini, ...(parsed.gemini || {}) },
        spotify: { ...DEFAULT_CONFIG.spotify, ...(parsed.spotify || {}) },
        appleMusic: { ...DEFAULT_CONFIG.appleMusic, ...(parsed.appleMusic || {}) },
      };
    }
    if (!cfg.gemini.apiKey && process.env.GEMINI_API_KEY) {
      cfg.gemini.apiKey = process.env.GEMINI_API_KEY;
      cfg.gemini.enabled = true;
      cfg.gemini.isValidated = true;
    }
    return cfg;
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

function saveConfig(cfg: UserIntegrationsConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return '';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export async function GET() {
  const cfg = readConfig();

  // Return safe payload to client (mask sensitive keys)
  return NextResponse.json({
    playbackEngine: cfg.playbackEngine,
    gemini: {
      enabled: cfg.gemini.enabled,
      hasKey: Boolean(cfg.gemini.apiKey && cfg.gemini.apiKey.length > 5),
      maskedKey: maskKey(cfg.gemini.apiKey),
      model: cfg.gemini.model,
      intervalSec: cfg.gemini.intervalSec,
      isValidated: cfg.gemini.isValidated,
      lastTested: cfg.gemini.lastTested,
    },
    spotify: {
      enabled: cfg.spotify.enabled,
      hasClientId: Boolean(cfg.spotify.clientId),
      maskedClientId: maskKey(cfg.spotify.clientId),
      connected: cfg.spotify.connected,
    },
    appleMusic: {
      enabled: cfg.appleMusic.enabled,
      hasToken: Boolean(cfg.appleMusic.developerToken),
      connected: cfg.appleMusic.connected,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const current = readConfig();

    // 1. Validate Gemini Key if requested or newly provided
    if (body.testGeminiKey && body.geminiApiKey) {
      const testKey = String(body.geminiApiKey).trim();
      try {
        const testRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${testKey}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!testRes.ok) {
          const errData = await testRes.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${testRes.status} Unauthorized`;
          return NextResponse.json({ ok: false, error: errMsg }, { status: 400 });
        }
        return NextResponse.json({ ok: true, valid: true });
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: `Ошибка подключения к Gemini: ${String(err)}` },
          { status: 502 }
        );
      }
    }

    // 2. Update Configuration
    const updated: UserIntegrationsConfig = {
      playbackEngine: body.playbackEngine || current.playbackEngine,
      gemini: {
        ...current.gemini,
        ...(body.gemini || {}),
        apiKey:
          body.gemini?.apiKey !== undefined && body.gemini.apiKey !== ''
            ? String(body.gemini.apiKey).trim()
            : current.gemini.apiKey,
      },
      spotify: {
        ...current.spotify,
        ...(body.spotify || {}),
        clientId:
          body.spotify?.clientId !== undefined && body.spotify.clientId !== ''
            ? String(body.spotify.clientId).trim()
            : current.spotify.clientId,
        clientSecret:
          body.spotify?.clientSecret !== undefined && body.spotify.clientSecret !== ''
            ? String(body.spotify.clientSecret).trim()
            : current.spotify.clientSecret,
      },
      appleMusic: {
        ...current.appleMusic,
        ...(body.appleMusic || {}),
        developerToken:
          body.appleMusic?.developerToken !== undefined && body.appleMusic.developerToken !== ''
            ? String(body.appleMusic.developerToken).trim()
            : current.appleMusic.developerToken,
      },
    };

    saveConfig(updated);

    return NextResponse.json({
      ok: true,
      playbackEngine: updated.playbackEngine,
      gemini: {
        enabled: updated.gemini.enabled,
        hasKey: Boolean(updated.gemini.apiKey),
        maskedKey: maskKey(updated.gemini.apiKey),
        model: updated.gemini.model,
        intervalSec: updated.gemini.intervalSec,
        isValidated: updated.gemini.isValidated,
      },
      spotify: {
        enabled: updated.spotify.enabled,
        connected: updated.spotify.connected,
      },
      appleMusic: {
        enabled: updated.appleMusic.enabled,
        connected: updated.appleMusic.connected,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
