async function testYT() {
  const query = 'Castlevania ambient exploration soundtrack';
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  const html = await res.text();
  const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      const itemSection = contents?.find((c) => c.itemSectionRenderer)?.itemSectionRenderer?.contents;
      const videos = [];
      if (itemSection) {
        for (const item of itemSection) {
          const v = item.videoRenderer;
          if (v && v.videoId) {
            const title = v.title?.runs?.map((r) => r.text).join('') || '';
            const channel = v.ownerText?.runs?.map((r) => r.text).join('') || '';
            const duration = v.lengthText?.simpleText || '03:30';
            const thumb = v.thumbnail?.thumbnails?.[0]?.url || '';
            videos.push({ videoId: v.videoId, title, channel, duration, thumb });
          }
        }
      }
      console.log('Parsed videos count:', videos.length);
      console.log('First 3 videos:', JSON.stringify(videos.slice(0, 3), null, 2));
    } catch (e) {
      console.log('JSON parse error:', e.message);
    }
  } else {
    console.log('ytInitialData not found in HTML');
  }
}
testYT();
