/* [시험] 구글 항공권 링크가 PC/휴대폰에서 검색 조건을 채운 채 열리는지 (병합하지 않음) */
'use strict';
const fs = require('fs');
const q = 'Flights from Seoul to KIX on 2026-12-10 through 2026-12-14 for 2 adults';
const { tfs } = require('./tfs-probe.js');
const G = t => `https://www.google.com/travel/flights/search?tfs=${t}&hl=ko&gl=KR&curr=KRW`;
const URLS = {
  T1_SEL_KIX_2a: G(tfs({ from: 'SEL', to: 'KIX', dep: '2026-12-10', ret: '2026-12-14', adults: 2 })),
  T2_ICN_KIX_2a1c: G(tfs({ from: 'ICN', to: 'KIX', dep: '2026-12-10', ret: '2026-12-14', adults: 2, children: 1 })),
  T3_SEL_PQC_direct: G(tfs({ from: 'SEL', to: 'PQC', dep: '2027-01-20', ret: '2027-01-25', adults: 2, children: 1, direct: true })),
  T4_SEL_OSA_city: G(tfs({ from: 'SEL', to: 'OSA', dep: '2026-12-10', ret: '2026-12-14', adults: 1 })),
};
const DEV0 = {
  pc: { viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' },
  phone: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
};
const DEV = { pc: DEV0.pc };
(async () => {
  const { chromium } = require('playwright-core');
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
  const b = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  const out = [];
  for (const [dn, dev] of Object.entries(DEV)) for (const [un, url] of Object.entries(URLS)) {
    const ctx = await b.newContext({ ...dev, locale: 'ko-KR' });
    const p = await ctx.newPage();
    const o = { dev: dn, url: un };
    try {
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await p.waitForTimeout(7000);
      o.final = p.url().slice(0, 160);
      o.title = (await p.title()).slice(0, 80);
      o.inputs = await p.$$eval('input', is => is.map(i => i.value).filter(v => v && v.length < 40).slice(0, 8));
      const t = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
      o.text = t.slice(0, 260);
      o.hasResults = /최저가|추천 항공편|가장 저렴|₩\s?\d|\d+원/.test(t);
      o.hasKIX = /오사카|KIX|간사이/.test(t);
      if (dn === 'pc' && un.startsWith('T3')) await p.screenshot({ path: `data/probe-google-${dn}-${un}.png` });
    } catch (e) { o.err = e.message.slice(0, 100); }
    console.log(JSON.stringify(o)); out.push(o);
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync('data/probe-google.json', JSON.stringify(out, null, 1));
})();
