import { NextRequest, NextResponse } from 'next/server';
import { TrackItem, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

function formatDurationMs(ms?: number): string {
  if (!ms || ms <= 0) return '03:20';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Dynamic mood & scene discovery pools with real acclaimed artists
 * across Rock, Rap/Trap, Phonk, Electronic, and Metal so Autopilot
 * always finds real music (never stock library albums) tailored to the live game state.
 */
const SCENE_ARTIST_MOOD_POOLS: Record<
  VibeStateId,
  { dark: string[]; bright: string[]; description: string }
> = {
  EXPLORE: {
    description: 'Спокойное исследование / Атмосфера',
    dark: [
      'Deftones',
      'Kavinsky',
      'Скриптонит',
      'Кино',
      'Radiohead',
      'The Neighbourhood',
      'Massive Attack',
      'M83',
      'Burial',
      'Portishead',
      'Aphex Twin',
      'Placebo',
    ],
    bright: [
      'Arctic Monkeys',
      'Tame Impala',
      'Gorillaz',
      'Daft Punk',
      'A$AP Rocky',
      'Miyagi',
      'Nirvana',
      'Red Hot Chili Peppers',
      'Kanye West',
      'The Weeknd',
      'Kid Cudi',
      'Mac DeMarco',
    ],
  },
  STEALTH: {
    description: 'Напряжение / Ночь / Скрытность',
    dark: [
      'BONES',
      'Crystal Castles',
      'Gesaffelstein',
      '$uicideboy$',
      'DVRST',
      'PHARAOH',
      '21 Savage',
      'Metro Boomin',
      'Night Lovell',
      'Kordhell',
      'Interworld',
      'Nine Inch Nails',
    ],
    bright: [
      'Muse',
      'Depeche Mode',
      'The Prodigy',
      'Travis Scott',
      'Playboi Carti',
      'Future',
      'health',
      'Perturbator',
      'Kavinsky',
      'Justice',
    ],
  },
  COMBAT: {
    description: 'Активный бой / Движение / Экшен',
    dark: [
      'Travis Scott',
      'Playboi Carti',
      'The Prodigy',
      'Pendulum',
      'Denzel Curry',
      'Linkin Park',
      'Bring Me The Horizon',
      'Big Baby Tape',
      'Yeat',
      'Kordhell',
      'Carpenter Brut',
      'Limp Bizkit',
    ],
    bright: [
      'Linkin Park',
      'Nirvana',
      'Muse',
      'System Of A Down',
      'Kanye West',
      'Travis Scott',
      'The Chemical Brothers',
      'Royal Blood',
      'Queens of the Stone Age',
      'Pendulum',
    ],
  },
  BOSSFIGHT: {
    description: 'Пик боя / Максимальный накал',
    dark: [
      'Rammstein',
      'Slipknot',
      'Deftones',
      'System Of A Down',
      'Metallica',
      'Ghostemane',
      'Korn',
      'Slayer',
      'Pantera',
      'Playboi Carti',
      'The Prodigy',
      'Meshuggah',
    ],
    bright: [
      'Rammstein',
      'Metallica',
      'Linkin Park',
      'System Of A Down',
      'Slipknot',
      'Bring Me The Horizon',
      'Deftones',
      'Disturbed',
      'Avenged Sevenfold',
    ],
  },
  VICTORY: {
    description: 'После боя / Завершение сцены',
    dark: [
      'Deftones',
      'Кино',
      'Kanye West',
      'Linkin Park',
      'Gorillaz',
      'Daft Punk',
      'M83',
    ],
    bright: [
      'Kanye West',
      'Daft Punk',
      'Gorillaz',
      'A$AP Rocky',
      'Arctic Monkeys',
      'The Weeknd',
    ],
  },
};

function pickRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function mapItunesItemToTrack(
  item: Record<string, unknown>,
  vibe: VibeStateId,
  idx: number
): TrackItem {
  const art100 = typeof item.artworkUrl100 === 'string' ? item.artworkUrl100 : '';
  const hiResArt = art100
    ? art100.replace('100x100bb', '600x600bb')
    : 'https://i.ytimg.com/vi/sTPn4Jlrjb0/hqdefault.jpg';

  return {
    id: String(item.trackId || `live-${vibe}-${idx}-${Date.now()}`),
    videoId: String(item.trackId || ''),
    title: String(item.trackName || 'Unknown Track'),
    artist: String(item.artistName || 'Unknown Artist'),
    album: String(item.collectionName || 'Single'),
    duration: formatDurationMs(
      typeof item.trackTimeMillis === 'number' ? item.trackTimeMillis : 200000
    ),
    thumbnail: hiResArt,
    previewUrl: typeof item.previewUrl === 'string' ? item.previewUrl : undefined,
    vibe,
    genreTag: String(item.primaryGenreName || 'Music'),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'autopilot';
  const query = searchParams.get('q') || '';
  const vibe = (searchParams.get('vibe') as VibeStateId) || 'EXPLORE';
  const brightness = Number(searchParams.get('brightness') ?? 45);
  const userHint = searchParams.get('hint') || '';

  try {
    // 1. Direct User Search
    if (mode === 'search' && query.trim().length > 0) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        query.trim()
      )}&media=music&entity=song&limit=20`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        const tracks = results
          .filter((r: Record<string, unknown>) => typeof r.previewUrl === 'string')
          .map((item: Record<string, unknown>, idx: number) =>
            mapItunesItemToTrack(item, vibe, idx)
          );
        return NextResponse.json({
          source: 'live-search',
          query: query.trim(),
          vibe,
          tracks,
        });
      }
    }

    // 2. Unscripted Dynamic Autopilot Stream:
    // If user typed a hint (e.g. "Deftones" or "Phonk"), query around that hint with random offset;
    // Otherwise sample 5 different real artists matching the current scene + screen brightness in parallel!
    if (userHint.trim().length > 0) {
      const offset = Math.floor(Math.random() * 8);
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        userHint.trim()
      )}&media=music&entity=song&limit=15&offset=${offset}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        const tracks = results
          .filter((r: Record<string, unknown>) => typeof r.previewUrl === 'string')
          .map((item: Record<string, unknown>, idx: number) =>
            mapItunesItemToTrack(item, vibe, idx)
          );
        if (tracks.length > 0) {
          return NextResponse.json({
            source: 'autopilot-hint',
            vibe,
            resolvedMoodQuery: `${SCENE_ARTIST_MOOD_POOLS[vibe]?.description} · ${userHint.trim()}`,
            tracks: tracks.sort(() => Math.random() - 0.5),
          });
        }
      }
    }

    const poolConfig = SCENE_ARTIST_MOOD_POOLS[vibe] || SCENE_ARTIST_MOOD_POOLS.EXPLORE;
    const isDark = brightness < 35;
    const candidateArtists = isDark
      ? [...poolConfig.dark, ...pickRandomItems(poolConfig.bright, 3)]
      : [...poolConfig.bright, ...pickRandomItems(poolConfig.dark, 3)];

    const chosenArtists = pickRandomItems(Array.from(new Set(candidateArtists)), 6);

    const artistResponses = await Promise.all(
      chosenArtists.map(async (artist) => {
        try {
          const offset = Math.floor(Math.random() * 6);
          const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
            artist
          )}&media=music&entity=song&limit=3&offset=${offset}`;
          const r = await fetch(url);
          if (!r.ok) return [];
          const d = await r.json();
          return Array.isArray(d?.results) ? d.results : [];
        } catch {
          return [];
        }
      })
    );

    const flatResults = artistResponses
      .flat()
      .filter((r: Record<string, unknown>) => typeof r.previewUrl === 'string');

    if (flatResults.length > 0) {
      const tracks = flatResults
        .map((item: Record<string, unknown>, idx: number) =>
          mapItunesItemToTrack(item, vibe, idx)
        )
        .sort(() => Math.random() - 0.5);

      return NextResponse.json({
        source: 'autopilot-dynamic',
        vibe,
        resolvedMoodQuery: `${poolConfig.description} (${chosenArtists.slice(0, 4).join(', ')})`,
        tracks,
      });
    }
  } catch {
    // Fallback if offline
  }

  return NextResponse.json({
    source: 'offline',
    vibe,
    resolvedMoodQuery: 'Автономный режим',
    tracks: [],
  });
}
