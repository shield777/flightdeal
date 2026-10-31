/* 항공사 공식 홈페이지의 진행 중 이벤트·특가 읽기
   GitHub 서버에서 접속 시험(2026-10-31)을 해서 열리는 곳만 넣었어요.
     제주항공(7C)   이벤트 목록 HTML        https://www.jejuair.net/ko/event/event.do
     트리니티항공(TW, 옛 티웨이) 이벤트 목록 HTML  https://www.trinityairways.com/app/promotion/event/being
     비엣젯(VJ)     한국어 '할인' 소식 게시판 (자바스크립트 화면이라 크롬으로 열어서 읽음)
   진에어·에어부산·이스타·대한항공은 보안 장치가 자동 접속을 막아서 뉴스로만 확인해요.
   사이트 구조가 바뀌면 0건이 나올 수 있어요 → 로그에 "0건(구조 바뀜?)"으로 표시. */
'use strict';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const HEAD = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' };

const decode = s => String(s || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = s => decode(String(s || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

async function getHTML(url) {
  const res = await fetch(url, { headers: HEAD, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── 트리니티항공: <a data-eventSeq data-eventTitle> … <p class="sbj_sub">부제</p> <p>2026-10-30 ~ 2026-11-30</p>
async function trinity() {
  const url = 'https://www.trinityairways.com/app/promotion/event/being';
  const html = await getHTML(url);
  const out = [];
  const re = /data-eventSeq="(\d+)"[^>]*data-eventTitle="([^"]*)"[\s\S]*?<p class="sbj_sub">([\s\S]*?)<\/p>\s*<p>\s*(\d{4})-(\d{2})-(\d{2})\s*~\s*(\d{4})-(\d{2})-(\d{2})\s*<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({ code: 'TW', key: m[1], title: decode(m[2]).trim(), sub: text(m[3]), start: ymd(m[4], m[5], m[6]), end: ymd(m[7], m[8], m[9]), link: url });
  }
  return out;
}

// ── 제주항공: 이벤트 번호(eventNo) 뒤에 제목·부제·기간(2026.10.23 ~ 2026.11.08)이 나옴
async function jeju() {
  const list = 'https://www.jejuair.net/ko/event/event.do';
  const html = await getHTML(list);
  const hits = [...html.matchAll(/eventNo\W{0,6}(\d{6,})/g)];
  const out = [], seen = new Set();
  for (let i = 0; i < hits.length; i++) {
    const no = hits[i][1];
    if (seen.has(no)) continue;
    const chunk = text(html.slice(hits[i].index, i + 1 < hits.length ? hits[i + 1].index : hits[i].index + 3000).slice(0, 3000));
    const d = chunk.match(/(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{4})\.(\d{2})\.(\d{2})/);
    if (!d) continue;
    const before = chunk.slice(0, d.index).replace(/^[^가-힣A-Za-z0-9⭐]*\d{6,}\W*/, '').trim();
    if (before.length < 3 || before.length > 150) continue;
    seen.add(no);
    out.push({ code: '7C', key: no, title: before, sub: '', start: ymd(d[1], d[2], d[3]), end: ymd(d[4], d[5], d[6]), link: `https://www.jejuair.net/ko/event/eventDetail.do?eventNo=${no}` });
  }
  return out;
}

// ── 비엣젯: 한국어 '할인' 게시판. 글마다 "제목 … 설명… 더 알아보기" 순서. 기간은 글 속 "2026년 10월 26일~2026년 11월 01일"
async function vietjet() {
  const url = 'https://www.vietjetair.com/ko/news/%ED%95%A0%EC%9D%B8-1697696896010';
  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch { throw new Error('playwright-core 없음(크롬 연결 도구)'); }
  const exe = ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium', '/usr/bin/chromium'].find(p => require('fs').existsSync(p));
  const b = await chromium.launch({ headless: true, ...(exe && !exe.includes('pw-browsers') ? { executablePath: exe } : {}) });
  try {
    const p = await b.newPage({ userAgent: UA, locale: 'ko-KR' });
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForFunction(() => document.body.innerText.includes('더 알아보기'), null, { timeout: 30000 });
    const body = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const start = body.indexOf('항공편 조회');
    const main = body.slice(start >= 0 ? start + 6 : 0).split(/핫 뉴스/)[0];
    const out = [];
    for (let part of main.split('더 알아보기')) {
      part = part.replace(/^\s*할인\s+/, '').trim();
      if (part.length < 8) continue;
      // 제목 = 첫 문장 덩어리(괄호 기간까지), 나머지는 설명
      const dates = [...part.matchAll(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g)].map(m => ymd(m[1], m[2], m[3])).sort();
      // 제목: 첫 괄호 기간 "(2026년 …)"까지 또는 앞 70자. 나머지는 설명
      const cut = part.search(/\)\s/);
      const title = (cut > 10 && cut < 110 ? part.slice(0, cut + 1) : part.slice(0, 70).replace(/\s+\S*$/, '')).trim();
      out.push({ code: 'VJ', key: title.replace(/\s+/g, '').slice(0, 40), title, sub: part.slice(title.length).trim().slice(0, 200), start: dates[0] || '', end: dates[dates.length - 1] || '', link: url });
      if (out.length >= 12) break;
    }
    return out;
  } finally { await b.close(); }
}

const ADAPTERS = { '7C': jeju, TW: trinity, VJ: vietjet };

// codes: 확인할 항공사(고른 LCC 중 지원되는 것만) → { items, report }
async function fetchAirlineEvents(codes, log = console.log) {
  const items = [], report = {};
  for (const code of codes) {
    const fn = ADAPTERS[code];
    if (!fn) continue;
    try {
      const got = await fn();
      report[code] = got.length;
      log(`  공식 ${code}: ${got.length}건${got.length ? '' : ' (0건 — 사이트 구조가 바뀌었을 수 있어요)'}`);
      items.push(...got);
    } catch (e) { report[code] = -1; log(`  공식 ${code}: 실패 (${e.message})`); }
  }
  return { items, report };
}

module.exports = { fetchAirlineEvents, SUPPORTED: Object.keys(ADAPTERS), _parse: { text } };
