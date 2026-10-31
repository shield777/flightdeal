#!/usr/bin/env node
/* 매일 항공권 점검 (GitHub Actions가 매일 아침 실행해요. 파이썬·설치 없이 Node만 씀)
   1) data/watchlist.json 의 추적 노선을 월별로 가격 조회 → data/flight-results.json (가격 기록 누적)
   2) 항공사 특가·카드 할인 뉴스 확인 → data/promos.json
   3) 새 특가·카드 할인·가격 하락이 있으면 휴대폰으로 알림(ntfy)

   필요한 값(저장소 Settings → Secrets and variables → Actions):
   TP_TOKEN      Travelpayouts API 토큰 (가격)            ← 없으면 가격 조회는 건너뜀
   NTFY_TOPIC    ntfy 알림 주제 이름                       ← 없으면 알림 없이 기록만
   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET  (선택) 네이버 뉴스 검색. 없으면 구글 뉴스만 씀

   직접 실행:  node scripts/flight-check.js            (실제 조회)
              node scripts/flight-check.js --test-notify   (알림 테스트 1건만)
              FLIGHT_MOCK=scripts/fixtures node scripts/flight-check.js   (인터넷 없이 시험) */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('../js/flight-core.js');
const OFFICIAL = require('./airline-events.js');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const P = {
  watch: path.join(DATA, 'watchlist.json'),
  results: path.join(DATA, 'flight-results.json'),
  promos: path.join(DATA, 'promos.json'),
};
const ENV = process.env;
const MOCK = ENV.FLIGHT_MOCK ? path.resolve(ENV.FLIGHT_MOCK) : '';
const APP_URL = ENV.APP_URL || '';
const NOW = new Date();
const TODAY = new Date(NOW.getTime() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
const log = (...a) => console.log(...a);

function readJSON(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function writeJSON(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, opt = {}, kind = 'json') {
  if (MOCK) {
    const name = opt.mockName;
    const f = name && path.join(MOCK, name);
    if (!f || !fs.existsSync(f)) return kind === 'json' ? null : '';
    const t = fs.readFileSync(f, 'utf8');
    return kind === 'json' ? JSON.parse(t) : t;
  }
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: opt.headers || {}, signal: AbortSignal.timeout(25000) });
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      if (!res.ok) { log(`  ! ${res.status} ${url.replace(/token=[^&]+/, 'token=***')}`); return kind === 'json' ? null : ''; }
      return kind === 'json' ? await res.json() : await res.text();
    } catch (e) { log(`  ! ${e.message}`); await sleep(1500 * (i + 1)); }
  }
  return kind === 'json' ? null : '';
}

