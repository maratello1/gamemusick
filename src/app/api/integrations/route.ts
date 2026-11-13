import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'user-integrations.json');

export type AiVisionProvider = 'none' | 'gemini' | 'ollama' | 'openrouter' | 'openai-compat';

export interface AiVisionConfig {
  provider: AiVisionProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  intervalSec: number;
  isValidated: boolean;
}

export interface UserIntegrationsConfig {
  playbackEngine: 'youtube' | 'spotify' | 'apple';
  aiVision: AiVisionConfig;
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

const DEFAULT_PROVIDER_URLS: Record<AiVisionProvider, string> = {
  none: '',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  ollama: 'http://127.0.0.1:11434/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  'openai-compat': 'https://api.openai.com/v1',
};

const DEFAULT_CONFIG: UserIntegrationsConfig = {
  playbackEngine: 'youtube',
  aiVision: {
    provider: 'none',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: '',
    model: 'gemini-3.5-flash-lite',
    intervalSec: 10,
    isValidated: false,
  },
  gemini: {
    enabled: false,
    apiKey: '',
    model: 'gemini-3.5-flash-lite',
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
      const parsedGemini = { ...DEFAULT_CONFIG.gemini, ...(parsed.gemini || {}) };
      const derivedProvider: AiVisionProvider = parsed.aiVision?.provider
        ? parsed.aiVision.provider
        : parsedGemini.enabled
        ? 'gemini'
        : 'none';

      cfg = {
        ...DEFAULT_CONFIG,
        ...parsed,
        gemini: parsedGemini,
        aiVision: {
          ...DEFAULT_CONFIG.aiVision,
          ...(parsed.aiVision || {}),
          provider: derivedProvider,
          model: parsed.aiVision?.model || parsedGemini.model || 'gemini-3.5-flash-lite',
          apiKey: parsed.aiVision?.apiKey || parsedGemini.apiKey || '',
          intervalSec: Number(parsed.aiVision?.intervalSec || parsedGemini.intervalSec || 10),
        },
        spotify: { ...DEFAULT_CONFIG.spotify, ...(parsed.spotify || {}) },
        appleMusic: { ...DEFAULT_CONFIG.appleMusic, ...(parsed.appleMusic || {}) },
      };
    }

    if (!cfg.gemini.apiKey && process.env.GEMINI_API_KEY) {
      cfg.gemini.apiKey = process.env.GEMINI_API_KEY;
      cfg.gemini.enabled = true;
      cfg.gemini.isValidated = true;
      if (cfg.aiVision.provider === 'none') {
        cfg.aiVision.provider = 'gemini';
        cfg.aiVision.apiKey = process.env.GEMINI_API_KEY;
        cfg.aiVision.model = cfg.gemini.model;
        cfg.aiVision.isValidated = true;
      }
    }
    return cfg;
  } catch {
    // ignore corrupt config
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

async function testVisionProviderEndpoint(params: {
  provider: AiVisionProvider;
  baseUrl?: string;
  apiKey?: string;
}) {
  const provider = params.provider || 'gemini';

  if (provider === 'gemini') {
    const key = String(params.apiKey || '').trim();
    if (!key) {
      return { ok: false, status: 400, error: 'Введите API-ключ Google Gemini' };
    }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        ok: false,
        status: 400,
        error: errData.error?.message || `HTTP ${res.status} Unauthorized`,
      };
    }
    return { ok: true, status: 200, message: 'Ключ Gemini API действителен!' };
  }

  const rawBase = String(params.baseUrl || DEFAULT_PROVIDER_URLS[provider] || '').trim().replace(/\/+$/, '');
  if (!rawBase) {
    return { ok: false, status: 400, error: 'Укажите Base URL сервера' };
  }

