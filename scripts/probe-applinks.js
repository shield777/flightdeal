#!/usr/bin/env node
/* 시험용(병합하지 않음): 사이트별 '앱으로 열기(유니버설 링크)' 등록 파일 확인 */
'use strict';
const F = require('../js/flight-core.js');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const dest = F.DESTS.find(d => d.code === 'CXR') || F.DESTS[0];
const L = F.links('SEL', dest, '2027-01-10', '2027-01-13', 2, { direct: true }), T = F.ttang(dest, 2);
const targets = [L.naver, L.google, L.sky, T.city, T.today, 'https://m.naver.com/', 'https://m.flight.naver.com/', 'https://www.ttang.com/', 'https://m.ttang.com/',
  ...[...new Set(Object.values(F.AIRLINES).map(a => a.url).filter(Boolean))].map(u => u + '/')];
const glob = (pat, s) => new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$').test(s);
(async () => {
  for (const t of targets) {
    const u = new URL(t);
    let j = null, where = '';
    for (const p of ['/.well-known/apple-app-site-association', '/apple-app-site-association']) {
      try {
        const r = await fetch(u.origin + p, { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(12000) });
        const txt = await r.text();
        if (r.status === 200) { try { j = JSON.parse(txt); where = p; break; } catch { where = `${p} 200 JSON아님`; } } else where = `${p} ${r.status}`;
      } catch (e) { where = `${p} ${e.message}`; }
    }
    if (!j || !j.applinks) { console.log(`✗ ${u.host}${u.pathname.slice(0, 40)} → 등록 없음 (${where})`); continue; }
    const details = j.applinks.details || [];
    const ids = [], hits = [];
    for (const d of details) {
      const appIDs = d.appIDs || (d.appID ? [d.appID] : []);
      ids.push(...appIDs);
      // 옛 형식 paths, 새 형식 components
      let ok = null;
      for (const p of d.paths || []) { const neg = p.startsWith('NOT '); const pat = neg ? p.slice(4) : p; if (glob(pat, u.pathname)) { ok = !neg; break; } }
      for (const c of d.components || []) { if (c['/'] && glob(c['/'], u.pathname)) { ok = !c.exclude; break; } }
      if (ok) hits.push(appIDs.join(','));
    }
    console.log(`${hits.length ? '✓' : '△'} ${u.host}${u.pathname.slice(0, 40)} → 앱 ${[...new Set(ids)].slice(0, 3).join(' ')} | 이 주소 열림: ${hits.length ? 'yes' : 'no'}`);
  }
})();