// ───── 1) 가격 ─────
async function fetchMonth(w, ym, settings) {
  const token = ENV.TP_TOKEN;
  if (!token && !MOCK) return { error: 'TP_TOKEN 없음' };
  const q = new URLSearchParams({
    origin: w.origin, destination: w.dest, departure_at: ym, one_way: 'false', direct: w.direct ? 'true' : 'false',
    sorting: 'price', limit: '1000', currency: 'krw', unique: 'false', token: token || 'mock',
  });
  if (settings.market) q.set('market', settings.market);
  const url = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${q}`;
  const j = await get(url, { mockName: `tp-${w.origin}-${w.dest}-${ym}.json` });
  if (!j) return { error: '응답 없음' };
  if (j.success === false) return { error: j.error || '조회 실패' };
  if (j.currency && String(j.currency).toLowerCase() !== 'krw') return { error: `통화가 ${j.currency}로 와서 건너뜀` };
  return { offers: F.normalizeOffers(j, 'tp') };
}

function pushHistory(hist, entry) {
  const i = hist.findIndex(h => h.d === entry.d);
  if (i >= 0) hist[i] = entry; else hist.push(entry);
  while (hist.length > 400) hist.shift();
}
function avgOf(hist, days, field = 'min') {
  const cut = F.addDays(TODAY, -days);
  const v = hist.filter(h => h.d >= cut && h.d < TODAY && h[field] > 0).map(h => h[field]);
  return v.length ? { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), n: v.length } : { avg: 0, n: 0 };
}

async function checkPrices(watch, results, alerts) {
  const settings = watch.settings || {};
  const thisMonth = TODAY.slice(0, 7);
  for (const w of watch.watches || []) {
    if (w.paused) continue;
    const key = F.routeKey(w);
    const dest = F.findDest(w.dest) || { city: w.destName || w.dest, region: w.region || 'sea' };
    const R = results.routes[key] = results.routes[key] || { origin: w.origin, dest: w.dest, minNights: w.minNights, maxNights: w.maxNights, direct: !!w.direct, months: {} };
    log(`■ ${w.origin}→${w.dest} ${w.from}~${w.to} (${w.minNights}~${w.maxNights}박)`);
    for (const ym of F.monthsBetween(w.from, w.to)) {
      if (ym < thisMonth) continue; // 지난 달은 건너뜀
      const r = await fetchMonth(w, ym, settings);
      await sleep(MOCK ? 0 : 700);
      const M = R.months[ym] = R.months[ym] || { history: [] };
      M.checked = TODAY;
      if (r.error) { M.error = r.error; log(`  ${ym}: ${r.error}`); continue; }
      delete M.error;
      const s = F.summarizeMonth(r.offers, { month: ym, minNights: w.minNights, maxNights: w.maxNights, direct: w.direct });
      M.count = s.count; M.best = s.best; M.median = s.median; M.top = s.top;
      if (!s.best) { log(`  ${ym}: 조건에 맞는 가격 없음 (전체 ${r.offers.length}건)`); continue; }
      const before = avgOf(M.history, 30);
      const allLow = M.history.length ? Math.min(...M.history.map(h => h.min).filter(Boolean)) : 0;
      pushHistory(M.history, { d: TODAY, min: s.best.price, med: s.median });
      M.avg30 = avgOf(M.history, 30).avg;
      log(`  ${ym}: 최저 ${F.won(s.best.price)} (${s.best.dep.slice(5, 10)}~${s.best.ret.slice(5, 10)} ${s.best.airline}) · 보통 ${F.won(s.median)} · ${s.count}건`);

      // 가격 알림: 목표가 이하 / 30일 평균보다 N% 이상 쌈 / 역대 최저 갱신
      const drop = Number(settings.notifyDropPct) || 15;
      const reasons = [];
      if (w.targetPrice && s.best.price <= w.targetPrice) reasons.push(`목표가 ${F.won(w.targetPrice)} 이하`);
      if (before.n >= 5 && s.best.price <= before.avg * (1 - drop / 100)) reasons.push(`30일 평균 ${F.won(before.avg)}보다 ${Math.round((1 - s.best.price / before.avg) * 100)}% 쌈`);
      if (M.history.length >= 8 && allLow && s.best.price < allLow) reasons.push(`기록 최저(이전 ${F.won(allLow)})`);
      const sig = `${ym}:${s.best.price}`;
      if (reasons.length && M.alerted !== sig) {
        M.alerted = sig;
        const a = F.airline(s.best.airline).name;
        alerts.push({
          title: `${dest.city} ${Number(ym.slice(5))}월 ${F.won(s.best.price)}`,
          body: `${reasons.join(' · ')}\n${s.best.dep.slice(5, 10)} → ${s.best.ret.slice(5, 10)} (${s.best.nights}박) ${a} 직항\n1인 왕복 기록 가격 · 수하물 포함 여부는 예약 화면에서 확인`,
          tags: 'airplane,chart_with_downwards_trend',
          click: APP_URL ? `${APP_URL}#r=${encodeURIComponent(key)}&m=${ym}` : s.best.link,
        });
      }
    }
  }
}

// ───── 2) 프로모션·카드 뉴스 ─────
function parseRSS(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  const tag = (s, t) => { const x = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return x ? x[1].replace(/^<!\[CDATA\[|\]\]>$/g, '') : ''; };
  while ((m = re.exec(xml))) {
    const s = m[1];
    // 구글 뉴스는 본문 HTML을 &lt;a ...&gt; 처럼 한 번 더 감싸서 줌 → 두 번 벗겨야 글자만 남음
    const clean = t => F.stripTags(F.stripTags(tag(s, t)));
    let title = clean('title');
    const source = clean('source');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const d = new Date(tag(s, 'pubDate'));
    if (isNaN(d)) continue; // 날짜가 깨진 기사 1건 때문에 검색 전체를 버리지 않도록 건너뜀
    items.push({ title, link: clean('link'), date: d.toISOString(), desc: clean('description'), source });
  }
  return items;
}
async function newsGoogle(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}&hl=ko&gl=KR&ceid=KR:ko`;
  const xml = await get(url, { mockName: `news-${q.replace(/\s+/g, '_')}.xml` }, 'text');
  try { return xml ? parseRSS(xml) : []; } catch { return []; }
}
async function newsNaver(q) {
  if (!ENV.NAVER_CLIENT_ID || !ENV.NAVER_CLIENT_SECRET || MOCK) return [];
  const j = await get(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=30&sort=date`, {
    headers: { 'X-Naver-Client-Id': ENV.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': ENV.NAVER_CLIENT_SECRET },
  });
  return ((j && j.items) || []).filter(it => !isNaN(new Date(it.pubDate))).map(it => ({ title: F.stripTags(it.title), link: it.originallink || it.link, date: new Date(it.pubDate).toISOString(), desc: F.stripTags(it.description), source: '네이버 뉴스' }));
}

