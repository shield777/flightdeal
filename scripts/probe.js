// [시험] 스카이스캐너 월별 가격 화면 캡처 (병합하지 않음)
const fs = require('fs');
(async () => {
  const { chromium } = require('playwright-core');
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
  const b = await chromium.launch({ headless: true, executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, locale: 'ko-KR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const pg = await ctx.newPage();
  const url = 'https://www.skyscanner.co.kr/transport/flights/sela/kix/2704/2704/?adultsv2=2&childrenv2=11&cabinclass=economy&rtn=1&preferdirects=true';
  try { await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) { console.log('goto', e.message); }
  await pg.waitForTimeout(12000);
  fs.mkdirSync('data', { recursive: true });
  await pg.screenshot({ path: 'data/probe-sky.png' });
  console.log('title:', await pg.title(), '| url:', pg.url());
  console.log('text:', (await pg.evaluate(() => document.body ? document.body.innerText : '')).replace(/\s+/g, ' ').slice(0, 600));
  await b.close();
})();
