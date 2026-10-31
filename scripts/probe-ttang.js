#!/usr/bin/env node
/* 시험용 3차: 땡처리닷컴 PC 사이트 '오늘오픈 땡처리' (주소마다 1번씩) */
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sq = s => s.replace(/\s+/g, ' ');
const strip = s => sq(s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
(async () => {
  // 1) 크롬으로 PC 사이트를 열고, '오늘오픈 땡처리' 메뉴를 눌러 목록과 데이터 요청을 기록
  const { chromium } = require('playwright-core');
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx = await b.newContext({ userAgent: UA, locale: 'ko-KR', viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Seoul' });
  const p = await ctx.newPage();
  const reqs = [];
  p.on('response', async r => {
    const u = r.url(), t = r.request().resourceType();
    if (/ttang/.test(u) && ['xhr', 'fetch', 'document'].includes(t)) { let body = ''; try { body = strip(await r.text()).slice(0, 600); } catch {} reqs.push(`${t} ${r.request().method()} ${r.status()} ${u}\n      post=${(r.request().postData() || '').slice(0, 300)}\n      ${body}`); }
  });
  await p.goto('https://www.ttang.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(4000);
  console.log('홈 →', p.url());
  if (/mm\.ttang/.test(p.url())) {
    const pc = await p.evaluate(() => (([...document.querySelectorAll('a')].find(a => /PC버전/.test(a.innerText)) || {}).href || ''));
    console.log('PC버전 링크:', pc);
    try { await p.getByText('PC버전').first().click({ timeout: 8000 }); await p.waitForTimeout(4000); } catch (e) { console.log('PC버전 클릭 실패', e.message); }
    console.log('PC버전 후 →', p.url());
  }
  const links = await p.evaluate(() => [...document.querySelectorAll('a')].map(a => [a.innerText.replace(/\s+/g, ' ').trim().slice(0, 30), a.href, a.getAttribute('onclick') || '']).filter(([t]) => /오늘오픈|3일 이내|나트랑|땡처리항공/.test(t)).slice(0, 15));
  console.log('메뉴 링크:\n  ' + links.map(x => x.join(' | ')).join('\n  '));
  try { await p.getByText('오늘오픈').first().click({ timeout: 8000 }); await p.waitForTimeout(7000); } catch (e) { console.log('오늘오픈 클릭 실패', e.message); }
  const t = sq(await p.evaluate(() => document.body.innerText));
  const i = t.indexOf('오늘오픈');
  console.log(`\n== 오늘오픈 → ${p.url()} 글자 ${t.length}\n  ${t.slice(Math.max(0, i), i + 2500)}`);
  console.log('\n요청들:\n  ' + reqs.filter(x => !/\.(js|css|png|jpg|gif)(\?|$)/.test(x)).slice(-10).join('\n  '));
  // 2) 같은 목록 주소를 크롬 없이 그냥 요청했을 때
  const html = await p.content();
  console.log('\n현재 페이지 HTML 안에 운임 표가 들어 있나:', /예약하기/.test(html) ? '예 (HTML에 있음)' : '아니오');
  await b.close();
  try {
    const r = await fetch('https://www.ttang.com/ttangair/search/discount/today.do?trip=RT&gubun=T', { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR' } });
    const h = await r.text();
    console.log(`\n== 그냥 요청 today.do → ${r.status} ${r.url} ${h.length}B 예약하기:${(h.match(/예약하기/g) || []).length}개\n  ${strip(h).slice(0, 800)}`);
  } catch (e) { console.log('그냥 요청 실패', e.message); }
})().catch(e => console.log('실패', e.message));
