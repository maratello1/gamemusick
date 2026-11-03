import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cachedClientId = '2yeWkbX88QhTzS3OtZp8cLGaJRrOAWwF';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const fallbackUrl = searchParams.get('fallback') || '';

  if (!query.trim()) {
    if (fallbackUrl) return NextResponse.redirect(fallbackUrl);
    return new NextResponse('Missing query', { status: 400 });
  }

  try {
    const cid = await getSoundCloudClientId();
    const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
      query.trim()
    )}&client_id=${cid}&limit=12`;

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

    // Prefer full-length tracks (> 90 seconds) with unencrypted HLS audio/mp4 (fMP4 CMAF) or progressive MP3
    let chosenTranscoding: { url: string; protocol: string; mime: string } | null = null;

    for (const item of collection) {
      const dur = typeof item.duration === 'number' ? item.duration : 0;
      if (dur < 85000) continue;

      const media = item.media as { transcodings?: Array<Record<string, unknown>> } | undefined;
      const transcodings = Array.isArray(media?.transcodings) ? media!.transcodings : [];

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

    // Fetch the HLS fMP4 M3U8 playlist and stream init.mp4 + all dataNNN.m4s segments continuously
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