// 검색어: 고른 나라·도시 + 고른 LCC + 카드사 (data/watchlist.json 의 settings 에서 바꿀 수 있어요)
function buildQueries(watch) {
  const s = watch.settings || {};
  const ps = F.promoSettings(s);
  const qs = new Set();
  for (const c of ps.countries) {
    qs.add(`${c} 항공권 특가`); qs.add(`${c} 노선 특가`); qs.add(`${c} 땡처리 항공권`);
    for (const d of F.DESTS.filter(x => x.country === c)) qs.add(`${d.city.replace(/\(.*\)/, '')} 특가 항공`);
  }
  for (const code of ps.airlines) qs.add(`${F.airline(code).name} 특가`);
  for (const c of s.cards || F.CARD_NAMES) { qs.add(`${c} 항공권 할인`); qs.add(`${c} 해외여행 할인`); }
  qs.add('항공권 카드 할인 트립닷컴');
  return [...qs];
}
// ───── 같은 소식 묶기 ─────
// 언론사만 다른 같은 기사를 1건으로 합쳐요. 묶인 기사는 대표 기사의 more 에 들어가요.
//  · 같은 항공사(또는 같은 카드사)의 소식이 7일 안에 나오면 같은 소식 (같은 특가 기사가 며칠에 걸쳐 나옴)
//    단, 둘 다 가격이 있는데 가격이 다르거나, 새 기사에만 내 노선이 나오면 다른 특가로 봄
//  · 항공사·카드사 이름이 없는 기사는 제목 단어가 절반 이상 겹치면 같은 소식
//  · 항공사 공식 이벤트끼리는 묶지 않고, 뉴스는 제목이 비슷할 때만 공식 이벤트에 붙음
const STOP = new Set(['특가', '할인', '항공권', '프로모션', '진행', '이벤트', '판매', '최대', '항공', '여행']);
const words = t => new Set(t.replace(/[^\p{L}\p{N}%]+/gu, ' ').split(' ').filter(w => w.length >= 2 && !STOP.has(w)));
const entityOf = p => p.kind === 'card' ? `card:${[...(p.cards || [])].sort().join('/')}` : (p.airlines || []).length ? `air:${p.airlines[0]}` : '';
const LEVEL = { strong: 3, medium: 2, weak: 1 };
function sameNews(g, p) {
  if (g.kind !== p.kind) return false;
  const near = g.members.some(m => Math.abs(new Date(m.date) - new Date(p.date)) <= 7 * 864e5);
  if (!near) return false;
  const e = entityOf(p);
  const overlap = () => { const a = words(p.title), b = g.words; return [...a].filter(w => b.has(w)).length / Math.max(1, Math.min(a.size, b.size)); };
  const gOfficial = g.members.some(m => m.official);
  // 공식 이벤트는 번호가 다르면 다른 행사 → 공식끼리는 절대 묶지 않음. 뉴스가 공식 이벤트에 붙으려면 제목이 비슷해야 함
  if (p.official && gOfficial) return false;
  if ((p.official || gOfficial) && overlap() < 0.3) return false;
  if (e) {
    if (e !== g.entity) return false;
    const gp = g.members.find(m => m.price);
    if (p.price && gp && p.price.amount !== gp.price.amount) return false;
    // 내 노선(나트랑 등)이 잡힌 새 기사가, 노선 언급 없는 기존 소식 밑에 묻혀 알림이 빠지지 않도록
    const gr = new Set(g.members.flatMap(m => (m.routes || []).filter(r => r.level !== 'weak').map(r => r.key)));
    return (p.routes || []).filter(r => r.level !== 'weak').every(r => gr.has(r.key));
  }
  if (g.entity) return false;
  const a = words(p.title), b = g.words;
  const common = [...a].filter(w => b.has(w)).length;
  return common / Math.max(1, Math.min(a.size, b.size)) >= 0.5;
}
function groupNews(list) {
  // 묶음을 풀어서 기사 1건씩으로 (같은 기사가 두 번 들어가지 않게 id로 정리)
  const byId = new Map();
  for (const p of list) for (const m of [p, ...(p.more || [])]) { const { more, lastDate, lastFound, ...one } = m; byId.set(one.id, one); }
  const flat = [...byId.values()];
  // 내 노선이 나오는 기사를 먼저 묶음 기준으로 삼고, 노선 언급 없는 기사는 거기에 붙임
  const routed = m => (m.routes || []).some(r => r.level !== 'weak') ? 0 : 1;
  flat.sort((a, b) => routed(a) - routed(b) || a.date.localeCompare(b.date));
  const groups = [];
  for (const p of flat) {
    const g = groups.find(x => sameNews(x, p));
    if (g) { g.members.push(p); for (const w of words(p.title)) g.words.add(w); }
    else groups.push({ kind: p.kind, entity: entityOf(p), words: words(p.title), members: [p] });
  }
  return groups.map(g => {
    // 대표 기사: 항공사 공식 > 노선이 잡힌 것 > 가격이 있는 것 > 먼저 나온 것
    const score = m => (m.official ? 4 : 0) + ((m.routes || []).some(r => r.level !== 'weak') ? 2 : 0) + (m.price ? 1 : 0);
    const lead = g.members.reduce((best, m) => score(m) > score(best) ? m : best);
    const routes = new Map();
    for (const m of g.members) for (const r of m.routes || []) if (!routes.has(r.key) || LEVEL[r.level] > LEVEL[routes.get(r.key).level]) routes.set(r.key, r);
    const out = {
      ...lead,
      cards: [...new Set(g.members.flatMap(m => m.cards || []))],
      airlines: [...new Set(g.members.flatMap(m => m.airlines || []))],
      routes: [...routes.values()],
      price: lead.price || (g.members.find(m => m.price) || {}).price || null,
      countries: [...new Set(g.members.flatMap(m => m.countries || []))],
      allRoutes: g.members.some(m => m.allRoutes),
      alerted: g.members.some(m => m.alerted) || undefined,
      lastDate: g.members.reduce((a, m) => m.date > a ? m.date : a, ''),
      lastFound: g.members.reduce((a, m) => m.found > a ? m.found : a, ''),
    };
    const more = g.members.filter(m => m !== lead);
    if (more.length) out.more = more;
    return out;
  });
}

