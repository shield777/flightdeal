// [시험] 커뮤니티 출처 확인 3 (병합하지 않음)
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Accept-Language': 'ko-KR,ko;q=0.9' };
const get = async u => { const r = await fetch(u, { headers: UA }); return { s: r.status, t: await r.text() }; };
(async () => {
  for (const k of ['항공', '특가 항공권']) {
    const r = await get(`https://bbs.ruliweb.com/market/board/1020?search_type=subject&search_key=${encodeURIComponent(k)}`);
    const rows = r.t.split(/<tr[^>]*class="table_body[^"]*"/).slice(1);
    console.log(`=== ruliweb ${k} ${r.s} rows=${rows.length}`);
    console.log('RAW1:', rows.find(x => !/notice/.test(x.slice(0, 200)))?.replace(/\s+/g, ' ').slice(0, 1600));
    for (const x of rows) { const t = (x.match(/class="deco"[^>]*>([^<]+)/) || [])[1]; const tm = (x.match(/class="time"[^>]*>\s*([^<]+)/) || [])[1]; const h = (x.match(/href="([^"]*\/read\/\d+)/) || [])[1]; console.log(' ', (tm || '').trim(), '|', (t || '').trim(), '|', h); }
  }
  const p = await get('https://www.ppomppu.co.kr/rss.php?id=ppomppu');
  console.log('PPOMPPU ITEM RAW:', (p.t.match(/<item>[\s\S]*?<\/item>/) || [''])[0].slice(0, 1200));
  const v = await get('https://bbs.ruliweb.com/market/board/1020/read/100000');
  console.log('READ', v.s, v.t.length);
})();
