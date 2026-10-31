#!/usr/bin/env node
/* 프로모션 확인 (GitHub Actions가 실행. 파이썬·설치 없이 Node만 씀)
   매일 자동 실행은 없어요. 앱 프로모션 탭의 [지금 확인]을 누를 때만 돌아요.
   --promos  항공사 공식 이벤트(제주항공·트리니티항공·비엣젯)·특가 뉴스·카드 할인 → data/promos.json

   선택 값(저장소 Settings → Secrets and variables → Actions):
   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET  네이버 뉴스 검색. 없으면 구글 뉴스만 씀

   인터넷 없이 시험: FLIGHT_MOCK=폴더 node scripts/flight-check.js --promos */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('../js/flight-core.js');
const OFFICIAL = require('./airline-events.js');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const P = {
  watch: path.join(DATA, 'watchlist.json'),
  promos: path.join(DATA, 'promos.json'),
};
const ENV = process.env;
const MOCK = ENV.FLIGHT_MOCK ? path.resolve(ENV.FLIGHT_MOCK) : '';
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

// ───── 프로모션·카드 뉴스 ─────
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

async function checkPromos(watch, promos) {
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
      const p = { id, kind: c.kind, title: it.title, desc: (it.desc || '').slice(0, 200), link: it.link, source: it.source, date: it.date, found: TODAY, cards: c.cards, airlines: c.airlines, countries: c.countries, allRoutes: c.allRoutes, routes: c.routes, price: c.price, query: q };
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
  const freshGroups = promos.items.filter(g => freshIds.has(g.id));
  promos.runs = (promos.runs || 0) + 1;
  log(`■ 뉴스 ${qs.length}개 검색 → 새 기사 ${fresh.length}건 (새 소식 ${freshGroups.length}건, 전체 ${promos.items.length}묶음)`);
}

(async function main() {
  const watch = readJSON(P.watch, { settings: {}, watches: [] });
  if (process.argv.includes('--promos')) {
    // 프로모션 확인 (앱의 [지금 확인] 버튼). 매일 자동 실행·알림은 껐어요
    const promos = readJSON(P.promos, { items: [] });
    promos.runs = Math.max(promos.runs || 0, 1); // 예전 '첫 실행' 처리 건너뜀
    await checkPromos(watch, promos);
    writeJSON(P.promos, promos);
    return;
  }
  log('사용법: node scripts/flight-check.js --promos');
})().catch(e => { console.error(e); process.exit(1); });
