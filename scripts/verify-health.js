const http = require('http');

const PORT = process.env.PORT || 3001;

const ROUTES = [
  '/',
  '/api/telemetry',
  '/api/ytmusic?vibe=COMBAT&q=dark+synthwave',
  '/api/yt-resolve?artist=Eminem&title=Lose+Yourself',
  '/api/app-state',
  '/api/presets',
  '/api/userscript',
  '/api/accounts',
  '/api/integrations',
];

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${PORT}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('=== GameVibe v1.0 Health Check ===');
  let allPassed = true;

  for (const route of ROUTES) {
    try {
      const res = await fetchUrl(route);
      const ok = res.status === 200;
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${route} -> HTTP ${res.status} (${res.body.length} bytes)`);
      if (!ok) allPassed = false;

      if (route === '/') {
        const cssMatches = [...res.body.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)];
        for (const m of cssMatches) {
          const cssRes = await fetchUrl(m[1]);
          console.log(
            `[${cssRes.status === 200 ? 'PASS' : 'FAIL'}] Stylesheet ${m[1]} -> HTTP ${cssRes.status} (${cssRes.body.length} bytes)`
          );
          if (cssRes.status !== 200) allPassed = false;
        }
      }
    } catch (err) {
      console.error(`[FAIL] ${route} -> ${err.message}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    process.exit(1);
  }
  console.log('=== ALL CHECKS PASSED ===');
}

main();
