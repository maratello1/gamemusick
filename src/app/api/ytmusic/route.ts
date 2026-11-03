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

const GENRE_SCENE_ARTISTS: Record<string, Record<VibeStateId, string[]>> = {
  rock: {
    EXPLORE: ['Deftones Entombed', 'Кино Спокойная ночь', 'Arctic Monkeys 505', 'Radiohead', 'Nirvana Come As You Are', 'Placebo'],
    STEALTH: ['Muse Supermassive', 'Deftones Change', 'Nine Inch Nails', 'Король и Шут', 'Depeche Mode'],
    COMBAT: ['Linkin Park Faint', 'Nirvana Smells Like Teen Spirit', 'Muse Hysteria', 'Royal Blood', 'Кино Группа крови'],
    BOSSFIGHT: ['Deftones My Own Summer', 'Linkin Park Given Up', 'Bring Me The Horizon', 'Queens of the Stone Age'],
    VICTORY: ['Linkin Park In The End', 'Deftones Rosemary', 'Arctic Monkeys'],
  },
  metal: {
    EXPLORE: ['Deftones Sextape', 'System Of A Down Aerials', 'Metallica Nothing Else Matters', 'Slipknot Vermilion'],
    STEALTH: ['Rammstein Mein Herz Brennt', 'Korn', 'Deftones Change', 'Marilyn Manson'],
    COMBAT: ['System Of A Down Toxicity', 'Bring Me The Horizon Throne', 'Limp Bizkit Break Stuff', 'Disturbed'],
    BOSSFIGHT: ['Rammstein Sonne', 'Slipknot Duality', 'System Of A Down Chop Suey', 'Metallica Master of Puppets', 'Pantera Walk', 'Slayer'],
    VICTORY: ['System Of A Down Lonely Day', 'Metallica Fade to Black', 'Linkin Park'],
  },
  rap: {
    EXPLORE: ['Скриптонит Положение', 'A$AP Rocky Sundress', 'Miyagi Silhouette', 'Kanye West Flashing Lights', 'Kid Cudi'],
    STEALTH: ['BONES HDMI', '$uicideboy$ Paris', 'PHARAOH Black Siemens', '21 Savage redrum', 'Night Lovell'],
    COMBAT: ['Travis Scott FE!N', 'Playboi Carti Sky', 'Denzel Curry Ultimate', 'Big Baby Tape 99 Problems', 'Yeat', 'Future'],
    BOSSFIGHT: ['Playboi Carti Stop Breathing', 'Ghostemane Mercury', 'XXXTENTACION Look At Me', 'Denzel Curry Sumo', 'BONES RestInPeace'],
    VICTORY: ['Kanye West Stronger', 'A$AP Rocky Praise The Lord', 'Travis Scott Goosebumps'],
  },
  phonk: {
    EXPLORE: ['DVRST Dream Space', 'Skeler Tel Aviv', 'LXST CXNTURY Odium', 'Interworld'],
    STEALTH: ['DVRST Close Eyes', 'Interworld Metamorphosis', 'Kaito Shoma', 'Hensonn Sahara'],
    COMBAT: ['Kordhell Murder In My Mind', 'PlayaPhonk Phonky Town', 'MoonDeity Wake Up', 'Shadxwbxrn'],
    BOSSFIGHT: ['Kordhell Live Another Day', 'Ghostface Playa Why Not', 'raze', 'Dxrk ダーク RAVE'],
    VICTORY: ['DVRST Close Eyes', 'LXST CXNTURY'],
  },
  electronic: {
    EXPLORE: ['Kavinsky Nightcall', 'Daft Punk Veridis Quo', 'M83 Midnight City', 'Aphex Twin Xtal', 'Burial Archangel'],
    STEALTH: ['Crystal Castles Kerosene', 'Gesaffelstein Aleph', 'Massive Attack Angel', 'Portishead Roads'],
    COMBAT: ['The Prodigy Omen', 'Pendulum Propane Nightmares', 'Gesaffelstein Pursuit', 'Justice Stress'],
    BOSSFIGHT: ['The Prodigy Breathe', 'Carpenter Brut Turbo Killer', 'Pendulum Watercolour', 'Perturbator Future Club'],
    VICTORY: ['Daft Punk Instant Crush', 'Gorillaz Feel Good Inc', 'The Weeknd Blinding Lights'],
  },
  indie: {
    EXPLORE: ['Tame Impala Let It Happen', 'Mac DeMarco Chamber of Reflection', 'The Neighbourhood Sweater Weather', 'Gorillaz Melancholy Hill', 'Cigarettes After Sex'],
    STEALTH: ['Radiohead Everything In Its Right Place', 'Massive Attack Teardrop', 'Beach House Space Song', 'Alt-J'],
    COMBAT: ['Franz Ferdinand Take Me Out', 'Arctic Monkeys Brianstorm', 'The Strokes Reptilia', 'Kasabian Club Foot'],
    BOSSFIGHT: ['Muse Knights of Cydonia', 'The White Stripes Seven Nation Army', 'Yeah Yeah Yeahs Heads Will Roll'],
    VICTORY: ['M83 Midnight City', 'Tame Impala The Less I Know The Better', 'MGMT Little Dark Age'],
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
  const userHint = searchParams.get('hint') || '';
  const genresParam = searchParams.get('genres') || '';
  const artistsParam = searchParams.get('artists') || '';
  const langPref = searchParams.get('lang') || 'all';
  const vocalPref = searchParams.get('vocal') || 'mixed';

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

    // 2. Manual Hint Override
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
            resolvedMoodQuery: `По запросу: ${userHint.trim()}`,
            tracks: tracks.sort(() => Math.random() - 0.5),
          });
        }
      }
    }

    // 3. Autonomous Discovery Tailored to User Account Taste Profile (Genres + Favorite Artists + Scene)
    const selectedGenres = genresParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const selectedArtists = artistsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const candidateSeeds: string[] = [];

    // Add pools from user's chosen genres (or all genres if none selected yet)
    const activeGenreKeys =
      selectedGenres.length > 0 ? selectedGenres : Object.keys(GENRE_SCENE_ARTISTS);

    for (const gKey of activeGenreKeys) {
      const gPool = GENRE_SCENE_ARTISTS[gKey]?.[vibe];
      if (gPool) {
        candidateSeeds.push(...gPool);
      }
    }

    // Add user's favorite artists adapted to the current scene
    if (selectedArtists.length > 0) {
      const sampledUserArtists = pickRandomItems(selectedArtists, 4);
      for (const art of sampledUserArtists) {
        candidateSeeds.push(art);
      }
    }

    if (langPref === 'ru') {
      candidateSeeds.push('Кино', 'Скриптонит', 'Miyagi', 'PHARAOH', 'Big Baby Tape', 'Король и Шут', 'Три дня дождя');
    }

    const chosenQueries = pickRandomItems(Array.from(new Set(candidateSeeds)), 6);

    const artistResponses = await Promise.all(
      chosenQueries.map(async (qTerm) => {
        try {
          const finalTerm =
            vocalPref === 'instrumental' ? `${qTerm} instrumental` : qTerm;
          const offset = Math.floor(Math.random() * 4);
          const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
            finalTerm
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

      const labelSummary =
        selectedGenres.length > 0 || selectedArtists.length > 0
          ? `По твоим вкусам (${chosenQueries.slice(0, 3).join(', ')})`
          : `Автономный поток под игру (${chosenQueries.slice(0, 3).join(', ')})`;

      return NextResponse.json({
        source: 'autopilot-dynamic',
        vibe,
        resolvedMoodQuery: labelSummary,
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
