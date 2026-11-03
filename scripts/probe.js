// [시험] 네이버 검색 API에서 여러 단어 OR 검색이 되는지 확인 (병합하지 않음)
const C = require('./community.js');
(async () => {
  const qs = ['비엣젯 특가', '비엣젯 할인', '비엣젯 이벤트', '비엣젯 특가 | 할인 | 이벤트', '비엣젯 (특가 | 할인 | 이벤트)', '비엣젯 특가 OR 할인 OR 이벤트'];
  for (const kind of ['news', 'cafearticle']) for (const q of qs) {
    try {
      const j = await C.naverSearch(kind, { query: q, display: 30, sort: 'date' }, process.env);
      const items = (j && j.items) || [];
      const t = items.map(i => i.title.replace(/<[^>]+>/g, ''));
      const w = k => t.filter(x => x.includes(k)).length;
      console.log(`${kind} | ${q} | total=${j && j.total} n=${items.length} 특가=${w('특가')} 할인=${w('할인')} 이벤트=${w('이벤트')} | ${t.slice(0, 3).join(' / ').slice(0, 160)}`);
    } catch (e) { console.log(kind, q, 'ERR', e.message); }
  }
})();
