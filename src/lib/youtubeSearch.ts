import fs from 'fs';
import path from 'path';
import { TrackItem, VibeStateId } from '@/types/vibe';

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'yt-cache.json');
let searchCache: Record<string, YouTubeVideoResult[]> = {};

try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    searchCache = JSON.parse(raw);
  }
} catch {
  searchCache = {};
}

function persistCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(searchCache, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

export function cleanTitleAndArtist(rawTitle: string, rawChannel: string): { title: string; artist: string } {
  let clean = rawTitle
    .replace(/\[official (?:video|audio|music video|visualizer|hd|4k)\]/gi, '')
    .replace(/\(official (?:video|audio|music video|visualizer|hd|4k)\)/gi, '')
    .replace(/\[full (?:album|ost|soundtrack)\]/gi, '')
    .replace(/\(full (?:album|ost|soundtrack)\)/gi, '')
    .replace(/【.*?】/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If title has "Artist - Song Title"
  if (clean.includes(' - ')) {
    const parts = clean.split(' - ');
    const possibleArtist = parts[0].trim();
    const possibleTitle = parts.slice(1).join(' - ').trim();
    if (possibleArtist.length > 0 && possibleTitle.length > 0) {
      return {
        artist: possibleArtist,
        title: possibleTitle,
      };
    }
  }

  // If title has "Artist: Song Title"
  if (clean.includes(': ')) {
    const parts = clean.split(': ');
    const possibleArtist = parts[0].trim();
    const possibleTitle = parts.slice(1).join(': ').trim();
    if (possibleArtist.length > 0 && possibleTitle.length > 0 && possibleArtist.length < 35) {
      return {
        artist: possibleArtist,
        title: possibleTitle,
      };
    }
  }

  return {
    artist: rawChannel.replace(/ - Topic$/i, '').trim() || 'Game Soundtrack',
    title: clean,
  };
}

function extractYtInitialDataJson(html: string): Record<string, any> | null {
  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '];
  for (const marker of markers) {
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) continue;
    const jsonStart = html.indexOf('{', startIdx + marker.length);
    if (jsonStart === -1) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = jsonStart; i < html.length; i++) {
      const ch = html[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(html.slice(jsonStart, i + 1));
            } catch {
              break;
            }
          }
        }
      }
    }
  }
  return null;
}

function deduplicateYtResults(items: YouTubeVideoResult[]): YouTubeVideoResult[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const clean: YouTubeVideoResult[] = [];
  for (const v of items) {
    if (!v.videoId || v.videoId.length !== 11 || seenIds.has(v.videoId)) continue;
    if (!v.title || v.channel === 'Game Audio') continue;
    const normTitle = v.title
      .toLowerCase()
      .replace(/[\(\)\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normTitle || seenTitles.has(normTitle)) continue;
    seenIds.add(v.videoId);
    seenTitles.add(normTitle);
    clean.push(v);
  }
  return clean;
}

export async function searchYouTubeDirect(
  query: string,
  vibe: VibeStateId = 'EXPLORE',
  limit = 12
): Promise<TrackItem[]> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  // 1. Check in-memory / persistent cache (ignoring old corrupted "Game Audio" dummy entries)
  if (searchCache[cleanQ] && Array.isArray(searchCache[cleanQ]) && searchCache[cleanQ].length > 0) {
    const validCached = deduplicateYtResults(searchCache[cleanQ]);
    if (validCached.length > 0) {
      return validCached.slice(0, limit).map((v, idx) => mapYtToTrack(v, vibe, idx));
    }
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(5500),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const parsedVideos: YouTubeVideoResult[] = [];

    const data = extractYtInitialDataJson(html);
    if (data) {
      try {
        const contents =
          data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        if (Array.isArray(contents)) {
          for (const section of contents) {
            const itemSection = section?.itemSectionRenderer?.contents;
            if (Array.isArray(itemSection)) {
              for (const item of itemSection) {
                const v = item.videoRenderer;
                if (v && v.videoId && v.videoId.length === 11) {
                  const title = v.title?.runs?.map((r: { text: string }) => r.text).join('') || '';
                  const channel = v.ownerText?.runs?.map((r: { text: string }) => r.text).join('') || '';
                  const duration = v.lengthText?.simpleText || '03:40';
                  const thumb =
                    v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url ||
                    `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

                  if (
                    title.trim().length > 1 &&
                    !title.toLowerCase().includes('live stream') &&
                    !v.badges?.some(
                      (b: { metadataBadgeRenderer?: { style?: string } }) =>
                        b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW'
                    )
                  ) {
                    parsedVideos.push({
                      videoId: v.videoId,
                      title: title.replace(/[\r\n\t]/g, ' ').trim(),
                      channel: channel.trim() || 'Music Channel',
                      duration,
                      thumbnail: thumb,
                    });
                  }
                  if (parsedVideos.length >= limit * 2) break;
                }
              }
            }
            if (parsedVideos.length >= limit * 2) break;
          }
        }
      } catch {
        // Fallback below
      }
    }

    // oEmbed fallback if HTML renderer structure changed: resolves genuine YouTube track titles instead of fake query duplicates!
    if (parsedVideos.length === 0) {
      const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      let m: RegExpExecArray | null;
      const candidateIds: string[] = [];
      while ((m = regex.exec(html)) !== null && candidateIds.length < Math.min(limit, 8)) {
        if (!candidateIds.includes(m[1])) candidateIds.push(m[1]);
      }
      const oembedResults = await Promise.all(
        candidateIds.map(async (id) => {
          try {
            const oe = await fetch(
              `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
              { signal: AbortSignal.timeout(2500) }
            );
            if (!oe.ok) return null;
            const meta = (await oe.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
            if (!meta.title) return null;
            return {
              videoId: id,
              title: meta.title.trim(),
              channel: (meta.author_name || 'YouTube Music').trim(),
              duration: '03:45',
              thumbnail: meta.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            };
          } catch {
            return null;
          }
        })
      );
      for (const item of oembedResults) {
        if (item) parsedVideos.push(item);
      }
    }

    const deduped = deduplicateYtResults(parsedVideos).slice(0, limit);
    if (deduped.length > 0) {
      searchCache[cleanQ] = deduped;
      persistCache();
      return deduped.map((v, idx) => mapYtToTrack(v, vibe, idx));
    }
  } catch {
    // Return empty on network timeout
  }

  return [];
}

function mapYtToTrack(v: YouTubeVideoResult, vibe: VibeStateId, idx: number): TrackItem {
  const { title, artist } = cleanTitleAndArtist(v.title, v.channel);
  return {
    id: `yt-${v.videoId}-${idx}`,
    videoId: v.videoId,
    title,
    artist,
    album: 'YouTube Stream',
    duration: v.duration,
    thumbnail: v.thumbnail,
    previewUrl: '', // Full-length YouTube video
    vibe,
    genreTag: 'Game OST & Ambient',
  };
}
