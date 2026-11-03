// [시험] 루리웹 글 날짜 형식 확인 (병합하지 않음)
const DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
(async () => {
  const r = await fetch(`https://bbs.ruliweb.com/market/board/1020?search_type=subject&search_key=${encodeURIComponent('항공')}`, { headers: { 'User-Agent': DESK, 'Accept-Language': 'ko-KR' } });
  const t = await r.text();
  console.log('status', r.status, 'len', t.length, 'url', r.url);
  const rows = t.split(/<tr[^>]*class="table_body/).slice(1);
  console.log('rows', rows.length);
  rows.slice(0, 12).forEach((x, i) => console.log(`ROW${i}:`, x.slice(0, 1400).replace(/\s+/g, ' ')));
})();
