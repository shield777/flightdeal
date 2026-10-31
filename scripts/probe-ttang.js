#!/usr/bin/env node
/* 시험용 2차: 땡처리닷컴 해외항공 목록 (나트랑, 오늘오픈땡처리) */
'use strict';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const sq = s => s.replace(/\s+/g, ' ');
(async () => {
  const { chromium } = require('playwright-core');
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const p = await b.newPage({ userAgent: UA, locale: 'ko-KR', viewport: { width: 400, height: 900 } });
  const reqs = [];
  p.on('response', async r => {
    const u = r.url(), t = r.request().resourceType();
    if (/ttang/.test(u) && ['xhr', 'fetch', 'document'].includes(t)) { let body = ''; try { body = sq((await r.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).slice(0, 700); } catch {} reqs.push(`${t} ${r.request().method()} ${r.status()} ${u}\n      post=${(r.request().postData() || '').slice(0, 200)}\n      ${body}`); }
  });
  const dump = async label => { await p.waitForTimeout(5000); const t = sq(await p.evaluate(() => document.body.innerText)); console.log(`\n== ${label} → ${p.url()} 글자 ${t.length}\n  ${t.slice(0, 2500)}`); };
  await p.goto('https://mm.ttang.com/ttangair/index.do', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(3000);
  const html = await p.content();
  const hits = [...html.matchAll(/(?:href|onclick)=["']([^"']*(?:CXR|나트랑|cityCd|city|ttangair)[^"']*)["']/gi)].map(m => m[1]).slice(0, 25);
  console.log('후보 링크/onclick:\n  ' + [...new Set(hits)].join('\n  '));
  try { await p.getByText('나트랑(깜란)', { exact: false }).first().click({ timeout: 8000 }); await dump('나트랑 클릭'); } catch (e) { console.log('나트랑 클릭 실패', e.message); }
  try { await p.goto('https://mm.ttang.com/ttangair/index.do', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000); await p.getByText('오늘오픈땡처리').first().click({ timeout: 8000 }); await dump('오늘오픈땡처리 클릭'); } catch (e) { console.log('오늘오픈 클릭 실패', e.message); }
  console.log('\n요청들:\n  ' + reqs.filter(x => !/\.(js|css)(\?|$)/.test(x)).slice(0, 15).join('\n  '));
  await b.close();
})().catch(e => console.log('실패', e.message));
