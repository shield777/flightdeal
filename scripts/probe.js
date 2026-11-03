// [시험] 네이버 항공권 '추천일정' 팝업을 바로 여는 주소(쿼리)가 있는지 공개 페이지·스크립트에서 찾기 (병합하지 않음)
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Accept-Language': 'ko-KR' };
const get = async u => { try { const r = await fetch(u, { headers: UA }); return { s: r.status, t: await r.text(), u: r.url }; } catch (e) { return { s: 'ERR ' + e.message, t: '' }; } };
(async () => {
  const page = 'https://m-flight.naver.com/flights/international/ICN-KIX-20270309/KIX-ICN-20270310?adult=1&isDirect=true&fareType=Y';
  for (const u of [page, page.replace('m-flight', 'flight'), 'https://flight.naver.com/']) {
    const r = await get(u);
    const scripts = [...new Set([...r.t.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => new URL(m[1], r.u || u).href))];
    console.log(`\n== ${r.s} ${u} -> ${r.u} len=${r.t.length} scripts=${scripts.length}`);
    const kw = /추천일정|가격그래프|캘린더|recommend|priceGraph|fareCalendar|calendar|tab=|isRecommend|lowestFare|schedule/gi;
    const hits = new Map();
    for (const s of scripts.slice(0, 40)) {
      const j = await get(s);
      for (const m of j.t.matchAll(kw)) {
        const ctx = j.t.slice(Math.max(0, m.index - 70), m.index + 90).replace(/\s+/g, ' ');
        const key = m[0].toLowerCase();
        if (!hits.has(key)) hits.set(key, []);
        if (hits.get(key).length < 4) hits.get(key).push(`${s.split('/').pop().slice(0, 30)}: ${ctx}`);
      }
    }
    for (const [k, v] of hits) { console.log(`-- ${k}`); v.forEach(x => console.log('   ' + x)); }
    // 페이지 안 URL 쿼리 이름 후보
    const qs = [...new Set([...r.t.matchAll(/[?&]([a-zA-Z]{3,20})=/g)].map(m => m[1]))].slice(0, 40);
    console.log('query names in html:', qs.join(','));
  }
})();
