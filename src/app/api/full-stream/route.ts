import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cachedClientId = '2yeWkbX88QhTzS3OtZp8cLGaJRrOAWwF';

// Strict blacklist for cheap remixes, garage covers, sped up/slowed edits, and tribute bands
const NEGATIVE_TITLE_REGEX =
  /\b(remix|remixed|rmx|slowed|reverb|sped\s*up|speed\s*up|speedup|nightcore|cover|karaoke|tribute|8-?bit|chiptune|bass\s*boost|bassboosted?|hardstyle|techno\s*edit|house\s*edit|dnb\s*edit|drill|type\s*beat|loop|parody|mashup|edit|bootleg|flip|rework|intense|guitar\s*cover|drum\s*cover|acoustic\s*cover|lo-?fi\s*remix|orchestral\s*cover|кавер|минус|ремикс|замедлен|ускорен|басс|на\s*русском|на\s*украинском|трибьют|перевод|караоке)\b/i;

const NEGATIVE_ARTIST_REGEX =
  /\b(tribute|karaoke|cover\s*band|orchestra|in\s*the\s*style\s*of|originally\s*performed\s*by|string\s*quartet|soundtrack\s*band|lo-?fi\s*producer)\b/i;

async function getSoundCloudClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  try {
    const html = await fetch('https://soundcloud.com/discover').then((r) => r.text());
    const scripts = [
      ...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g),
    ].map((m) => m[1]);
    for (const s of scripts.slice(-5)) {
      const js = await fetch(s).then((r) => r.text());
      const m = js.match(/client_id:"([a-zA-Z0-9]{32})"/);
      if (m?.[1]) {
        cachedClientId = m[1];
        return cachedClientId;
      }
    }
  } catch {
    // ignore
  }
  return cachedClientId;
}

interface RankedTrack {
  item: Record<string, unknown>;
  score: number;
}