  if (provider === 'ollama') {
    const rootHost = rawBase.replace(/\/v1$/i, '');
    const res = await fetch(`${rootHost}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        error: `Ollama не отвечает на ${rootHost} (HTTP ${res.status}). Проверьте, что Ollama запущена.`,
      };
    }
    const data = await res.json().catch(() => ({}));
    const models = Array.isArray(data?.models) ? data.models.map((m: any) => String(m.name)) : [];
    return {
      ok: true,
      status: 200,
      models,
      message:
        models.length > 0
          ? `Ollama подключена! Доступные модели: ${models.slice(0, 5).join(', ')}`
          : 'Ollama подключена (список моделей пуст — выполните ollama pull qwen3-vl:2b)',
    };
  }

  // OpenRouter or generic OpenAI-compatible API
  const key = String(params.apiKey || '').trim();
  const modelsUrl = rawBase.endsWith('/models') ? rawBase : `${rawBase}/models`;
  const headers: Record<string, string> = {};
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(6000) });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      ok: false,
      status: 400,
      error: `Ошибка подключения к ${modelsUrl}: HTTP ${res.status} ${errText.slice(0, 120)}`,
    };
  }
  return { ok: true, status: 200, message: `Подключение к ${provider} успешно!` };
}

export async function GET() {
  const cfg = readConfig();

  return NextResponse.json({
    playbackEngine: cfg.playbackEngine,
    aiVision: {
      provider: cfg.aiVision.provider,
      baseUrl: cfg.aiVision.baseUrl,
      hasKey: Boolean(cfg.aiVision.apiKey && cfg.aiVision.apiKey.length > 3),
      maskedKey: maskKey(cfg.aiVision.apiKey),
      model: cfg.aiVision.model,
      intervalSec: cfg.aiVision.intervalSec,
      isValidated: cfg.aiVision.isValidated,
    },
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

    // 1. Validate Gemini or OpenAI-compatible/Ollama endpoints
    if (body.testGeminiKey) {
      try {
        const result = await testVisionProviderEndpoint({
          provider: 'gemini',
          apiKey: body.geminiApiKey || current.gemini.apiKey,
        });
        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }
        return NextResponse.json({ ok: true, valid: true, message: result.message });
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: `Ошибка подключения к Gemini: ${String(err)}` },
          { status: 502 }
        );
      }
    }

    if (body.testAiEndpoint) {
      try {
        const prov = (body.provider || current.aiVision.provider || 'ollama') as AiVisionProvider;
        const result = await testVisionProviderEndpoint({
          provider: prov,
          baseUrl: body.baseUrl || current.aiVision.baseUrl,
          apiKey: body.apiKey || current.aiVision.apiKey,
        });
        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }
        return NextResponse.json({
          ok: true,
          valid: true,
          message: result.message,
          models: result.models,
        });
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: `Сервер ИИ недоступен: ${String(err)}` },
          { status: 502 }
        );
      }
    }

    // 2. Update Configuration (keep aiVision & gemini synchronized cleanly)
    const nextAiVision: AiVisionConfig = body.aiVision
      ? {
          ...current.aiVision,
          ...body.aiVision,
          baseUrl:
            body.aiVision.baseUrl !== undefined
              ? String(body.aiVision.baseUrl).trim()
              : current.aiVision.baseUrl || DEFAULT_PROVIDER_URLS[(body.aiVision.provider || current.aiVision.provider) as AiVisionProvider],
          apiKey:
            body.aiVision.apiKey !== undefined && body.aiVision.apiKey !== ''
              ? String(body.aiVision.apiKey).trim()
              : current.aiVision.apiKey,
        }
      : {
          ...current.aiVision,
          ...(body.gemini?.enabled !== undefined
            ? { provider: body.gemini.enabled ? 'gemini' : 'none' }
            : {}),
          ...(body.gemini?.model ? { model: String(body.gemini.model).trim() } : {}),
          ...(body.gemini?.apiKey !== undefined && body.gemini.apiKey !== ''
            ? { apiKey: String(body.gemini.apiKey).trim() }
            : {}),
        };

    const nextGemini = {
      ...current.gemini,
      ...(body.gemini || {}),
      enabled:
        body.aiVision !== undefined
          ? nextAiVision.provider === 'gemini'
          : body.gemini?.enabled !== undefined
          ? Boolean(body.gemini.enabled)
          : current.gemini.enabled,
      model:
        nextAiVision.provider === 'gemini' && nextAiVision.model
          ? nextAiVision.model
          : body.gemini?.model || current.gemini.model,
      apiKey:
        body.gemini?.apiKey !== undefined && body.gemini.apiKey !== ''
          ? String(body.gemini.apiKey).trim()
          : nextAiVision.provider === 'gemini' && nextAiVision.apiKey
          ? nextAiVision.apiKey
          : current.gemini.apiKey,
    };

    const updated: UserIntegrationsConfig = {
      playbackEngine: body.playbackEngine || current.playbackEngine,
      aiVision: nextAiVision,
      gemini: nextGemini,
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
      aiVision: {
        provider: updated.aiVision.provider,
        baseUrl: updated.aiVision.baseUrl,
        hasKey: Boolean(updated.aiVision.apiKey),
        maskedKey: maskKey(updated.aiVision.apiKey),
        model: updated.aiVision.model,
        intervalSec: updated.aiVision.intervalSec,
        isValidated: updated.aiVision.isValidated,
      },
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
