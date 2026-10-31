#!/usr/bin/env node
/* 도시별 '서울 출발 직항 항공사' 목록 만들기 → data/airlines-by-city.json
   근거: Travelpayouts(Aviasales)에 기록된 최근 가격 (서울 출발, 직항, 앞으로 6개월, 편도·왕복)
   - 가격 기록이 있는 항공사 = 그 노선을 실제로 판매·운항 중이라는 근거
   - 한계: 아무도 검색하지 않은 항공사(주로 비싼 대형 항공사)는 빠질 수 있음
   실행: TP_TOKEN=… node scripts/airline-routes.js  (앱 ⚙ 설정의 [항공사 목록 새로 만들기] → GitHub Actions) */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('../js/flight-core.js');
const T = process.env.TP_TOKEN;
const OUT = path.join(__dirname, '..', 'data', 'airlines-by-city.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (!T) { console.log('TP_TOKEN 없음'); process.exit(1); }
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) { const x = new Date(now.getFullYear(), now.getMonth() + i, 1); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
  let names = {};
  try { const a = await (await fetch('https://api.travelpayouts.com/data/airlines.json')).json(); names = Object.fromEntries(a.map(x => [x.code, (x.name_translations && x.name_translations.en) || x.name])); } catch { /* 이름은 없어도 됨 */ }
  const out = { updated: new Date().toISOString(), months, source: 'Travelpayouts(Aviasales)에 기록된 서울 출발 직항 가격', cities: {} };
  for (const d of F.DESTS) {
    const seen = {};
    for (const ym of months) for (const ow of ['true', 'false']) {
      const q = new URLSearchParams({ origin: 'SEL', destination: d.code, departure_at: ym, one_way: ow, direct: 'true', sorting: 'price', limit: '1000', currency: 'krw', token: T });
      let j = {};
      for (let k = 0; k < 3; k++) { try { const r = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${q}`); if (r.status === 429) { await sleep(3000); continue; } j = await r.json(); break; } catch { await sleep(1500); } }
      for (const o of j.data || []) {
        if (!o.airline || o.transfers) continue;
        const s = seen[o.airline] = seen[o.airline] || { code: o.airline, n: 0, from: [] };
        s.n++; if (o.origin_airport && !s.from.includes(o.origin_airport)) s.from.push(o.origin_airport);
      }
      await sleep(200);
    }
    out.cities[d.code] = Object.values(seen).sort((a, b) => b.n - a.n).map(s => ({ ...s, name: names[s.code] || '' }));
    console.log(`${d.city}(${d.code}): ${out.cities[d.code].map(s => `${s.code} ${s.n}`).join(', ') || '없음'}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
})();
