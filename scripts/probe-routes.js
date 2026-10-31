#!/usr/bin/env node
/* 시험용 2차: 최근 가격 기록(Travelpayouts)에 나온 서울 출발 직항 항공사 */
'use strict';
const T = process.env.TP_TOKEN;
const CITIES = ['CXR', 'DAD', 'CEB', 'OKA', 'FUK', 'TPE', 'BKI', 'KLO'];
const months = []; { const d = new Date(); for (let i = 0; i < 6; i++) { const x = new Date(d.getFullYear(), d.getMonth() + i, 1); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const c of CITIES) {
    const seen = {};
    for (const ym of months) for (const ow of ['true', 'false']) {
      const u = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${new URLSearchParams({ origin: 'SEL', destination: c, departure_at: ym, one_way: ow, direct: 'true', sorting: 'price', limit: '1000', currency: 'krw', token: T })}`;
      const j = await (await fetch(u)).json().catch(() => ({}));
      for (const o of j.data || []) { const k = o.airline; seen[k] = seen[k] || { n: 0, from: new Set() }; seen[k].n++; seen[k].from.add(o.origin_airport); }
      await sleep(150);
    }
    console.log(`${c}: ${Object.entries(seen).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${k}(${v.n}건, ${[...v.from].join('/')})`).join(' · ') || '없음'}`);
  }
})();
