#!/usr/bin/env node
/* 시험용: Travelpayouts 공개 노선 자료로 서울(인천·김포) 출발 직항 항공사 확인 + 자료가 최신인지 */
'use strict';
const AIRPORTS = { CXR: ['CXR'], DAD: ['DAD'], PQC: ['PQC'], SGN: ['SGN'], HAN: ['HAN'], DLI: ['DLI'], BKK: ['BKK', 'DMK'], HKT: ['HKT'], CNX: ['CNX'], CEB: ['CEB'], TAG: ['TAG'], KLO: ['KLO', 'MPH'], MNL: ['MNL'], DPS: ['DPS'], BKI: ['BKI'], KUL: ['KUL'], SIN: ['SIN'], TYO: ['NRT', 'HND'], OSA: ['KIX', 'ITM'], FUK: ['FUK'], NGO: ['NGO'], OKA: ['OKA'], SPK: ['CTS'], TPE: ['TPE', 'TSA'], HKG: ['HKG'], MFM: ['MFM'], SHA: ['PVG', 'SHA'], GUM: ['GUM'], SPN: ['SPN'], HNL: ['HNL'] };
(async () => {
  for (const f of ['routes', 'airlines']) {
    const r = await fetch(`https://api.travelpayouts.com/data/${f}.json`);
    console.log(`${f}.json: HTTP ${r.status} · last-modified ${r.headers.get('last-modified')} · ${r.headers.get('content-length')}B`);
    globalThis[f] = await r.json();
  }
  console.log('노선 수', routes.length, '예:', JSON.stringify(routes[0]));
  const name = Object.fromEntries(airlines.map(a => [a.code, (a.name_translations && a.name_translations.en) || a.name]));
  const fromSeoul = routes.filter(r => ['ICN', 'GMP'].includes(r.departure_airport_iata) && !r.codeshare && !r.transfers);
  console.log('서울 출발 직항(코드셰어 제외) 노선 수', fromSeoul.length);
  for (const [city, aps] of Object.entries(AIRPORTS)) {
    const hit = fromSeoul.filter(r => aps.includes(r.arrival_airport_iata));
    const by = {};
    for (const r of hit) (by[r.airline_iata] = by[r.airline_iata] || new Set()).add(`${r.departure_airport_iata}-${r.arrival_airport_iata}`);
    console.log(`${city}: ${Object.entries(by).map(([c, s]) => `${c}(${name[c] || '?'}) ${[...s].join('/')}`).join(' · ') || '없음'}`);
  }
  // 최신성 점검용: 최근 생긴 항공사·노선이 있는지
  console.log('점검 RF(에어로케이) 노선:', routes.filter(r => r.airline_iata === 'RF').map(r => r.departure_airport_iata + '-' + r.arrival_airport_iata).slice(0, 12).join(' '));
  console.log('점검 YP(에어프레미아) 노선:', routes.filter(r => r.airline_iata === 'YP').map(r => r.departure_airport_iata + '-' + r.arrival_airport_iata).slice(0, 12).join(' '));
  console.log('점검 ZE(이스타) 노선:', routes.filter(r => r.airline_iata === 'ZE').map(r => r.departure_airport_iata + '-' + r.arrival_airport_iata).slice(0, 15).join(' '));
})().catch(e => console.log('실패', e.message));