function scoreCandidate(
  item: Record<string, unknown>,
  expectedArtist: string,
  expectedTitle: string,
  expectedDurSec: number,
  allowInstrumental: boolean
): number {
  const durS = Math.floor((Number(item.duration) || 0) / 1000);
  // Full song length filter (reject 30s clips and 1-hour loops)
  if (durS < 75 || durS > 620) return -9999;

  const tTitle = String(item.title || '');
  const userObj = (item.user as Record<string, unknown>) || {};
  const uName = String(userObj.username || '');
  const isVerified = Boolean(userObj.verified);
  const plays = Number(item.playback_count) || 0;

  let score = 50;

  // Strict penalty for non-original buzzwords
  if (NEGATIVE_TITLE_REGEX.test(tTitle)) {
    score -= 350;
  }
  if (!allowInstrumental && /\binstrumental\b/i.test(tTitle)) {
    score -= 300;
  }
  if (NEGATIVE_ARTIST_REGEX.test(uName)) {
    score -= 400;
  }

  // Official verified artist uploader boost
  if (isVerified) score += 140;

  // Uploader username matches expected artist
  const cleanExpArtist = expectedArtist.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
  const cleanUploader = uName.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
  if (cleanExpArtist.length > 2 && cleanUploader.includes(cleanExpArtist)) {
    score += 120;
  }

  // Clean title match (boost when title contains the song name without extra noise)
  const cleanExpTitle = expectedTitle.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
  const cleanTrackTitle = tTitle.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
  if (cleanExpTitle.length > 2 && cleanTrackTitle.includes(cleanExpTitle)) {
    score += 80;
  }

  // Official studio album duration match
  if (expectedDurSec > 0) {
    const diff = Math.abs(durS - expectedDurSec);
    if (diff <= 8) {
      // Almost exact album cut
      score += 130;
    } else if (diff <= 22) {
      score += 60;
    } else if (diff > 50) {
      score -= 90;
    }
  }

  // Popularity boost (original official releases have millions of plays)
  if (plays > 3000000) score += 60;
  else if (plays > 800000) score += 35;
  else if (plays < 5000 && !isVerified) score -= 40;

  return score;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const expectedArtist = searchParams.get('artist') || '';
  const expectedTitle = searchParams.get('title') || '';
  const expectedDurSec = Number(searchParams.get('dur') || 0);
  const fallbackUrl = searchParams.get('fallback') || '';
  const allowInstrumental = searchParams.get('vocal') === 'instrumental';

  if (!query.trim()) {
    if (fallbackUrl) return NextResponse.redirect(fallbackUrl);
    return new NextResponse('Missing query', { status: 400 });
  }

  try {
    const cid = await getSoundCloudClientId();
    const cleanSearchQuery = `${expectedArtist} ${expectedTitle}`.trim() || query.trim();

    const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
      cleanSearchQuery
    )}&client_id=${cid}&limit=16`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      cachedClientId = '';
      if (fallbackUrl) return NextResponse.redirect(fallbackUrl);
      return new NextResponse('Search failed', { status: 502 });
    }

    const searchData = await searchRes.json();
    const collection: Array<Record<string, unknown>> = Array.isArray(searchData?.collection)
      ? searchData.collection
      : [];

    // Score and rank all candidate tracks to find the TRUE ORIGINAL song
    const ranked: RankedTrack[] = [];
    for (const item of collection) {
      const score = scoreCandidate(
        item,
        expectedArtist,
        expectedTitle,
        expectedDurSec,
        allowInstrumental
      );
      if (score > 0) {
        ranked.push({ item, score });
      }
    }

    ranked.sort((a, b) => b.score - a.score);

    // If no candidate scored well or all were low-quality remixes/covers, fall back to authentic studio master
    if (ranked.length === 0 || ranked[0].score < 40) {
      if (fallbackUrl) {
        return NextResponse.redirect(fallbackUrl);
      }
    }

    const candidatePool = ranked.length > 0 ? ranked.map((r) => r.item) : collection;

    // Pick top scored track that has unencrypted stream
    let chosenTranscoding: { url: string; protocol: string; mime: string } | null = null;

    for (const item of candidatePool) {
      const media = item.media as { transcodings?: Array<Record<string, unknown>> } | undefined;
      const transcodings = Array.isArray(media?.transcodings) ? media!.transcodings : [];

      // 1. Prefer progressive MP3
      const prog = transcodings.find((tr) => {
        const fmt = tr.format as { protocol?: string } | undefined;
        return fmt?.protocol === 'progressive';
      });
      if (prog && typeof prog.url === 'string') {
        chosenTranscoding = {
          url: prog.url,
          protocol: 'progressive',
          mime: 'audio/mpeg',
        };
        break;
      }

      // 2. Fall back to HLS fMP4
      const hlsMp4 = transcodings.find((tr) => {
        const fmt = tr.format as { protocol?: string; mime_type?: string } | undefined;
        return fmt?.protocol === 'hls' && fmt?.mime_type?.startsWith('audio/mp4');
      });
      if (hlsMp4 && typeof hlsMp4.url === 'string') {
        chosenTranscoding = {
          url: hlsMp4.url,
          protocol: 'hls-fmp4',
          mime: 'audio/mp4',
        };
        break;
      }
    }

    if (!chosenTranscoding) {
      if (fallbackUrl) return NextResponse.redirect(fallbackUrl);
      return new NextResponse('No full stream found', { status: 404 });
    }

    const streamInfoRes = await fetch(`${chosenTranscoding.url}?client_id=${cid}`);
    if (!streamInfoRes.ok) {
      if (fallbackUrl) return NextResponse.redirect(fallbackUrl);
      return new NextResponse('Transcoding resolve failed', { status: 502 });
    }

    const streamInfo = await streamInfoRes.json();
    const manifestOrMp3Url = streamInfo?.url;
    if (!manifestOrMp3Url) {
      if (fallbackUrl) return NextResponse.redirect(fallbackUrl);
      return new NextResponse('Empty stream url', { status: 502 });
    }

    if (chosenTranscoding.protocol === 'progressive') {
      return NextResponse.redirect(manifestOrMp3Url);
    }

    // Fetch the HLS fMP4 M3U8 playlist and stream init.mp4 + data segments
    const m3u8Text = await fetch(manifestOrMp3Url).then((r) => r.text());
    const initMatch = m3u8Text.match(/#EXT-X-MAP:URI="([^"]+)"/);
    const segmentUrls = m3u8Text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('https://'));

    const allUrls: string[] = [];
    if (initMatch?.[1]) {
      allUrls.push(initMatch[1]);
    }
    allUrls.push(...segmentUrls);

    if (allUrls.length === 0) {
      if (fallbackUrl) return NextResponse.redirect(fallbackUrl);
      return new NextResponse('Empty segments', { status: 502 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const segUrl of allUrls) {
            if (request.signal.aborted) break;
            const segRes = await fetch(segUrl, { signal: request.signal });
            if (!segRes.ok) continue;
            const buf = await segRes.arrayBuffer();
            controller.enqueue(new Uint8Array(buf));
          }
          controller.close();
        } catch {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mp4',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    if (fallbackUrl) return NextResponse.redirect(fallbackUrl);
    return new NextResponse('Stream error', { status: 500 });
  }
}
