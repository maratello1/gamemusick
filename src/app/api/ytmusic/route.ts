import { NextRequest, NextResponse } from 'next/server';
import { TrackItem, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

function formatDurationMs(ms?: number): string {
  if (!ms || ms <= 0) return '03:40';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Automatic Audio Energy & Scene Classifier:
 * Analyzes artist, genre, and track metadata so the program determines on its own
 * which in-game moment (EXPLORE, STEALTH, COMBAT, BOSSFIGHT) a song fits best.
 */
function classifyTrackSceneAutomatically(
  title: string,
  artist: string,
  genre: string,
  fallbackVibe: VibeStateId
): VibeStateId {
  const combined = `${title} ${artist} ${genre}`.toLowerCase();

  if (
    /rammstein|slipknot|meshuggah|slayer|pantera|ghostemane|korn|system of a down|chop suey|duality|sonne|my own summer|faint|rage|hardcore|metal|thrash|death/.test(
      combined
    )
  ) {
    return 'BOSSFIGHT';
  }

  if (
    /prodigy|pendulum|travis scott|playboi carti|denzel curry|yeat|big baby tape|kizaru|bring me the horizon|limp bizkit|carpenter brut|fe!n|omen|drum|dnb|action|fight|combat|hype/.test(
      combined
    )
  ) {
    return 'COMBAT';
  }

  if (
    /bones|crystal castles|gesaffelstein|suicideboy|dvrst|pharaoh|21 savage|metro boomin|night lovell|kordhell|interworld|nine inch nails|dark|night|shadow|phonk|underground|witch/.test(
      combined
    )
  ) {
    return 'STEALTH';
  }

  if (
    /entombed|sextape|nightcall|кино|спокойная|скриптонит|radiohead|arctic monkeys|tame impala|gorillaz|daft punk|miyagi|mac demarco|the weeknd|chill|ambient|indie|acoustic|melodic|dream/.test(
      combined
    )
  ) {
    return 'EXPLORE';
  }

  return fallbackVibe;
}

const SCENE_ARTIST_MOOD_POOLS: Record<
  VibeStateId,
  { dark: string[]; bright: string[]; description: string }
> = {
  EXPLORE: {
    description: 'Спокойная игра и исследование',
    dark: [
      'Deftones Entombed',
      'Kavinsky Nightcall',
      'Скриптонит Положение',
      'Кино Спокойная ночь',
      'Radiohead',
      'The Neighbourhood',
      'Massive Attack',
      'M83',
      'Placebo',
    ],
    bright: [
      'Arctic Monkeys',
      'Tame Impala',
      'Gorillaz',
      'Daft Punk',
      'A$AP Rocky',
      'Miyagi',
      'Nirvana Come As You Are',
      'Red Hot Chili Peppers',
      'The Weeknd',
    ],
  },
  STEALTH: {
    description: 'Скрытность, ночь и напряжение',
    dark: [
      'BONES HDMI',
      'Crystal Castles Kerosene',
      'Gesaffelstein',
      '$uicideboy$',
      'DVRST Close Eyes',
      'PHARAOH',
      '21 Savage',
      'Metro Boomin',
      'Night Lovell',
      'Interworld Metamorphosis',
    ],
    bright: [
      'Muse Supermassive',
      'Depeche Mode',
      'Travis Scott',
      'Playboi Carti',
      'Future',
      'Perturbator',
      'Kavinsky',
      'Justice',
    ],
  },
  COMBAT: {
    description: 'Активный экшен и динамика',
    dark: [
      'Travis Scott FE!N',
      'Playboi Carti Sky',
      'The Prodigy Omen',
      'Pendulum Propane Nightmares',
      'Denzel Curry Ultimate',
      'Linkin Park',
      'Bring Me The Horizon',
      'Big Baby Tape',
      'Yeat',
      'Carpenter Brut Turbo Killer',
    ],
    bright: [
      'Linkin Park Faint',
      'Nirvana Smells Like Teen Spirit',
      'Muse Hysteria',
      'System Of A Down',
      'Kanye West',
      'Travis Scott',
      'The Chemical Brothers',
      'Royal Blood',
      'Pendulum',
    ],
  },
  BOSSFIGHT: {
    description: 'Максимальный накал и пик боя',
    dark: [
      'Rammstein Sonne',
      'Slipknot Duality',
      'Deftones My Own Summer',
      'System Of A Down Chop Suey',
      'Metallica Master of Puppets',
      'Ghostemane Mercury',
      'Korn',
      'Slayer',
      'Pantera Walk',
      'The Prodigy Breathe',
    ],
    bright: [
      'Rammstein',
      'Metallica',
      'Linkin Park Faint',
      'System Of A Down',
      'Slipknot',
      'Bring Me The Horizon Kingslayer',
      'Deftones',
      'Disturbed',
    ],
  },
  VICTORY: {
    description: 'Завершение боя',
    dark: ['Deftones Change', 'Кино Группа крови', 'Kanye West', 'Linkin Park In The End'],
    bright: ['Kanye West Flashing Lights', 'Daft Punk', 'Gorillaz Feel Good Inc', 'Arctic Monkeys'],
  },
};

function pickRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function mapItunesItemToTrack(
  item: Record<string, unknown>,
  defaultVibe: VibeStateId,
  idx: number,
  autoClassify: boolean
): TrackItem {
  const art100 = typeof item.artworkUrl100 === 'string' ? item.artworkUrl100 : '';
  const hiResArt = art100
    ? art100.replace('100x100bb', '600x600bb')
    : 'https://i.ytimg.com/vi/sTPn4Jlrjb0/hqdefault.jpg';

  const title = String(item.trackName || 'Unknown Track');
  const artist = String(item.artistName || 'Unknown Artist');
  const genre = String(item.primaryGenreName || 'Music');
  const fallbackPreview = typeof item.previewUrl === 'string' ? item.previewUrl : '';

  const resolvedVibe = autoClassify
    ? classifyTrackSceneAutomatically(title, artist, genre, defaultVibe)
    : defaultVibe;

  // Point previewUrl to our full-length stream resolver (/api/full-stream) with iTunes fallback
  const fullStreamUrl = `/api/full-stream?q=${encodeURIComponent(
    `${artist} ${title}`
  )}&fallback=${encodeURIComponent(fallbackPreview)}`;

  return {
    id: String(item.trackId || `live-${resolvedVibe}-${idx}-${Date.now()}`),
    videoId: String(item.trackId || ''),
    title,
    artist,
    album: String(item.collectionName || 'Single'),
    duration: formatDurationMs(
      typeof item.trackTimeMillis === 'number' ? item.trackTimeMillis : 215000
    ),
    thumbnail: hiResArt,
    previewUrl: fullStreamUrl,
    vibe: resolvedVibe,
    genreTag: genre,
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
    // 1. Direct User Search (auto-classifies every track's scene so user never has to pick)
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
            mapItunesItemToTrack(item, vibe, idx, true)
          );
        return NextResponse.json({
          source: 'live-search',
          query: query.trim(),
          vibe,
          tracks,
        });
      }
    }

    // 2. Unscripted Dynamic Autopilot Stream
    if (userHint.trim().length > 0) {
      const offset = Math.floor(Math.random() * 6);
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
            mapItunesItemToTrack(item, vibe, idx, false)
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
          const offset = Math.floor(Math.random() * 4);
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
          mapItunesItemToTrack(item, vibe, idx, false)
        )
        .sort(() => Math.random() - 0.5);

      return NextResponse.json({
        source: 'autopilot-dynamic',
        vibe,
        resolvedMoodQuery: `${poolConfig.description}`,
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
