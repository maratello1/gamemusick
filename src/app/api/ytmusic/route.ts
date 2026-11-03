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

async function fetchSingleSeedTrack(
  seedQuery: string,
  vibe: VibeStateId
): Promise<TrackItem | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      seedQuery
    )}&media=music&entity=song&limit=1`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const itunesRes = await res.json();
    const item = itunesRes?.results?.[0];
    if (item) {
      const hiResArt = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : 'https://i.ytimg.com/vi/sTPn4Jlrjb0/hqdefault.jpg';

      return {
        id: String(item.trackId || `${seedQuery}-${Date.now()}`),
        videoId: String(item.trackId || 'sTPn4Jlrjb0'),
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

async function searchMultipleTracks(
  query: string,
  defaultVibe: VibeStateId
): Promise<TrackItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      query
    )}&media=music&entity=song&limit=18`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    return results.map((item: Record<string, unknown>, idx: number) => {
      const art100 = typeof item.artworkUrl100 === 'string' ? item.artworkUrl100 : '';
      const hiResArt = art100
        ? art100.replace('100x100bb', '600x600bb')
        : 'https://i.ytimg.com/vi/sTPn4Jlrjb0/hqdefault.jpg';

      return {
        id: String(item.trackId || `search-${idx}-${Date.now()}`),
        videoId: String(item.trackId || 'sTPn4Jlrjb0'),
        title: String(item.trackName || query),
        artist: String(item.artistName || 'Artist'),
        album: String(item.collectionName || 'Single'),
        duration: formatDurationMs(typeof item.trackTimeMillis === 'number' ? item.trackTimeMillis : 200000),
        thumbnail: hiResArt,
        previewUrl: typeof item.previewUrl === 'string' ? item.previewUrl : undefined,
        vibe: defaultVibe,
        genreTag: String(item.primaryGenreName || 'Music'),
      };
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const query = searchParams.get('q');
  const vibe = (searchParams.get('vibe') as VibeStateId) || 'EXPLORE';
  const packId = (searchParams.get('pack') as GenrePackId) || 'mix';

  if (mode === 'search' && query && query.trim().length > 0) {
    const found = await searchMultipleTracks(query.trim(), vibe);
    return NextResponse.json({
      source: 'itunes-search',
      query,
      tracks: found,
    });
  }

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
