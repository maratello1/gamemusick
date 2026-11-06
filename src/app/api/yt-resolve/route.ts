import { NextRequest, NextResponse } from 'next/server';
import { searchYouTubeDirect } from '@/lib/youtubeSearch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const artist = searchParams.get('artist') || '';
  const title = searchParams.get('title') || '';

  const cleanQuery = `${artist} ${title}`.trim() || q.trim();
  if (!cleanQuery) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  try {
    const searchTarget = `${cleanQuery} official audio`;
    const tracks = await searchYouTubeDirect(searchTarget, 'EXPLORE', 3);

    if (tracks.length > 0 && tracks[0].videoId) {
      return NextResponse.json({
        videoId: tracks[0].videoId,
        title: tracks[0].title,
        artist: tracks[0].artist,
        duration: tracks[0].duration,
        thumbnail: tracks[0].thumbnail,
        source: 'youtube-direct',
      });
    }

    // Secondary fallback without "official audio"
    const fallbackTracks = await searchYouTubeDirect(cleanQuery, 'EXPLORE', 3);
    if (fallbackTracks.length > 0 && fallbackTracks[0].videoId) {
      return NextResponse.json({
        videoId: fallbackTracks[0].videoId,
        title: fallbackTracks[0].title,
        artist: fallbackTracks[0].artist,
        duration: fallbackTracks[0].duration,
        thumbnail: fallbackTracks[0].thumbnail,
        source: 'youtube-direct-fallback',
      });
    }

    return NextResponse.json({ error: 'No video found' }, { status: 404 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