function newsId(it) { return (it.link || it.title).replace(/[?#].*$/, '').slice(-120) + '|' + it.title.slice(0, 40); }

async function checkPromos(watch, results, promos, alerts) {
  const routes = (watch.watches || []).map(w => ({ key: F.routeKey(w), dest: w.dest }));
  const qs = buildQueries(watch);
  const before = (promos.items || []).flatMap(p => [p, ...(p.more || [])]).map(({ more, lastDate, lastFound, ...one }) => one);
  // 추적 조건(직항·박수)이 바뀌면 노선 이름표가 바뀜 → 같은 출발·도착 노선이면 새 이름표로 옮김
  const liveKeys = new Set(routes.map(r => r.key));
  const od = k => k.split('-').slice(0, 2).join('-');
  for (const p of before) for (const r of p.routes || []) {
    if (liveKeys.has(r.key)) continue;
    const to = routes.find(x => od(x.key) === od(r.key));
    if (to) r.key = to.key;
  }
  for (const p of before) if (p.routes) p.routes = [...new Map(p.routes.map(r => [r.key, r])).values()];
  for (const p of before) if (!p.countries) Object.assign(p, F.newsScope(`${p.title} ${p.desc || ''}`));
  // 티웨이 → 트리니티 등 항공사 이름(별칭)이 바뀐 경우를 위해 다시 확인
  for (const p of before) if (p.kind === 'airline' && !p.official) p.airlines = [...new Set([...(p.airlines || []), ...F.airlineInText(`${p.title} ${p.desc || ''}`)])];
  const known = new Map(before.map(p => [p.id, p]));
  const seenTitles = new Set(before.map(p => p.title.replace(/\s+/g, '').slice(0, 30)));
  const cutoff = new Date(NOW.getTime() - 10 * 864e5).toISOString();
  const fresh = [];
  for (const q of qs) {
    const items = [...await newsGoogle(q), ...await newsNaver(q)];
    await sleep(MOCK ? 0 : 400);
    for (const it of items) {
      if (!it.title || it.date < cutoff) continue;
      const id = newsId(it);
      const tkey = it.title.replace(/\s+/g, '').slice(0, 30);
      if (known.has(id) || seenTitles.has(tkey)) continue;
      const c = F.classifyNews(it.title, it.desc, routes);
      if (!c) continue;
      seenTitles.add(tkey);
      // 보통 가격과 비교: 연결된 노선의 월별 보통 가격 평균
      let vs = null;
      const r0 = c.routes.find(r => r.level !== 'weak');
      if (c.price && r0 && results.routes[r0.key]) {
        const meds = Object.values(results.routes[r0.key].months).map(m => m.median).filter(Boolean);
        if (meds.length) vs = F.promoVsTypical(c.price, Math.round(meds.reduce((a, b) => a + b, 0) / meds.length));
      }
      const p = { id, kind: c.kind, title: it.title, desc: (it.desc || '').slice(0, 200), link: it.link, source: it.source, date: it.date, found: TODAY, cards: c.cards, airlines: c.airlines, countries: c.countries, allRoutes: c.allRoutes, routes: c.routes, price: c.price, vs, query: q };
      known.set(id, p); fresh.push(p);
    }
  }

  // 항공사 공식 홈페이지 이벤트 (제주항공·트리니티항공·비엣젯)
  const ps = F.promoSettings(watch.settings);
  const codes = OFFICIAL.SUPPORTED.filter(c => ps.airlines.includes(c));
  let official = { items: [], report: {} };
  if (MOCK) { const f = path.join(MOCK, 'official.json'); if (fs.existsSync(f)) official.items = JSON.parse(fs.readFileSync(f, 'utf8')); }
  else if (codes.length) official = await OFFICIAL.fetchAirlineEvents(codes, log);
  promos.sources = promos.sources || {};
  let offNew = 0;
  for (const ev of official.items) {
    if (ev.end && ev.end < TODAY) continue; // 끝난 이벤트
    const id = `official:${ev.code}:${ev.key}`;
    const body = `${ev.title} ${ev.sub || ''}`;
    // 우리·현대·신한카드 제휴 할인은 '카드 할인'으로 분류 → 앱의 내 카드 할인 칸에 표시
    const cardHit = F.CARD_NAMES.filter(c => body.includes(c));
    const kind = cardHit.length ? 'card' : 'airline';
    if (known.has(id)) { Object.assign(known.get(id), { title: ev.title, desc: (ev.sub || '').slice(0, 200), from: ev.start || null, until: ev.end || null, kind, cards: cardHit }); continue; }
    const c = F.classifyNews(body, '', routes) || { routes: [], price: F.promoPrice(body), ...F.newsScope(body) };
    const p = { id, kind, official: true, title: ev.title, desc: (ev.sub || '').slice(0, 200), link: ev.link, source: `${F.airline(ev.code).name} 공식`,
      date: new Date(`${ev.start || TODAY}T09:00:00+09:00`).toISOString(), from: ev.start || null, until: ev.end || null, found: TODAY,
      cards: cardHit, airlines: [ev.code], countries: c.countries, allRoutes: c.allRoutes, routes: c.routes || [], price: c.price || null };
    // 처음 확인하는 항공사는 이미 올라와 있던 이벤트를 알림 없이 저장만 (알림 폭탄 방지)
    if (!promos.sources[ev.code]) p.alerted = true;
    known.set(id, p); fresh.push(p); offNew++;
  }
  for (const code of codes) if ((official.report[code] || 0) > 0 || MOCK) promos.sources[code] = promos.sources[code] || TODAY;
  if (official.items.length) log(`■ 항공사 공식 이벤트 ${official.items.length}건 확인 → 새로 ${offNew}건`);
  // 같은 소식 묶기 → 최근 60일, 최대 250묶음만 보관
  const keep = F.addDays(TODAY, -60);
  const freshIds = new Set(fresh.map(p => p.id));
  const groups = groupNews([...known.values()].filter(p => p.found >= keep));
  promos.items = groups.sort((a, b) => b.lastDate.localeCompare(a.lastDate)).slice(0, 250);
  promos.updated = NOW.toISOString();
  // 알림은 대표 기사가 새 기사인 묶음만 (이미 나온 소식의 다른 언론사 기사는 알리지 않음)
  const freshGroups = promos.items.filter(g => freshIds.has(g.id));
  log(`■ 뉴스 ${qs.length}개 검색 → 새 기사 ${fresh.length}건 (새 소식 ${freshGroups.length}건, 전체 ${promos.items.length}묶음)`);

  const firstRun = !(promos.runs > 0);
  promos.runs = (promos.runs || 0) + 1;
  if (firstRun) { log('  (첫 실행이라 지금까지 쌓인 뉴스는 알림 없이 저장만 해요)'); return; }
  // 알림 대상: 고른 나라(베트남·일본 등)·고른 LCC의 특가, 카드 할인. 같은 소식으로 이미 알린 묶음은 제외
  const wanted = freshGroups.filter(g => F.isWantedPromo(g, watch.settings) && ![g, ...(g.more || [])].some(m => m.alerted));
  for (const g of wanted) { g.alerted = true; for (const m of g.more || []) m.alerted = true; }
  for (const p of wanted.slice(0, 6)) {
    const air = (p.airlines.map(c => F.airline(c).name)[0]) || '항공 특가';
    const where = (p.countries || []).filter(c => F.promoSettings(watch.settings).countries.includes(c)).join('·') || (p.allRoutes ? '국제선 전체' : '');
    const tag = p.kind === 'card' ? `💳 ${p.cards.join('·')}` : `🏷️ ${air}${p.official ? ' 공식' : ''}${where ? ` · ${where}` : ''}`;
    // 원문 제목·기간·출처만 (가격 계산·추정 없음)
    const period = p.until ? `\n기간 ~${p.until.slice(5).replace('-', '/')}` : '';
    const src = p.official ? '' : `\n${p.source || '뉴스'} 보도`;
    alerts.push({ title: tag, body: `${p.title}${p.official && p.desc ? ` — ${p.desc.slice(0, 60)}` : ''}${period}${src}`, tags: p.kind === 'card' ? 'credit_card' : 'label', click: p.link });
  }
  if (wanted.length > 6) alerts.push({ title: `특가·할인 소식 ${wanted.length - 6}건 더`, body: '앱의 프로모션 목록에서 확인하세요', tags: 'label', click: APP_URL });
}

// ───── 3) 알림 (ntfy) ─────
async function notify(alerts) {
  const topic = ENV.NTFY_TOPIC;
  if (!alerts.length) { log('■ 알림 없음'); return; }
  if (!topic || MOCK) { log(`■ 알림 ${alerts.length}건 (NTFY_TOPIC 없음/시험 모드라 보내지 않음)`); alerts.forEach(a => log(`  · ${a.title} — ${a.body.split('\n')[0]}`)); return; }
  const server = (ENV.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
  for (const a of alerts.slice(0, 10)) {
    try {
      const res = await fetch(server, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, title: a.title, message: a.body, tags: a.tags ? a.tags.split(',') : [], click: a.click || undefined, priority: 4 }),
      });
      log(`  알림 ${res.ok ? '보냄' : '실패 ' + res.status}: ${a.title}`);
    } catch (e) { log(`  알림 실패: ${e.message}`); }
    await sleep(300);
  }
}

(async function main() {
  if (process.argv.includes('--test-notify')) {
    await notify([{ title: '✈️ 알림 테스트', body: '항공권 최저가 알림이 잘 연결됐어요.', tags: 'airplane', click: APP_URL }]);
    return;
  }
  const watch = readJSON(P.watch, { settings: {}, watches: [] });
  const results = readJSON(P.results, {});
  results.routes = results.routes || {};
  const promos = readJSON(P.promos, { items: [] });
  const alerts = [];

  // 추적에서 빠진 노선은 결과에서도 정리 (기록은 30일 보관 후 삭제)
  const live = new Set((watch.watches || []).map(F.routeKey));
  for (const k of Object.keys(results.routes)) {
    if (live.has(k)) delete results.routes[k].removed;
    else { results.routes[k].removed = results.routes[k].removed || TODAY; if (F.addDays(results.routes[k].removed, 30) < TODAY) delete results.routes[k]; }
  }

  if (ENV.TP_TOKEN || MOCK) await checkPrices(watch, results, alerts);
  else log('■ TP_TOKEN이 없어 가격 조회는 건너뛰어요 (SETUP.md 참고)');
  results.updated = NOW.toISOString();
  results.source = 'Travelpayouts(Aviasales) 캐시 데이터';

  await checkPromos(watch, results, promos, alerts);
  writeJSON(P.results, results);
  writeJSON(P.promos, promos);
  await notify(alerts);
})().catch(e => { console.error(e); process.exit(1); });
