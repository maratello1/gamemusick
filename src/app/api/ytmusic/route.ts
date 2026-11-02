import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_PRESETS, VIBE_STATES } from '@/lib/defaultData';
import { TrackItem, VibeStateId } from '@/types/vibe';

export const dynamic = 'force-dynamic';

/**
 * Queries YouTube / YouTube Music InnerTube API without requiring any API key or subscription.
 */
async function searchInnerTube(query: string, vibe: VibeStateId): Promise<TrackItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3800);

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
        query: `${query} music`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`InnerTube HTTP ${response.status}`);
    }

    const data = await response.json();
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    const results: TrackItem[] = [];

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const video = item?.videoRenderer;
        if (!video || !video.videoId) continue;

        const videoId: string = video.videoId;
        const title: string =
          video.title?.runs?.[0]?.text || video.title?.simpleText || 'Unknown Track';
        const artist: string =
          video.ownerText?.runs?.[0]?.text ||
          video.longBylineText?.runs?.[0]?.text ||
          'YouTube Music Artist';
        const duration: string =
          video.lengthText?.simpleText ||
          (video.badges?.some((b: { metadataBadgeRenderer?: { style?: string } }) =>
            b?.metadataBadgeRenderer?.style?.includes('LIVE')
          )
            ? 'LIVE'
            : '03:45');

        results.push({
          videoId,
          title,
          artist,
          duration,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          vibe,
          genreTag: VIBE_STATES[vibe]?.shortLabel || 'Adaptive',
          source: 'ytmusic',
        });

        if (results.length >= 6) break;
      }
      if (results.length >= 6) break;
    }

    return results;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || 'dark synthwave cyberpunk gaming mix';
  const vibe = (searchParams.get('vibe') as VibeStateId) || 'EXPLORE';

  const liveTracks = await searchInnerTube(query, vibe);

  if (liveTracks.length > 0) {
    return NextResponse.json({
      source: 'innertube-live',
      query,
      vibe,
      tracks: liveTracks,
    });
  }

  // Fallback to curated verified streams if offline
  const fallbackPool = INITIAL_PRESETS.flatMap((p) => p.curatedTracks[vibe] || []);
  return NextResponse.json({
    source: 'curated-fallback',
    query,
    vibe,
    tracks: fallbackPool.length > 0 ? fallbackPool : INITIAL_PRESETS[0].curatedTracks.EXPLORE,
  });
}
