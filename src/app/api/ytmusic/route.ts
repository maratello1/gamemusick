import { NextRequest, NextResponse } from 'next/server';
import { FALLBACK_REAL_TRACKS, GENRE_PACKS, GenrePackId } from '@/lib/defaultData';
import { TrackItem, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

function formatDurationMs(ms?: number): string {
  if (!ms || ms <= 0) return '03:20';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function resolveYoutubeVideoId(searchQuery: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2400);

    const response = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240725.01.00',
            hl: 'ru',
            gl: 'US',
          },
        },
        query: `${searchQuery} official audio`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const data = await response.json();
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents || [];

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const videoId = item?.videoRenderer?.videoId;
        if (videoId) return videoId;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchSingleSeedTrack(
  seedQuery: string,
  vibe: VibeStateId
): Promise<TrackItem | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      seedQuery
    )}&media=music&entity=song&limit=1`;

    const [itunesRes, ytVideoId] = await Promise.all([
      fetch(url, { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
      resolveYoutubeVideoId(seedQuery),
    ]);

    clearTimeout(timeout);

    const item = itunesRes?.results?.[0];
    if (item) {
      const hiResArt = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : `https://i.ytimg.com/vi/${ytVideoId || 'XOzs1FehYOA'}/hqdefault.jpg`;

      return {
        id: String(item.trackId || `${seedQuery}-${Date.now()}`),
        videoId: ytVideoId || 'XOzs1FehYOA',
        title: item.trackName || seedQuery,
        artist: item.artistName || 'Artist',
        album: item.collectionName || 'Single',
        duration: formatDurationMs(item.trackTimeMillis),
        thumbnail: hiResArt,
        previewUrl: item.previewUrl || undefined,
        vibe,
        genreTag: item.primaryGenreName || 'Music',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vibe = (searchParams.get('vibe') as VibeStateId) || 'EXPLORE';
  const packId = (searchParams.get('pack') as GenrePackId) || 'mix';

  const pack = GENRE_PACKS[packId] || GENRE_PACKS.mix;
  const seeds = pack.seedsByVibe[vibe] || pack.seedsByVibe.EXPLORE;

  const seedTracks = await Promise.all(seeds.map((s) => fetchSingleSeedTrack(s, vibe)));
  const validTracks = seedTracks.filter((t): t is TrackItem => t !== null);

  if (validTracks.length > 0) {
    return NextResponse.json({
      source: 'autopilot-live',
      pack: packId,
      vibe,
      tracks: validTracks,
    });
  }

  return NextResponse.json({
    source: 'fallback',
    pack: packId,
    vibe,
    tracks: FALLBACK_REAL_TRACKS,
  });
}
