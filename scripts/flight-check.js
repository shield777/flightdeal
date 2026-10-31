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
          body: `${reasons.join(' · ')}\n${s.best.dep.slice(5, 10)} → ${s.best.ret.slice(5, 10)} (${s.best.nights}박) ${a}\n1인 왕복, 수하물·결제수수료 확인 필요`,
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
    let title = F.stripTags(tag(s, 'title'));
    const source = F.stripTags(tag(s, 'source'));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    items.push({ title, link: F.stripTags(tag(s, 'link')), date: new Date(tag(s, 'pubDate')).toISOString(), desc: F.stripTags(tag(s, 'description')), source });
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
  return ((j && j.items) || []).map(it => ({ title: F.stripTags(it.title), link: it.originallink || it.link, date: new Date(it.pubDate).toISOString(), desc: F.stripTags(it.description), source: '네이버 뉴스' }));
}

function buildQueries(watch) {
  const s = watch.settings || {};
  const air = (s.followAirlines || ['7C', 'LJ', 'TW', 'BX', 'RS', 'ZE', 'KE', 'OZ', 'VJ', 'YP']).map(c => F.airline(c).name);
  const qs = new Set();
  for (const a of air) qs.add(`${a} 특가`);
  for (const w of watch.watches || []) {
    const d = F.findDest(w.dest);
    if (d) { qs.add(`${d.city.replace(/\(.*\)/, '')} 항공권 특가`); qs.add(`${d.country} 노선 특가`); }
  }
  for (const c of s.cards || F.CARD_NAMES) { qs.add(`${c} 항공권 할인`); qs.add(`${c} 해외여행 할인`); }
  qs.add('항공권 카드 할인 트립닷컴');
  return [...qs];
}
function newsId(it) { return (it.link || it.title).replace(/[?#].*$/, '').slice(-120) + '|' + it.title.slice(0, 40); }

async function checkPromos(watch, results, promos, alerts) {
  const routes = (watch.watches || []).map(w => ({ key: F.routeKey(w), dest: w.dest }));
  const qs = buildQueries(watch);
  const known = new Map((promos.items || []).map(p => [p.id, p]));
  const seenTitles = new Set((promos.items || []).map(p => p.title.replace(/\s+/g, '').slice(0, 30)));
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
      const p = { id, kind: c.kind, title: it.title, link: it.link, source: it.source, date: it.date, found: TODAY, cards: c.cards, airlines: c.airlines, routes: c.routes, price: c.price, vs, query: q };
      known.set(id, p); fresh.push(p);
    }
  }
  // 최근 60일, 최대 250건만 보관
  const keep = F.addDays(TODAY, -60);
  promos.items = [...known.values()].filter(p => p.found >= keep).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 250);
  promos.updated = NOW.toISOString();
  log(`■ 뉴스 ${qs.length}개 검색 → 새 항목 ${fresh.length}건`);

  const firstRun = !(promos.runs > 0);
  promos.runs = (promos.runs || 0) + 1;
  if (firstRun) { log('  (첫 실행이라 지금까지 쌓인 뉴스는 알림 없이 저장만 해요)'); return; }
  const wanted = fresh.filter(p => p.kind === 'card' || p.routes.some(r => r.level !== 'weak') || (p.kind === 'airline' && p.routes.length));
  for (const p of wanted.slice(0, 6)) {
    const tag = p.kind === 'card' ? `💳 ${p.cards.join('·')}` : `🏷️ ${(p.airlines.map(c => F.airline(c).name)[0]) || '항공 특가'}`;
    const vs = p.vs ? `\n보통 가격 대비 약 ${p.vs.pct > 0 ? '-' : '+'}${Math.abs(p.vs.pct)}%${p.vs.approx ? ' (편도×2 추정)' : ''}` : '';
    alerts.push({ title: tag, body: `${p.title}${p.price ? `\n${F.won(p.price.amount)}${p.price.trip === 'round' ? ' 왕복' : ' 편도'}부터` : ''}${vs}`, tags: p.kind === 'card' ? 'credit_card' : 'label', click: p.link });
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
