// [시험] 특가 말 11개 묶음 검색이 검색창마다 되는지 확인 (병합하지 않음)
const C = require('./community.js'); const F = require('../js/flight-core.js');
const W = F.DEAL_SEARCH_WORDS || ['특가', '프로모션', '할인', '세일', '이벤트', '땡처리', '얼리버드', '쿠폰', '블프', '기획전', '감사제'];
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' };
const titles = x => [...x.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)].map(m => m[1]);
(async () => {
  for (const base of ['비엣젯', '에어프레미아', '일본 항공권']) {
    const orq = `${base} (${W.join(' OR ')})`, single = `${base} 특가`;
    for (const q of [single, orq]) {
      const g = await (await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}&hl=ko&gl=KR&ceid=KR:ko`, { headers: UA })).text();
      const b = await (await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=ko-KR&cc=KR`, { headers: UA })).text();
      const gt = titles(g), bt = titles(b);
      console.log(`google | ${q.slice(0, 40)} | n=${gt.length} | ${gt.slice(0, 2).join(' / ').slice(0, 120)}`);
      console.log(`bing   | ${q.slice(0, 40)} | n=${bt.length} | ${bt.slice(1, 3).join(' / ').slice(0, 120)}`);
    }
    const nq = `${base} ${W.join(' | ')}`;
    for (const q of [single, nq]) { const j = await C.naverSearch('news', { query: q, display: 30, sort: 'date' }, process.env); const t = ((j && j.items) || []).map(i => i.title.replace(/<[^>]+>/g, '')); console.log(`naver  | ${q.slice(0, 40)} | total=${j && j.total} n=${t.length} withBase=${t.filter(x => x.includes(base.split(' ')[0])).length} | ${t.slice(0, 2).join(' / ').slice(0, 120)}`); }
  }
})();
