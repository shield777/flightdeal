#!/usr/bin/env node
/* 시험용 3차: 이벤트 목록 HTML 구조 확인 (각 주소 1번씩) */
'use strict';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' };
const get = async u => { const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(20000) }); return [r.status, await r.text()]; };
const squeeze = s => s.replace(/\s+/g, ' ');
(async () => {
  try {
    const [st, h] = await get('https://www.jejuair.net/ko/event/event.do');
    const i = h.indexOf('eventNo');
    console.log(`== 제주 ${st}\n`, squeeze(h.slice(Math.max(0, i - 1500), i + 2500)));
  } catch (e) { console.log('제주 실패', e.message); }
  try {
    const [st, h] = await get('https://www.trinityairways.com/app/promotion/event/being');
    const i = h.indexOf('지금, 제주를');
    console.log(`\n== 트리니티 ${st}\n`, squeeze(h.slice(Math.max(0, i - 2000), i + 2000)));
  } catch (e) { console.log('트리니티 실패', e.message); }
  try {
    const { chromium } = require('playwright-core');
    const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
    const p = await b.newPage({ userAgent: UA, locale: 'ko-KR' });
    const api = [];
    p.on('response', async r => { const u = r.url(); if (/vietjetcms-api/.test(u)) { let body = ''; try { body = (await r.text()).slice(0, 1500); } catch {} api.push(`${r.status()} ${u}\n     ${body}`); } });
    const cat = 'https://www.vietjetair.com/ko/news/%ED%95%A0%EC%9D%B8-1697696896010';
    await p.goto(cat, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.log('goto', e.message));
    const txt = squeeze(await p.evaluate(() => document.body.innerText));
    const links = await p.evaluate(() => [...document.querySelectorAll('a')].map(a => `${a.innerText.trim().slice(0, 60)} => ${a.href}`).filter(s => /news\//.test(s)).slice(0, 15));
    console.log(`\n== 비엣젯 할인 게시판 → ${p.url()} 글자 ${txt.length}\n  ${txt.slice(0, 1500)}\n  링크:\n   ${links.join('\n   ')}`);
    console.log('\n  CMS API:\n  ' + api.slice(0, 8).join('\n  '));
    await b.close();
  } catch (e) { console.log('비엣젯 실패', e.message); }
})();
