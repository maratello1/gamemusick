import { NextRequest, NextResponse } from 'next/server';
import { TrackItem, VibeStateId } from '@/types/vibe';
import { searchYouTubeDirect } from '@/lib/youtubeSearch';
import {
  buildSemanticTrackQueries,
  getSceneTaxonomy,
  mapSceneTagToLegacyVibe,
} from '@/lib/scene-engine';

export const dynamic = 'force-dynamic';

// Clean dynamic track router (supports continuous SceneVector + custom artists)

function formatDurationMs(ms?: number): string {
  if (!ms || ms <= 0) return '03:40';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

import { getNeuralBrainState } from '@/lib/neural-evolution';

function interleaveBatches<T>(batches: T[][]): T[] {
  const maxLen = batches.reduce((m, b) => Math.max(m, b.length), 0);
  const result: T[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const batch of batches) {
      if (i < batch.length) result.push(batch[i]);
    }
  }
  return result;
}

function filterAndDeduplicateTracks(tracks: TrackItem[], excludeIdsParam: string[]): TrackItem[] {
  let disliked: string[] = [];
  try {
    disliked = getNeuralBrainState().dislikedTrackIds || [];
  } catch {
    // ignore
  }
  const excluded = new Set([...disliked, ...excludeIdsParam].filter(Boolean));
  const seenKeys = new Set<string>();
  const out: TrackItem[] = [];
  for (const t of tracks) {
    if (!t || !t.title) continue;
    if (excluded.has(t.id) || (t.videoId && excluded.has(t.videoId))) continue;
    const key = `${t.artist.toLowerCase().trim()}::${t.title.toLowerCase().trim()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    out.push(t);
  }
  return out;
}

// Procedural Atmosphere Archetypes: Infinite dynamic variety, ZERO hardcoded fixed song lists!
interface AtmosphereArchetype {
  name: string;
  artists: string[];
  descriptors: Record<VibeStateId, string[]>;
}

const ATMOSPHERE_ARCHETYPES: Record<string, AtmosphereArchetype> = {
  gothic: {
    name: 'Gothic & Dark Fantasy',
    artists: [
      'Michiru Yamane',
      'Christopher Larkin',
      'Bohren & der Club of Gore',
      'Atrium Carceri',
      'Lustmord',
      'Wojciech Kilar',
      'Peter Gundry',
      'Adrian von Ziegler',
      'Trevor Morris',
      'Castlevania Sound Team',
      'Motoi Sakuraba',
      'Borislav Slavov',
    ],
    descriptors: {
      EXPLORE: [
        'dungeon synth dark ambient',
        'dark gothic ambient exploration',
        'dark fantasy soundtrack atmospheric',
        'neoclassical dark cathedral organ',
      ],
      MAJESTIC: [
        'gothic choir majestic triumph',
        'epic dark fantasy crescendo choir',
        'sacred organ triumph orchestra',
      ],
      DRAMA: [
        'dark cello tragedy sorrow',
        'requiem strings dark ambient',
        'melancholic gothic piano',
      ],
      STEALTH: [
        'dark ambient drone crypt',
        'subtle suspense dungeon synth',
        'shadow infiltration dark tension',
      ],
      COMBAT: [
        'gothic battle orchestral action',
        'dark symphonic combat choir',
        'epic organ battle furious',
      ],
      BOSSFIGHT: [
        'epic dark choir boss fight',
        'gothic boss battle orchestral',
        'furious symphonic climax boss',
      ],
      VICTORY: [
        'gothic cathedral bells victory triumph',
        'dark fantasy triumph orchestra',
      ],
    },
  },
  scifi: {
    name: 'Sci-Fi, Choral & Cyberpunk',
    artists: [
      'Keiichi Okabe',
      'Brian Eno',
      'Sigur Ros',
      'M83',
      'Max Richter',
      'Olafur Arnalds',
      'Hammock',
      'Carbon Based Lifeforms',
      'Solar Fields',
      'Trent Reznor',
      'Cliff Martinez',
      'Vangelis',
      'Hans Zimmer',
    ],
    descriptors: {
      EXPLORE: [
        'ethereal sci-fi ambient space',
        'ambient electronic cyberpunk drone',
        'peaceful ruins ambient piano',
      ],
      MAJESTIC: [
        'epic choral post rock space',
        'ethereal choir crescendo vista',
        'celestial orchestra majestic',
      ],
      DRAMA: [
        'melancholic piano string orchestra',
        'sorrowful ethereal vocal ambient',
        'sad cello post-rock',
      ],
      STEALTH: [
        'dark cyber synth drone',
        'minimalist suspense electronic tension',
      ],
      COMBAT: [
        'cyberpunk dark battle synth action',
        'epic choral combat soundtrack',
      ],
      BOSSFIGHT: [
        'colossal boss synth choir battle',
        'heavy electronic battle crescendo',
      ],
      VICTORY: [
        'celestial choir triumph space',
        'post-rock euphoric crescendo',
      ],
    },
  },
  competitive_fps: {
    name: 'Competitive FPS & Drift Phonk',
    artists: [
      'Kordhell',
      'DVRST',
      'Ghostface Playa',
      'Interworld',
      'Hensonn',
      'Pharmacist',
      'SXMPRA',
      'Pendulum',
      'The Prodigy',
      'Carpenter Brut',
      'Sub Focus',
      'Lorn',
      'Skeler',
    ],
    descriptors: {
      EXPLORE: [
        'drift phonk gaming workout chill',
        'wave phonk atmospheric night drive',
        'dnb liquid atmospheric gaming chill',
        'competitive cs2 warmup beats',
      ],
      MAJESTIC: [
        'epic electronic triumph crescendo',
        'cyberpunk stadium triumph synthwave',
        'drum and bass euphoric drop',
      ],
      DRAMA: [
        'sad wave phonk slow reverb',
        'chill lo fi gaming respawn beat',
        'melancholic synthwave night rain',
        'calm downtime esports lofi',
      ],
      STEALTH: [
        'dark wave phonk bass tension',
        'deep dark dubstep suspense',
        'esports clutch tension drone',
      ],
      COMBAT: [
        'aggressive drift phonk combat action',
        'high energy phonk gym gaming',
        'intense drum and bass combat drop',
        'hardstyle phonk battle adrenaline',
      ],
      BOSSFIGHT: [
        'ultimate drift phonk boss fight bass boosted',
        'monumental phonk rage combat',
        'heavy bass neurofunk dnb drop',
      ],
      VICTORY: [
        'phonk victory celebration triumph',
        'epic synthwave championship victory',
      ],
    },
  },
  moba: {
    name: 'MOBA & Tactical Esports',
    artists: [
      'The Glitch Mob',
      'Pendulum',
      'The Prodigy',
      'Two Steps From Hell',
      'Hans Zimmer',
      'Celldweller',
      'Kordhell',
      'DVRST',
      'Mick Gordon',
    ],
    descriptors: {
      EXPLORE: [
        'relaxing laning phase electronic beats',
        'chill lofi dota farming beats',
        'atmospheric synth ambient focus',
      ],
      MAJESTIC: [
        'epic victory horn orchestra',
        'cinematic brass crescendo triumph',
      ],
      DRAMA: [
        'melancholic esports downtime respawn',
        'calm lofi waiting for respawn',
        'sad ambient death screen chill',
      ],
      STEALTH: [
        'gank tension suspense electronic',
        'roaming fog of war stealth synth',
      ],
      COMBAT: [
        'teamfight high energy electronic combat',
        'epic hybrid orchestral teamfight',
        'furious bass battle rush',
      ],
      BOSSFIGHT: [
        'roshan baron colossal battle hybrid',
        'intense base defense clutch climax',
      ],
      VICTORY: [
        'gg victory anthem electronic',
        'stadium triumph fanfare esports',
      ],
    },
  },
  fantasy: {
    name: 'Epic Fantasy & Medieval RPG',
    artists: [
      'Marcin Przybylowicz',
      'Percival Schuttenbach',
      'Jeremy Soule',
      'Yuka Kitamura',
      'Borislav Slavov',
      'Gareth Coker',
      'Austin Wintory',
      'Inon Zur',
      'Two Steps From Hell',
    ],
    descriptors: {
      EXPLORE: [
        'medieval tavern lute ambient exploration',
        'ancient forest ambient strings fantasy',
        'peaceful fantasy valley exploration',
      ],
      MAJESTIC: [
        'nordic horns mountain vista triumph',
        'epic fantasy mountain panorama orchestra',
      ],
      DRAMA: [
        'sorrowful medieval viola cello',
        'sad fantasy violin tragedy',
      ],
      STEALTH: [
        'dark dungeon footsteps ambient',
        'shadowy crypt tension fantasy',
      ],
      COMBAT: [
        'furious pagan sword battle drums',
        'epic fantasy combat orchestra',
      ],
      BOSSFIGHT: [
        'colossal mythical beast battle choir',
        'epic dark souls style boss battle',
      ],
      VICTORY: [
        'triumphant kingdom fanfare brass',
        'victory bard song fantasy',
      ],
    },
  },
  universal: {
    name: 'Atmospheric Cinematic & Ambient',
    artists: [
      'Brian Eno',
      'Max Richter',
      'Hans Zimmer',
      'Ludovico Einaudi',
      'C418',
      'Christopher Larkin',
      'Disasterpeace',
      'Lena Raine',
    ],
    descriptors: {
      EXPLORE: [
        'relaxing game ambient soundtrack',
        'peaceful atmospheric exploration music',
        'lofi game ambient background',
      ],
      MAJESTIC: [
        'cinematic mountain panorama vista',
        'epic orchestral triumph hope',
      ],
      DRAMA: [
        'cinematic emotional piano tragedy',
        'sorrowful cello melancholic',
      ],
      STEALTH: [
        'minimalist dark drone suspense',
        'ambient tension heartbeat',
      ],
      COMBAT: [
        'adrenaline battle soundtrack intense',
        'driving action orchestral score',
      ],
      BOSSFIGHT: [
        'monumental boss theme orchestral',
        'epic dramatic battle climax',
      ],
      VICTORY: [
        'triumphant ending theme soundtrack',
      ],
    },
  },
};

const GENRE_DYNAMIC_ARTISTS: Record<string, string[]> = {
  rock: ['Deftones', 'Arctic Monkeys', 'Radiohead', 'Nirvana', 'Queens of the Stone Age', 'The Strokes'],
  metal: ['System Of A Down', 'Slipknot', 'Rammstein', 'Metallica', 'Bring Me The Horizon', 'Korn'],
  phonk: ['DVRST', 'Kordhell', 'LXST CXNTURY', 'Skeler', 'Interworld', 'MoonDeity'],
  electronic: ['Daft Punk', 'Kavinsky', 'M83', 'The Prodigy', 'Pendulum', 'Aphex Twin', 'Carpenter Brut'],
  indie: ['Tame Impala', 'Beach House', 'Mac DeMarco', 'The Neighbourhood', 'Lord Huron'],
  ambient: ['Brian Eno', 'Max Richter', 'Hammock', 'Ludovico Einaudi', 'C418', 'Carbon Based Lifeforms'],
};

function pickRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function cleanGameName(raw: string): string {
  return raw
    .replace(/\.exe$/i, '')
    .replace(/_/g, ' ')
    .replace(/dota2/i, 'Dota 2')
    .replace(/cs2/i, 'Counter Strike 2')
    .replace(/witcher3/i, 'The Witcher 3')
    .replace(/cyberpunk2077/i, 'Cyberpunk 2077')
    .replace(/eldenring/i, 'Elden Ring')
    .replace(/hollowknight/i, 'Hollow Knight')
    .replace(/hades2/i, 'Hades 2')
    .trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'autopilot';
  const sceneTag = searchParams.get('sceneTag') || '';
  const musicBrief = searchParams.get('musicBrief') || '';
  const energyParam = Number(searchParams.get('energy'));
  const tensionParam = Number(searchParams.get('tension'));
  const valenceParam = Number(searchParams.get('valence'));
  const excludeIdsParam = (searchParams.get('excludeIds') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const query = searchParams.get('q') || '';
  const vibe = (searchParams.get('vibe') as VibeStateId) || 'EXPLORE';
  const userHint = searchParams.get('hint') || '';
  const genresParam = searchParams.get('genres') || '';
  const artistsParam = searchParams.get('artists') || '';
  const audioMode = searchParams.get('audioMode') || 'game-vibe';
  const rawGameParam = searchParams.get('game') || '';
  const gameClean = cleanGameName(rawGameParam);

  try {
    // 1. Direct Search (User typed in search bar) -> Directly query YouTube!
    if (mode === 'search' && query.trim().length > 0) {
      const ytTracks = await searchYouTubeDirect(query.trim(), vibe, 20);
      if (ytTracks.length > 0) {
        return NextResponse.json({
          source: 'youtube-search',
          query: query.trim(),
          vibe,
          tracks: ytTracks,
        });
      }
    }

    // 2. Manual Hint Override
    if (userHint.trim().length > 0) {
      const ytTracks = await searchYouTubeDirect(userHint.trim(), vibe, 15);
      if (ytTracks.length > 0) {
        return NextResponse.json({
          source: 'autopilot-hint',
          vibe,
          resolvedMoodQuery: `Поиск: ${userHint.trim()}`,
          tracks: ytTracks,
        });
      }
    }

    // 3. Vision Director picks
    const picksParam = searchParams.get('picks');
    if (mode === 'director' && picksParam) {
      let picks: { artist: string; title: string }[] = [];
      try {
        const parsedPicks = JSON.parse(picksParam);
        if (Array.isArray(parsedPicks)) {
          picks = parsedPicks
            .filter((p) => p && typeof p.artist === 'string' && typeof p.title === 'string')
            .slice(0, 5);
        }
      } catch {
        picks = [];
      }

      if (picks.length > 0) {
        const verifiedYt = await Promise.all(
          picks.map(async (pick) => {
            const q = `${pick.artist} ${pick.title} official audio`;
            const results = await searchYouTubeDirect(q, vibe, 1);
            return results.length > 0 ? results[0] : null;
          })
        );

        const validTracks = verifiedYt.filter((t): t is TrackItem => t !== null);
        if (validTracks.length > 0) {
          return NextResponse.json({
            source: 'vision-director',
            vibe,
            resolvedMoodQuery: `🎬 Режиссёр: ${validTracks[0].artist} — ${validTracks[0].title}`,
            tracks: validTracks,
          });
        }
      }
    }

    // 4. Dynamic Procedural Discovery Engine (100% Free YouTube Streams, Zero Fixed Songs!)
    const ytQueries: string[] = [];
    let archetypeLabel = 'Атмосферный саундтрек';

    const gameLower = (gameClean || rawGameParam).toLowerCase();
    const isGameActive = gameClean && !gameClean.includes('Ожидание игры') && gameClean.length > 1;

    // Strict priority: If user chose "Мои артисты" (custom), ALWAYS honor user taste!
    if (audioMode === 'custom' && sceneTag) {
      const selectedArtistsList = artistsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const selectedGenresList = genresParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const customSemanticSeeds = buildSemanticTrackQueries({
        audioMode: 'custom',
        sceneTag,
        energy: Number.isFinite(energyParam) ? energyParam : getSceneTaxonomy(sceneTag).energy,
        tension: Number.isFinite(tensionParam) ? tensionParam : getSceneTaxonomy(sceneTag).tension,
        valence: Number.isFinite(valenceParam) ? valenceParam : getSceneTaxonomy(sceneTag).valence,
        musicBrief,
        artists: selectedArtistsList,
        genres: selectedGenresList,
        vocalPref: searchParams.get('vocal') || 'mixed',
        languagePref: searchParams.get('lang') || 'all',
      });
      if (customSemanticSeeds.length > 0) {
        const fetched = await Promise.all(
          customSemanticSeeds.slice(0, 4).map((s) => searchYouTubeDirect(s, vibe, 8))
        );
        const merged = filterAndDeduplicateTracks(interleaveBatches(fetched), excludeIdsParam);
        if (merged.length > 0) {
          const tax = getSceneTaxonomy(sceneTag);
          const label = `${tax.nameRu} (${selectedArtistsList.slice(0, 2).join(', ') || 'Мои артисты'})`;
          return NextResponse.json({
            ok: true,
            mode: 'semantic-custom',
            sceneTag,
            vibe,
            resolvedQuery: label,
            resolvedMoodQuery: label,
            tracks: merged.slice(0, 20),
          });
        }
      }
    }

    if (audioMode === 'custom') {
      const selectedArtists = artistsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const selectedGenres = genresParam
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      archetypeLabel = 'Персональный вкус';

      if (selectedArtists.length > 0) {
        for (const a of selectedArtists) {
          if (vibe === 'COMBAT' || vibe === 'BOSSFIGHT') {
            ytQueries.push(`${a} high energy live`);
            ytQueries.push(`${a} battle heavy`);
          } else if (vibe === 'DRAMA') {
            ytQueries.push(`${a} slow acoustic`);
            ytQueries.push(`${a} melancholic`);
          } else if (vibe === 'STEALTH') {
            ytQueries.push(`${a} dark instrumental`);
          } else if (vibe === 'MAJESTIC' || vibe === 'VICTORY') {
            ytQueries.push(`${a} greatest hits live`);
          } else {
            ytQueries.push(`${a} official audio`);
            ytQueries.push(`${a} chill`);
          }
        }
      }

      const activeGenres =
        selectedGenres.length > 0
          ? selectedGenres
          : selectedArtists.length === 0
          ? ['electronic', 'rock', 'ambient']
          : [];

      for (const g of activeGenres) {
        const pool = GENRE_DYNAMIC_ARTISTS[g];
        if (pool && pool.length > 0) {
          const sample = pickRandomItems(pool, 2);
          for (const a of sample) {
            if (vibe === 'COMBAT' || vibe === 'BOSSFIGHT') {
              ytQueries.push(`${a} high energy`);
            } else {
              ytQueries.push(`${a} official audio`);
            }
          }
        } else {
          if (vibe === 'COMBAT' || vibe === 'BOSSFIGHT') {
            ytQueries.push(`${g} high energy battle`);
          } else {
            ytQueries.push(`${g} chill atmospheric`);
          }
        }
      }
    } else {
      if (audioMode !== 'custom' && (sceneTag || musicBrief)) {
      const tax = getSceneTaxonomy(sceneTag || 'explore_wander');
      const semanticQueries = buildSemanticTrackQueries({
        audioMode: 'game-vibe',
        sceneTag: sceneTag || tax.tag,
        energy: Number.isFinite(energyParam) ? energyParam : tax.energy,
        tension: Number.isFinite(tensionParam) ? tensionParam : tax.tension,
        valence: Number.isFinite(valenceParam) ? valenceParam : tax.valence,
        musicBrief,
        artists: artistsParam.split(',').map((s) => s.trim()).filter(Boolean),
        genres: genresParam.split(',').map((s) => s.trim()).filter(Boolean),
        gameTitle: rawGameParam,
        vocalPref: searchParams.get('vocal') || 'mixed',
        languagePref: searchParams.get('lang') || 'all',
      });
      if (semanticQueries.length > 0) {
        const fetched = await Promise.all(
          semanticQueries.slice(0, 3).map((qStr) => searchYouTubeDirect(qStr, vibe, 8))
        );
        const merged = filterAndDeduplicateTracks(interleaveBatches(fetched), excludeIdsParam);
        if (merged.length >= 3) {
          const label = `${tax.nameRu} · ${rawGameParam && rawGameParam !== 'Ожидание игры' ? rawGameParam : musicBrief || tax.shortRu}`;
          return NextResponse.json({
            ok: true,
            mode: 'semantic-game-vibe',
            sceneTag: sceneTag || tax.tag,
            vibe: mapSceneTagToLegacyVibe(
              sceneTag || tax.tag,
              Number.isFinite(energyParam) ? energyParam : tax.energy,
              Number.isFinite(tensionParam) ? tensionParam : tax.tension,
              Number.isFinite(valenceParam) ? valenceParam : tax.valence
            ),
            resolvedQuery: label,
            resolvedMoodQuery: label,
            tracks: merged.slice(0, 20),
          });
        }
      }
    }

    // audioMode === 'game-vibe': Procedural Game Soundtrack Discovery
      let archetypeKey = 'universal';

      if (
        gameLower.includes('castlevania') ||
        gameLower.includes('belmont') ||
        gameLower.includes('vampire') ||
        gameLower.includes('curse') ||
        gameLower.includes('hollow') ||
        gameLower.includes('blasphemous')
      ) {
        archetypeKey = 'gothic';
      } else if (
        gameLower.includes('nier') ||
        gameLower.includes('cyberpunk') ||
        gameLower.includes('deus') ||
        gameLower.includes('system')
      ) {
        archetypeKey = 'scifi';
      } else if (
        gameLower.includes('cs2') ||
        gameLower.includes('csgo') ||
        gameLower.includes('counter') ||
        gameLower.includes('valorant') ||
        gameLower.includes('rainbow') ||
        gameLower.includes('r6') ||
        gameLower.includes('apex') ||
        gameLower.includes('pubg') ||
        gameLower.includes('tslgame') ||
        gameLower.includes('fortnite') ||
        gameLower.includes('overwatch') ||
        gameLower.includes('marvelrivals') ||
        gameLower.includes('warzone') ||
        gameLower.includes('crossfire')
      ) {
        archetypeKey = 'competitive_fps';
      } else if (
        gameLower.includes('dota') ||
        gameLower.includes('league') ||
        gameLower.includes('deadlock') ||
        gameLower.includes('smite')
      ) {
        archetypeKey = 'moba';
      } else if (
        gameLower.includes('souls') ||
        gameLower.includes('elden') ||
        gameLower.includes('bloodborne') ||
        gameLower.includes('witcher') ||
        gameLower.includes('skyrim')
      ) {
        archetypeKey = 'fantasy';
      }

      const arch = ATMOSPHERE_ARCHETYPES[archetypeKey] || ATMOSPHERE_ARCHETYPES.universal;
      archetypeLabel = arch.name;

      // If active game is known, anchor searches around this real game world!
      if (isGameActive && archetypeKey === 'competitive_fps') {
        if (vibe === 'COMBAT' || vibe === 'BOSSFIGHT') {
          ytQueries.push('aggressive drift phonk gym battle bass');
          ytQueries.push('intense phonk combat gaming adrenaline');
          ytQueries.push(`${gameClean} phonk montage workout`);
        } else if (vibe === 'DRAMA') {
          ytQueries.push('sad wave phonk slow reverb');
          ytQueries.push('lofi gaming beats respawn chill');
          ytQueries.push('calm synthwave downtime chill');
        } else if (vibe === 'STEALTH') {
          ytQueries.push('dark wave phonk clutch tension bass');
          ytQueries.push('deep dark electronic clutch suspense');
        } else if (vibe === 'MAJESTIC' || vibe === 'VICTORY') {
          ytQueries.push('phonk victory triumph celebration');
          ytQueries.push('epic electronic stadium victory drops');
        } else {
          ytQueries.push('drift phonk gaming warmup chill');
          ytQueries.push('wave phonk atmospheric night drive');
          ytQueries.push('liquid dnb chill gaming');
        }
      } else if (isGameActive && archetypeKey === 'moba') {
        if (vibe === 'COMBAT' || vibe === 'BOSSFIGHT') {
          ytQueries.push('high energy electronic teamfight battle');
          ytQueries.push('epic hybrid orchestral teamfight');
        } else if (vibe === 'DRAMA') {
          ytQueries.push('calm lofi waiting for respawn beats');
          ytQueries.push('melancholic esports downtime chill');
        } else if (vibe === 'STEALTH') {
          ytQueries.push('gank tension electronic stealth drone');
        } else if (vibe === 'VICTORY') {
          ytQueries.push('gg victory anthem electronic esports');
        } else {
          ytQueries.push('relaxing laning phase electronic beats');
          ytQueries.push('chill lofi gaming farming focus');
        }
      } else if (isGameActive) {
        if (vibe === 'COMBAT' || vibe === 'BOSSFIGHT') {
          ytQueries.push(`${gameClean} combat battle action soundtrack ost`);
          ytQueries.push(`${gameClean} epic boss fight theme ost`);
        } else if (vibe === 'MAJESTIC') {
          ytQueries.push(`${gameClean} majestic vista orchestral choir soundtrack`);
          ytQueries.push(`${gameClean} beautiful emotional ost`);
        } else if (vibe === 'DRAMA') {
          ytQueries.push(`${gameClean} sad sorrowful dramatic soundtrack ost`);
        } else if (vibe === 'STEALTH') {
          ytQueries.push(`${gameClean} stealth suspense dark ambient soundtrack`);
        } else {
          // EXPLORE (Atmospheric Ambient)
          ytQueries.push(`${gameClean} ambient exploration soundtrack`);
          ytQueries.push(`${gameClean} relaxing atmospheric ost`);
          ytQueries.push(`${gameClean} background music ambient`);
        }
      }

      // Mix in archetype composers & atmospheric descriptors
      const chosenArtists = pickRandomItems(arch.artists, 2);
      for (const artist of chosenArtists) {
        ytQueries.push(`${artist} ${vibe.toLowerCase()} ambient soundtrack`);
      }

      const vibeDescs = arch.descriptors[vibe] || arch.descriptors.EXPLORE;
      const chosenDescs = pickRandomItems(vibeDescs, 2);
      for (const desc of chosenDescs) {
        ytQueries.push(`${desc} soundtrack`);
      }
    }

    if (ytQueries.length === 0) {
      ytQueries.push('Castlevania ambient exploration soundtrack');
      ytQueries.push('Dark fantasy atmospheric ambient music');
    }

    // Select 2 diverse search queries to query in parallel
    const selectedSeeds = pickRandomItems(Array.from(new Set(ytQueries)), 2);

    const searchResponses = await Promise.all(
      selectedSeeds.map(async (seed) => {
        return await searchYouTubeDirect(seed, vibe, 10);
      })
    );

    const flatTracks = searchResponses.flat();

    // Deduplicate by videoId
    const seenIds = new Set<string>();
    const uniqueTracks: TrackItem[] = [];
    for (const t of flatTracks) {
      if (t.videoId && !seenIds.has(t.videoId)) {
        seenIds.add(t.videoId);
        uniqueTracks.push(t);
      }
    }

    // Shuffle for variety
    const randomized = filterAndDeduplicateTracks(
      [...uniqueTracks].sort(() => Math.random() - 0.5),
      excludeIdsParam
    );

    if (randomized.length > 0) {
      const displayLabel =
        audioMode === 'custom'
          ? `🎧 Мои артисты & Вкусы [${vibe}]`
          : isGameActive
          ? `✨ Саундтрек: ${gameClean} [${vibe}]`
          : `✨ ${archetypeLabel}: Живой поток [${vibe}]`;

      return NextResponse.json({
        source: 'youtube-direct',
        vibe,
        resolvedMoodQuery: displayLabel,
        tracks: randomized.slice(0, 20),
      });
    }
  } catch (err) {
    console.error('[ytmusic API Error]', err);
  }

  return NextResponse.json({
    source: 'fallback',
    vibe,
    resolvedMoodQuery: 'Атмосферный саундтрек',
    tracks: [],
  });
}
