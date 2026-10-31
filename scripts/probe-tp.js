#!/usr/bin/env node
/* 시험용: 서울→나트랑 2027-04, Travelpayouts 조회 방식별 기록 수 비교 */
'use strict';
const T = process.env.TP_TOKEN;
const get = async (path, q) => { const u = `https://api.travelpayouts.com${path}?${new URLSearchParams({ ...q, token: T })}`; const r = await fetch(u); const t = await r.text(); try { return [r.status, JSON.parse(t)]; } catch { return [r.status, t.slice(0, 200)]; } };
const sum = (label, [st, j]) => {
  const list = Array.isArray(j?.data) ? j.data : j?.data && typeof j.data === 'object' ? Object.values(j.data) : [];
  const prices = list.map(o => o.price ?? o.value).filter(Boolean).sort((a, b) => a - b);
  const days = new Set(list.map(o => String(o.departure_at || o.depart_date || '').slice(0, 10)).filter(Boolean));
  console.log(`${label.padEnd(44)} HTTP ${st} 기록 ${String(list.length).padStart(3)}건 · 출발일 ${days.size}일 · 최저 ${prices[0] ?? '-'}${j?.currency ? ' ' + j.currency : ''}${j?.error ? ' 오류:' + j.error : ''}`);
  return list;
};
(async () => {
  const base = { origin: 'SEL', destination: 'CXR', departure_at: '2027-04', sorting: 'price', limit: '1000', currency: 'krw' };
  sum('왕복 직항 (지금 방식)', await get('/aviasales/v3/prices_for_dates', { ...base, one_way: 'false', direct: 'true' }));
  sum('왕복 경유 포함', await get('/aviasales/v3/prices_for_dates', { ...base, one_way: 'false', direct: 'false' }));
  const out = sum('편도 가는 편 SEL→CXR 직항', await get('/aviasales/v3/prices_for_dates', { ...base, one_way: 'true', direct: 'true' }));
  sum('편도 오는 편 CXR→SEL 직항', await get('/aviasales/v3/prices_for_dates', { ...base, origin: 'CXR', destination: 'SEL', one_way: 'true', direct: 'true' }));
  for (const m of ['kr', 'us', 'jp', 'vn', 'sg']) sum(`왕복 직항 market=${m}`, await get('/aviasales/v3/prices_for_dates', { ...base, one_way: 'false', direct: 'true', market: m }));
  for (const m of ['kr', 'us']) sum(`편도 가는 편 market=${m}`, await get('/aviasales/v3/prices_for_dates', { ...base, one_way: 'true', direct: 'true', market: m }));
  sum('grouped_prices 출발일별', await get('/aviasales/v3/grouped_prices', { origin: 'SEL', destination: 'CXR', departure_at: '2027-04', group_by: 'departure_at', currency: 'krw', direct: 'true' }));
  sum('v2 month-matrix (편도)', await get('/v2/prices/month-matrix', { origin: 'SEL', destination: 'CXR', month: '2027-04-01', currency: 'krw', show_to_affiliates: 'false' }));
  sum('v1 calendar (왕복)', await get('/v1/prices/calendar', { origin: 'SEL', destination: 'CXR', depart_date: '2027-04', calendar_type: 'departure_date', currency: 'krw' }));
  console.log('편도 가는 편 예시:', out.slice(0, 5).map(o => `${o.departure_at?.slice(5, 16)} ${o.airline} ${o.price}`).join(' | '));
})();
