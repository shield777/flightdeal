#!/usr/bin/env node
/* 시험용(병합하지 않음): 스카이스캐너·구글·제주항공 등록 파일 내용 */
'use strict';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
(async () => {
  for (const o of ['https://www.skyscanner.co.kr', 'https://www.skyscanner.net', 'https://www.google.com', 'https://www.jejuair.net', 'https://www.koreanair.com', 'https://www.airasia.com', 'https://mm.ttang.com']) {
    try {
      const r = await fetch(o + '/.well-known/apple-app-site-association', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
      const t = await r.text();
      let j; try { j = JSON.parse(t); } catch { console.log(`\n## ${o} ${r.status} ${r.url} (JSON 아님) ${t.slice(0, 200)}`); continue; }
      const d = (j.applinks && j.applinks.details) || [];
      console.log(`\n## ${o} ${r.status}`);
      for (const x of d) {
        const ids = (x.appIDs || [x.appID]).join(',');
        if (/debug|internal|uat|qa|brt/i.test(ids)) continue;
        console.log('  app', ids);
        console.log('   paths', JSON.stringify(x.paths || []).slice(0, 600));
        console.log('   comps', JSON.stringify((x.components || []).map(c => (c.exclude ? '!' : '') + c['/'] + (c['?'] ? '?' + JSON.stringify(c['?']) : ''))).slice(0, 900));
      }
    } catch (e) { console.log(o, e.message); }
  }
})();
