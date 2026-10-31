#!/usr/bin/env node
/* 시험용 2차: 제주항공·트리니티항공 이벤트 목록 구조, 비엣젯은 크롬으로 열어 보기 (각 주소 1번씩) */
'use strict';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' };
const strip = s => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
async function get(url, opt = {}) {
  const res = await fetch(url, { headers: { ...H, ...(opt.headers || {}) }, method: opt.method || 'GET', body: opt.body, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  return { status: res.status, url: res.url, text: await res.text() };
}
function show(r, label) {
  console.log(`\n== ${label}: ${r.status} ${r.url} ${r.text.length}B`);
  const urls = [...new Set([...r.text.matchAll(/["'](\/[a-zA-Z0-9_\/.-]*(?:event|Event|promo|Promo)[a-zA-Z0-9_\/.-]*)["']/g)].map(m => m[1]))].slice(0, 30);
  console.log('  경로들:', urls.join('  '));
  const det = [...r.text.matchAll(/eventNo=(\d+)/g)].map(m => m[1]);
  console.log('  eventNo:', [...new Set(det)].slice(0, 20).join(','));
  const t = strip(r.text);
  const i = t.search(/진행중|진행 중|이벤트/);
  console.log('  본문 일부:', t.slice(Math.max(0, i - 100), i + 1500));
}
(async () => {
  try { show(await get('https://www.jejuair.net/ko/event/event.do'), '제주 event.do'); } catch (e) { console.log('제주 실패', e.message); }
  await new Promise(r => setTimeout(r, 1000));
  try { show(await get('https://www.trinityairways.com/app/promotion/event/being'), '트리니티 being'); } catch (e) { console.log('트리니티 실패', e.message); }
  await new Promise(r => setTimeout(r, 1000));
  // 비엣젯: 실제 크롬으로 열기 (러너에 설치된 크롬 사용)
  try {
    const { chromium } = require('playwright-core');
    const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
    const p = await b.newPage({ userAgent: UA, locale: 'ko-KR' });
    const api = [];
    p.on('response', r => { const u = r.url(); if (/promo|news|article|campaign|banner|sale/i.test(u) && !/\.(png|jpe?g|webp|svg|css|woff2?)(\?|$)/i.test(u)) api.push(`${r.status()} ${u}`); });
    for (const u of ['https://www.vietjetair.com/ko', 'https://www.vietjetair.com/ko/pages/promotions']) {
      await p.goto(u, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.log('  goto', e.message));
      const txt = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
      const links = await p.evaluate(() => [...document.querySelectorAll('a')].map(a => a.href).filter(h => /promo|sale|news|uu-dai|khuyen/i.test(h)).slice(0, 20));
      console.log(`\n== 비엣젯(크롬) ${u} → ${p.url()} 글자 ${txt.length}`);
      console.log('  링크:', [...new Set(links)].join('  '));
      const i = txt.search(/특가|프로모션|할인|SALE/i);
      console.log('  본문 일부:', txt.slice(Math.max(0, i - 200), i + 1200));
    }
    console.log('\n  비엣젯 데이터 요청:', api.slice(0, 25).join('\n   '));
    await b.close();
  } catch (e) { console.log('비엣젯 크롬 실패', e.message); }
})();
