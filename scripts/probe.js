/* [시험] 항공사 홈페이지·이벤트 게시판이 자동으로 읽히는지 확인 (병합하지 않음)
   공개 페이지만, robots.txt 확인, 사이트당 몇 번만 접속 */
'use strict';
const fs = require('fs');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const SITES = [
  ['7C 제주항공', 'https://www.jejuair.net/ko/main/base/index.do'],
  ['TW 트리니티', 'https://www.trinityairways.com/'],
  ['RS 에어서울', 'https://flyairseoul.com/'],
  ['YP 에어프레미아', 'https://www.airpremia.com/'],
  ['WA 파라타항공', 'https://www.parataair.com/'],
  ['OZ 아시아나', 'https://flyasiana.com/'],
  ['LJ 진에어', 'https://www.jinair.com/'],
  ['BX 에어부산', 'https://www.airbusan.com/'],
  ['ZE 이스타', 'https://www.eastarjet.com/'],
  ['KE 대한항공', 'https://www.koreanair.com/'],
  ['MM 피치', 'https://www.flypeach.com/ko'],
  ['ZG 집에어', 'https://www.zipair.net/ko'],
  ['5J 세부퍼시픽', 'https://www.cebupacificair.com/ko-KR'],
  ['AK 에어아시아', 'https://www.airasia.com/ko/kr'],
  ['TR 스쿠트', 'https://www.flyscoot.com/ko'],
  ['UO 홍콩익스프레스', 'https://www.hkexpress.com/ko-kr/'],
  ['IT 타이거에어', 'https://www.tigerairtw.com/ko-kr'],
  ['VN 베트남항공', 'https://www.vietnamairlines.com/kr/ko/home'],
  ['PR 필리핀항공', 'https://www.philippineairlines.com/'],
  ['TG 타이항공', 'https://www.thaiairways.com/ko-kr/'],
  ['NX 에어마카오', 'https://www.airmacau.com.mo/'],
  ['VJ 비엣젯', 'https://www.vietjetair.com/ko'],
];
const BLOCK = /captcha|access denied|request unsuccessful|incapsula|cf-chl|just a moment|attention required|bot detection|are you a robot|px-captcha|pardon our interruption|blocked|차단/i;
const EVT = /event|promo|promotion|deal|sale|special|offer|이벤트|프로모션|특가|할인/i;
const short = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);

async function robots(u) {
  try {
    const r = await fetch(new URL('/robots.txt', u), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return `robots ${r.status}`;
    const t = await r.text();
    // User-agent: * 묶음의 Disallow 만 요약
    const lines = t.split(/\r?\n/); let star = false; const dis = [];
    for (const l of lines) {
      const m = l.match(/^\s*([\w-]+)\s*:\s*(.*)$/); if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === 'user-agent') star = v === '*';
      else if (star && k === 'disallow' && v) dis.push(v);
    }
    return `Disallow(*): ${dis.slice(0, 12).join(' ') || '없음'}`;
  } catch (e) { return `robots 실패 ${e.message}`; }
}
async function plain(u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    const title = (t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    const links = [...t.matchAll(/href="([^"#]+)"/g)].map(m => m[1]).filter(h => EVT.test(h)).slice(0, 6);
    return { status: r.status, len: t.length, title: short(title), block: BLOCK.test(t.slice(0, 5000)), links };
  } catch (e) { return { err: e.message }; }
}
(async () => {
  const { chromium } = require('playwright-core');
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
  const b = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  const out = [];
  for (const [name, url] of SITES) {
    const o = { name, url, robots: await robots(url), plain: await plain(url) };
    const p = await b.newPage({ userAgent: UA, locale: 'ko-KR' });
    try {
      const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await p.waitForTimeout(6000);
      const txt = await p.evaluate(() => document.body ? document.body.innerText : '');
      const links = await p.$$eval('a[href]', as => as.map(a => [a.innerText.replace(/\s+/g, ' ').trim().slice(0, 30), a.href]));
      const ev = [...new Map(links.filter(([t, h]) => /event|promo|promotion|deal|sale|offer|이벤트|프로모션|특가|할인/i.test(t + ' ' + h) && h.startsWith('http')).map(x => [x[1], x])).values()].slice(0, 8);
      o.chrome = { status: r && r.status(), title: short(await p.title()), len: txt.length, block: BLOCK.test(txt.slice(0, 3000)), text: short(txt), ev };
      // 이벤트처럼 보이는 링크 1~2개 열어 보기
      o.evPages = [];
      for (const [t, h] of ev.slice(0, 2)) {
        try {
          const r2 = await p.goto(h, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await p.waitForTimeout(6000);
          const t2 = await p.evaluate(() => document.body ? document.body.innerText : '');
          const dates = (t2.match(/20\d\d[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/g) || []).length;
          o.evPages.push({ link: h, label: t, status: r2 && r2.status(), len: t2.length, block: BLOCK.test(t2.slice(0, 3000)), dates, sample: short(t2.replace(/\s+/g, ' ').slice(0, 300)) });
        } catch (e) { o.evPages.push({ link: h, err: e.message.slice(0, 80) }); }
      }
    } catch (e) { o.chrome = { err: e.message.slice(0, 100) }; }
    await p.close();
    console.log(JSON.stringify(o));
    out.push(o);
  }
  await b.close();
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/probe-airlines.json', JSON.stringify(out, null, 1));
})();
