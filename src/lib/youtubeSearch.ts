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

export async function searchYouTubeDirect(
  query: string,
  vibe: VibeStateId = 'EXPLORE',
  limit = 12
): Promise<TrackItem[]> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  // 1. Check in-memory / persistent cache
  if (searchCache[cleanQ] && Array.isArray(searchCache[cleanQ]) && searchCache[cleanQ].length > 0) {
    return searchCache[cleanQ].slice(0, limit).map((v, idx) => mapYtToTrack(v, vibe, idx));
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    const parsedVideos: YouTubeVideoResult[] = [];

    if (match) {
      try {
        const data = JSON.parse(match[1]);
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
                    !title.toLowerCase().includes('live stream') &&
                    !v.badges?.some(
                      (b: { metadataBadgeRenderer?: { style?: string } }) =>
                        b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW'
                    )
                  ) {
                    parsedVideos.push({
                      videoId: v.videoId,
                      title: title.replace(/[\r\n\t]/g, ' ').trim(),
                      channel: channel.trim(),
                      duration,
                      thumbnail: thumb,
                    });
                  }
                  if (parsedVideos.length >= limit) break;
                }
              }
            }
            if (parsedVideos.length >= limit) break;
          }
        }
      } catch {
        // Fallback to regex below
      }
    }

    // Regex fallback
    if (parsedVideos.length === 0) {
      const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      let m: RegExpExecArray | null;
      const seen = new Set<string>();
      while ((m = regex.exec(html)) !== null && parsedVideos.length < limit) {
        const id = m[1];
        if (!seen.has(id)) {
          seen.add(id);
          parsedVideos.push({
            videoId: id,
            title: query,
            channel: 'Game Audio',
            duration: '03:45',
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          });
        }
      }
    }

    if (parsedVideos.length > 0) {
      searchCache[cleanQ] = parsedVideos;
      persistCache();
      return parsedVideos.map((v, idx) => mapYtToTrack(v, vibe, idx));
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
