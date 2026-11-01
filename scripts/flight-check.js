#!/usr/bin/env node
/* 프로모션 확인 (GitHub Actions가 실행. 파이썬·설치 없이 Node만 씀)
   한국시간 오전 6시~밤 10시 2시간마다 자동 + 앱 항공권 검색 탭의 [지금 확인](토큰 있는 기기).
   --promos  특가 뉴스(원문 본문까지 읽음)·카드 할인 → data/promos.json
             프로모션 탭은 뉴스만, 카드 탭은 카드 뉴스 + 항공사 홈페이지의 카드·결제 혜택(제주항공·트리니티항공·비엣젯)

   선택 값(저장소 Settings → Secrets and variables → Actions):
   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET  네이버 뉴스 검색. 없으면 구글 뉴스만 씀

   인터넷 없이 시험: FLIGHT_MOCK=폴더 node scripts/flight-check.js --promos */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('../js/flight-core.js');
const ARTICLE = require('./article-text.js');
const OFFICIAL = require('./airline-events.js'); // 카드 탭용 (항공사 홈페이지의 카드·결제 혜택)

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
// Bing 뉴스 RSS: 기사 첫 문단(2~3문장)을 함께 줌 → 핵심 문장 요약에 씀. 링크는 원문 주소로 바꿈
async function newsBing(q) {
  if (MOCK) return [];
  const xml = await get(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=ko-KR&cc=KR`, {}, 'text');
  if (!xml) return [];
  const out = [];
  try {
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1], tag = t => { const r = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return r ? r[1].replace(/^<!\[CDATA\[|\]\]>$/g, '') : ''; };
      const d = new Date(tag('pubDate')); if (isNaN(d)) continue;
      let link = F.stripTags(tag('link')).replace(/&amp;/g, '&');
      const real = (link.match(/[?&]url=([^&]+)/) || [])[1];
      if (real) { try { link = decodeURIComponent(real); } catch { /* 그대로 */ } }
      out.push({ title: F.stripTags(F.stripTags(tag('title'))), link, date: d.toISOString(), desc: F.stripTags(F.stripTags(tag('description'))), source: F.stripTags(tag('News:Source')) || 'Bing 뉴스' });
    }
  } catch { /* 형식이 바뀌면 건너뜀 */ }
  return out;
}
// 기사 첫 문단 → 핵심 문장 최대 3개 (원문 문장 그대로, 기자 이름·언론사 머리말만 뺌). 숫자·기간·예약·탑승이 들어간 문장을 먼저
function leadSummary(desc) {
  const t = String(desc || '').replace(/^\s*[\[(][^\])]{2,30}(?:기자|=)[^\])]*[\])]\s*/, '').replace(/\s*\.\.\.$|…$/, '').trim();
  if (t.length < 20) return [];
  const sents = t.split(/(?<=다\.|요\.|\.)\s+|(?<=다\.)(?=\S)/).map(x => x.trim()).filter(x => x.length >= 12).map(x => x.length > 130 ? `${x.slice(0, 128)}…` : /[.다요]$/.test(x) ? x : `${x}…`); // 잘린 문장은 … 표시
  const score = x => (/\d/.test(x) ? 2 : 0) + (/원|%|할인|특가|예약|탑승|기간|노선|취항|코드/.test(x) ? 1 : 0);
  const keep = sents.map((x, i) => ({ x, i, s: score(x) })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 3).sort((a, b) => a.i - b.i).map(o => o.x);
  return keep;
}
async function newsNaver(q) {
  if (!ENV.NAVER_CLIENT_ID || !ENV.NAVER_CLIENT_SECRET || MOCK) return [];
  const j = await get(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=30&sort=date`, {
    headers: { 'X-Naver-Client-Id': ENV.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': ENV.NAVER_CLIENT_SECRET },
  });
  return ((j && j.items) || []).filter(it => !isNaN(new Date(it.pubDate))).map(it => ({ title: F.stripTags(it.title), link: it.originallink || it.link, date: new Date(it.pubDate).toISOString(), desc: F.stripTags(it.description), source: '네이버 뉴스' }));
}

// 검색어: 고른 나라·도시 + 고른 LCC + 카드사 (data/watchlist.json 의 settings 에서 바꿀 수 있어요)
// 검색어: 고른 나라 + 그 나라 도시 + 그 나라를 운항하는 항공사(최근 직항 가격 기록 기준) + 카드사
const cleanAir = n => String(n || '').replace(/\(.*\)/, '').trim();
// country: 한 나라 이름 | 'ALL'(자동 실행: 모든 나라, 나라마다 검색어를 줄여서) | ''(기본 나라)
function buildQueries(watch, country) {
  const s = watch.settings || {};
  const qs = new Set();
  const all = country === 'ALL';
  const countries = all ? [...new Set(F.DESTS.map(d => d.country))] : country ? [country] : F.promoSettings(s).countries;
  const rec = readJSON(path.join(DATA, 'airlines-by-city.json'), { cities: {} }).cities || {};
  for (const c of countries) {
    qs.add(`${c} 항공권 특가`); qs.add(`${c} 항공 프로모션`); qs.add(`${c} 땡처리 항공권`);
    const dests = F.DESTS.filter(x => x.country === c);
    for (const city of [...new Set(dests.map(d => d.city.replace(/\(.*\)/, '')))].slice(0, all ? 5 : 8)) qs.add(`${city} 항공권 특가`);
    const airs = [...new Set(dests.flatMap(d => (rec[d.code] || []).map(r => F.AIRLINES[r.code] ? F.airline(r.code).name : cleanAir(r.name))).filter(Boolean))].slice(0, all ? 10 : 14);
    airs.forEach((a, i) => { qs.add(`${a} 특가`); if (!all || i < 3) qs.add(`${a} ${c} 특가`); });
  }
  for (const c of s.cards || F.CARD_NAMES) { qs.add(`${c} 항공권 할인`); qs.add(`${c} 해외여행 할인`); }
  qs.add('항공권 카드 할인 트립닷컴');
  return [...qs];
}
// ───── 같은 소식 묶기 ─────
// 언론사만 다른 같은 기사를 1건으로 합쳐요. 묶인 기사는 대표 기사의 more 에 들어가요.
//  1) 기사 본문까지 읽어서 뽑은 금액·할인율·코드·예약기간·탑승기간을 비교
//     · 둘 다 적힌 값이 하나라도 다르면 → 다른 특가 (같은 항공사라도 따로)
//     · 같은 값이 2개 이상(그중 기간 1개 이상)이면 → 표현이 달라도 같은 특가 (30일 안, 같은 항공사)
//  2) 사실이 부족하면: 같은 항공사(카드사) 소식이 7일 안에 나오면 같은 소식, 이름이 없으면 제목 단어가 절반 이상 겹칠 때
//  · 국내선 소식과 해외 소식은 따로, 여러 항공사를 모은 기사는 사실이 같거나 제목이 비슷할 때만
const STOP = new Set(['특가', '할인', '항공권', '프로모션', '진행', '이벤트', '판매', '최대', '항공', '여행']);
const words = t => new Set(t.replace(/[^\p{L}\p{N}%]+/gu, ' ').split(' ').filter(w => w.length >= 2 && !STOP.has(w)));
const entityOf = p => p.kind === 'card' ? `card:${[...(p.cards || [])].sort().join('/')}` : (p.airlines || []).length ? `air:${p.airlines[0]}` : '';
const LEVEL = { strong: 3, medium: 2, weak: 1 };
const kstDay = d => new Date(new Date(d).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
// 기사 1건의 핵심 사실 (앱과 같은 방식: 제목 + 첫 문단 + 본문 문장, 모음 기사는 그 항공사 문장만, 날짜는 기사 등록일 기준)
const factsCache = new WeakMap();
function factsOf(m) {
  if (!factsCache.has(m)) {
    const parts = [...F.dropHead(F.splitSentences(F.stripTags(m.desc || '')), m.title), ...F.dropHead((m.body || []).map(F.stripTags), m.title), m.title];
    factsCache.set(m, F.promoFacts(F.airlineText(parts, (m.airlines || [])[0] || null), kstDay(m.date)));
  }
  return factsCache.get(m);
}
function sameNews(g, p) {
  if (g.kind !== p.kind) return false;
  if (p.official || g.members.some(m => m.official)) return false; // 홈페이지 이벤트는 따로
  if (F.isDomestic(p) !== F.isDomestic(g.members[0])) return false;
  const fm = F.sameFacts(g.facts, factsOf(p));
  if (fm < 0) return false; // 금액·기간이 다르면 다른 특가
  const e = entityOf(p);
  const days = Math.min(...g.members.map(m => Math.abs(new Date(m.date) - new Date(p.date)))) / 864e5;
  if (fm > 0 && e === g.entity && days <= 30) return true; // 표현이 달라도 금액·기간이 같으면 같은 특가
  if (days > 7) return false;
  const overlap = () => { const a = words(p.title), b = g.words; return [...a].filter(w => b.has(w)).length / Math.max(1, Math.min(a.size, b.size)); };
  const roundup = m => (m.airlines || []).length >= 3;
  if (roundup(p) || g.members.some(roundup)) return overlap() >= 0.5;
  if (e) {
    if (e !== g.entity) return false;
    // 내 노선(나트랑 등)이 잡힌 새 기사가, 노선 언급 없는 기존 소식 밑에 묻히지 않도록
    const gr = new Set(g.members.flatMap(m => (m.routes || []).filter(r => r.level !== 'weak').map(r => r.key)));
    return (p.routes || []).filter(r => r.level !== 'weak').every(r => gr.has(r.key));
  }
  if (g.entity) return false;
  return overlap() >= 0.5;
}
function groupNews(list) {
  // 묶음을 풀어서 기사 1건씩으로 (같은 기사가 두 번 들어가지 않게 id로 정리)
  const byId = new Map();
  for (const p of list) for (const m of [p, ...(p.more || [])]) { const { more, lastDate, lastFound, ...one } = m; byId.set(one.id, one); }
  const flat = [...byId.values()];
  // 사실(금액·기간)이 많은 기사를 먼저 묶음 기준으로 삼고, 내 노선이 나오는 기사 → 나머지는 거기에 붙임
  const routed = m => (m.routes || []).some(r => r.level !== 'weak') ? 0 : 1;
  const nFacts = m => Object.keys(factsOf(m)).length;
  flat.sort((a, b) => nFacts(b) - nFacts(a) || routed(a) - routed(b) || a.date.localeCompare(b.date));
  const groups = [];
  for (const p of flat) {
    const g = groups.find(x => sameNews(x, p));
    if (g) { g.members.push(p); for (const w of words(p.title)) g.words.add(w); g.facts = F.mergeFacts(g.facts, factsOf(p)); }
    else groups.push({ kind: p.kind, entity: entityOf(p), words: words(p.title), members: [p], facts: { ...factsOf(p) } });
  }
  return groups.map(g => {
    // 대표 기사: 사실(금액·기간·코드)이 가장 많은 것 > 노선이 잡힌 것 > 먼저 나온 것
    const score = m => Object.keys(factsOf(m)).length * 4 + ((m.routes || []).some(r => r.level !== 'weak') ? 2 : 0);
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

// 기사 원문을 열어 예약기간·탑승기간·할인코드가 들어 있는 문장을 저장 (body). 기사마다 한 번만 열어 봄 (bodyAt)
//  새 기사를 먼저, 그다음 최근 3주 안의 아직 안 열어 본 기사. 한 번에 최대 70건, 4건씩 동시에
async function readBodies(items, fresh) {
  if (MOCK) return;
  const since = new Date(NOW.getTime() - 21 * 864e5).toISOString();
  const freshSet = new Set(fresh);
  const todo = items.filter(p => !p.official && !p.bodyAt && p.link && p.date >= since)
    .sort((a, b) => (freshSet.has(b) ? 1 : 0) - (freshSet.has(a) ? 1 : 0) || b.date.localeCompare(a.date)).slice(0, 70);
  if (!todo.length) return;
  let ok = 0, sents = 0, google = 0;
  const fails = {};
  const work = async () => {
    for (let p; (p = todo.shift());) {
      p.bodyAt = TODAY;
      try {
        const wasGoogle = /news\.google\.com/.test(p.link);
        const r = await ARTICLE.readArticle(p);
        if (wasGoogle && r.url) { p.link = r.url; google++; }
        if (r.body.length) {
          p.body = r.body; ok++; sents += r.body.length;
          if (!p.summary) { const sum = leadSummary(r.body.join(' ')); if (sum.length) p.summary = sum; }
        }
      } catch (e) { const k = String(e.message).slice(0, 40); fails[k] = (fails[k] || 0) + 1; }
    }
  };
  const n = todo.length;
  await Promise.all([1, 2, 3, 4].map(work));
  log(`■ 기사 원문 ${n}건 열어 봄 → 본문 문장 저장 ${ok}건(${sents}문장), 구글 뉴스 원래 주소 ${google}건${Object.keys(fails).length ? ` · 실패: ${Object.entries(fails).map(([k, v]) => `${k} ${v}건`).join(', ')}` : ''}`);
}

async function checkPromos(watch, promos, country) {
  const routes = (watch.watches || []).map(w => ({ key: F.routeKey(w), dest: w.dest }));
  const qs = buildQueries(watch, country);
  log(`■ ${country || '기본 나라'} 기준 검색어 ${qs.length}개`);
  // 프로모션은 뉴스만: 항공사 홈페이지 이벤트(official)는 카드·결제 혜택만 남김 (카드 탭용)
  const before = (promos.items || []).flatMap(p => [p, ...(p.more || [])]).map(({ more, lastDate, lastFound, ...one }) => one).filter(p => !p.official || p.kind === 'card' || F.isPayBenefit(p));
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
    const items = [...await newsBing(q), ...await newsGoogle(q), ...await newsNaver(q)];
    await sleep(MOCK ? 0 : 400);
    for (const it of items) {
      if (!it.title || it.date < cutoff) continue;
      const id = newsId(it);
      const tkey = it.title.replace(/\s+/g, '').slice(0, 30);
      if (known.has(id) || seenTitles.has(tkey)) continue;
      const c = F.classifyNews(it.title, it.desc, routes);
      if (!c) continue;
      seenTitles.add(tkey);
      const sum = leadSummary(it.desc);
      const p = { id, kind: c.kind, title: it.title, desc: (it.desc || '').slice(0, 400), ...(sum.length ? { summary: sum } : {}), link: it.link, source: it.source, date: it.date, found: TODAY, cards: c.cards, airlines: c.airlines, countries: c.countries, allRoutes: c.allRoutes, routes: c.routes, price: c.price, query: q };
      known.set(id, p); fresh.push(p);
    }
  }

  await readBodies([...known.values()], fresh);
  // 본문에 나온 나라·도시도 이 소식의 나라로 (예: 제목엔 없고 본문에 '호찌민 40만원부터') — 여러 항공사 모음 기사는 다른 항공사 노선이 섞여서 제외
  for (const p of known.values()) if ((p.body || []).length && (p.airlines || []).length < 3) {
    const sc = F.newsScope(p.body.map(F.stripTags).join(' '));
    p.countries = [...new Set([...(p.countries || []), ...sc.countries])];
    if (sc.allRoutes) p.allRoutes = true;
  }

  // 카드 탭용: 항공사 홈페이지의 카드 제휴 할인·결제 혜택만 (제주항공·트리니티항공·비엣젯). 운임 특가는 뉴스로만
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
    const payOnly = q => q.kind === 'card' || F.isPayBenefit(q); // 카드 할인·결제 혜택만 저장
    if (known.has(id)) { Object.assign(known.get(id), { title: ev.title, desc: (ev.sub || '').slice(0, 200), from: ev.start || null, until: ev.end || null, kind, cards: cardHit }); continue; }
    const c = F.classifyNews(body, '', routes) || { routes: [], price: F.promoPrice(body), ...F.newsScope(body) };
    const p = { id, kind, official: true, title: ev.title, desc: (ev.sub || '').slice(0, 200), link: ev.link, source: `${F.airline(ev.code).name} 공식`,
      date: new Date(`${ev.start || TODAY}T09:00:00+09:00`).toISOString(), from: ev.start || null, until: ev.end || null, found: TODAY,
      cards: cardHit, airlines: [ev.code], countries: c.countries, allRoutes: c.allRoutes, routes: c.routes || [], price: c.price || null };
    // 처음 확인하는 항공사는 이미 올라와 있던 이벤트를 알림 없이 저장만 (알림 폭탄 방지)
    if (!payOnly(p)) continue;
    if (!promos.sources[ev.code]) p.alerted = true;
    known.set(id, p); fresh.push(p); offNew++;
  }
  for (const code of codes) if ((official.report[code] || 0) > 0 || MOCK) promos.sources[code] = promos.sources[code] || TODAY;
  if (official.items.length) log(`■ 항공사 홈페이지 이벤트 ${official.items.length}건 확인 → 카드·결제 혜택 새로 ${offNew}건 (운임 특가는 뉴스로만)`);
  // 같은 소식 묶기 → 최근 60일, 최대 250묶음만 보관
  const keep = F.addDays(TODAY, -60);
  const freshIds = new Set(fresh.map(p => p.id));
  const groups = groupNews([...known.values()].filter(p => p.found >= keep));
  promos.items = groups.sort((a, b) => b.lastDate.localeCompare(a.lastDate)).slice(0, 250);
  promos.updated = NOW.toISOString();
  if (country) {
    promos.checked = promos.checked || {};
    for (const c of country === 'ALL' ? [...new Set(F.DESTS.map(d => d.country))] : [country]) promos.checked[c] = NOW.toISOString();
    if (country === 'ALL') promos.auto = NOW.toISOString(); // 마지막 자동 확인
  }
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
    const country = String(ENV.PROMO_COUNTRY || '').trim().slice(0, 20);
    await checkPromos(watch, promos, country === 'ALL' ? 'ALL' : F.COUNTRIES.includes(country) ? country : '');
    writeJSON(P.promos, promos);
    return;
  }
  log('사용법: node scripts/flight-check.js --promos');
})().catch(e => { console.error(e); process.exit(1); });
