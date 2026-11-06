async function searchYouTube(query, limit = 15) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) return [];

  const html = await res.text();
  const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
  const videos = [];

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
                const title = v.title?.runs?.map((r) => r.text).join('') || '';
                const channel = v.ownerText?.runs?.map((r) => r.text).join('') || '';
                const duration = v.lengthText?.simpleText || '03:40';
                const thumb =
                  v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url ||
                  `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

                // Filter out livestreams or invalid entries
                if (!title.toLowerCase().includes('live stream') && !v.badges?.some(b => b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW')) {
                  videos.push({
                    videoId: v.videoId,
                    title: title.replace(/[\r\n\t]/g, ' ').trim(),
                    channel: channel.trim(),
                    duration,
                    thumbnail: thumb,
                  });
                }
                if (videos.length >= limit) break;
              }
            }
          }
          if (videos.length >= limit) break;
        }
      }
    } catch (e) {
      // Fallback to regex
    }
  }

  // Regex fallback if JSON parsing structure changed
  if (videos.length === 0) {
    const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let m;
    const seen = new Set();
    while ((m = regex.exec(html)) !== null && videos.length < limit) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        videos.push({
          videoId: id,
          title: query,
          channel: 'YouTube Audio',
          duration: '03:45',
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        });
      }
    }
  }

  return videos;
}

async function runTests() {
  const queries = [
    'Castlevania ambient exploration soundtrack',
    'Elden Ring combat battle ost',
    'Cyberpunk 2077 night city ambient',
    'Christopher Larkin Greenpath official audio',
  ];

  for (const q of queries) {
    console.log(`\n=== Testing Query: "${q}" ===`);
    const t0 = Date.now();
    const results = await searchYouTube(q, 3);
    console.log(`Found ${results.length} results in ${Date.now() - t0}ms:`);
    for (const r of results) {
      console.log(`  - [${r.videoId}] (${r.duration}) ${r.title} | ${r.channel}`);
    }
  }
}

runTests();
