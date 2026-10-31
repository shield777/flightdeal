#!/usr/bin/env node
/* 시험용: 땡처리닷컴 접속·구조 확인 (주소마다 1번씩만 요청) */
'use strict';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' };
const sq = s => s.replace(/\s+/g, ' ');
const strip = s => sq(s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
const KW = /베트남|일본|다낭|나트랑|푸꾸옥|호치민|하노이|오사카|도쿄|후쿠오카|삿포로|오키나와|해외|국제선|땡처리|항공/;
(async () => {
  for (const u of ['https://www.ttang.com/', 'https://ttang.com/']) {
    try {
      const r = await fetch(u, { headers: H, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      const h = await r.text();
      const t = strip(h);
      const blocked = /captcha|cf-chl|Just a moment|Access Denied|Enable JavaScript and cookies/i.test(h);
      console.log(`== fetch ${u} → ${r.status} ${r.url} ${h.length}B 글자 ${t.length}${blocked ? ' 차단 의심' : ''}`);
      console.log('  제목:', (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
      const links = [...h.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => [m[1], strip(m[2]).trim()]).filter(([href, tx]) => KW.test(tx) || /air|flight|abroad|inter|over|jp|vn/i.test(href)).slice(0, 40);
      console.log('  링크:\n   ' + links.map(([a, b]) => `${b.slice(0, 30)} => ${a}`).join('\n   '));
      console.log('  본문 앞:', t.slice(0, 1200));
      break;
    } catch (e) { console.log(`== fetch ${u} 실패 ${e.message}`); }
  }
  try {
    const { chromium } = require('playwright-core');
    const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
    const p = await b.newPage({ userAgent: UA, locale: 'ko-KR' });
    const api = [];
    p.on('response', async r => {
      const u = r.url(); const ct = r.headers()['content-type'] || '';
      if (/json|xml/.test(ct) && /ttang/.test(u)) { let body = ''; try { body = sq((await r.text()).slice(0, 500)); } catch {} api.push(`${r.status()} ${u}\n     ${body}`); }
    });
    await p.goto('https://www.ttang.com/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('goto', e.message));
    await p.waitForTimeout(6000);
    const txt = sq(await p.evaluate(() => document.body.innerText));
    const links = await p.evaluate(() => [...document.querySelectorAll('a')].map(a => [a.innerText.trim().replace(/\s+/g, ' ').slice(0, 40), a.href]).filter(([t, h]) => /베트남|일본|다낭|나트랑|오사카|후쿠오카|해외|국제선|땡처리/.test(t + h)).slice(0, 40));
    console.log(`\n== 크롬 홈 ${p.url()} 글자 ${txt.length}\n  본문 앞: ${txt.slice(0, 1500)}`);
    console.log('  링크:\n   ' + links.map(([t, h]) => `${t} => ${h}`).join('\n   '));
    // 베트남/해외 관련 첫 링크 하나만 열어 보기
    const target = (links.find(([t]) => /베트남|다낭|나트랑/.test(t)) || links.find(([t]) => /해외|국제선/.test(t)) || [])[1];
    if (target) {
      await p.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('goto2', e.message));
      await p.waitForTimeout(6000);
      const t2 = sq(await p.evaluate(() => document.body.innerText));
      console.log(`\n== 크롬 목록 ${p.url()} 글자 ${t2.length}\n  ${t2.slice(0, 2500)}`);
    }
    console.log('\n  데이터 요청(JSON/XML):\n  ' + api.slice(0, 12).join('\n  '));
    await b.close();
  } catch (e) { console.log('크롬 실패', e.message); }
})();
