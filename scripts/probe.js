// [시험] 커뮤니티 출처 확인 2 (병합하지 않음)
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Accept-Language': 'ko-KR,ko;q=0.9' };
async function txt(url) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
    const buf = Buffer.from(await r.arrayBuffer());
    let t = buf.toString('utf8');
    if (/euc-kr/i.test((r.headers.get('content-type') || '') + t.slice(0, 300))) t = new TextDecoder('euc-kr').decode(buf);
    return { status: r.status, t };
  } catch (e) { return { status: 'ERR ' + e.message, t: '' }; }
}
const titles = t => [...t.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)].map(m => m[1].trim());
const grepFly = l => l.filter(x => /항공|비행|트립닷컴|아고다|익스피디아|클룩|스카이스캐너|에어|제주|진에어|티웨이|피치|비엣젯|세부퍼시픽|스쿠트|여행/.test(x));
(async () => {
  for (const id of ['ppomppu2','ppomppu3','ppomppu5','ppomppu6','ppomppu7','ppomppu9','coupon','event','tour','travel_info','oversea2','pmarket']) {
    const r = await txt(`https://www.ppomppu.co.kr/rss.php?id=${id}`);
    const l = titles(r.t);
    console.log(`=== ppomppu ${id} ${r.status} n=${l.length} | ${l[0] || ''}`); console.log('  ' + grepFly(l.slice(1)).join('\n  '));
  }
  const q = encodeURIComponent('항공권');
  for (const u of [
    `https://www.clien.net/service/search/board/jirum?sk=title&sv=${q}`,
    `https://www.clien.net/service/board/jirum?&od=T31&category=0&po=0`,
    `https://bbs.ruliweb.com/market/board/1020?search_type=subject&search_key=${q}`,
    `https://www.bing.com/search?q=${encodeURIComponent('site:ppomppu.co.kr 항공권 특가')}&format=rss&setlang=ko-KR&cc=KR`,
    `https://www.bing.com/search?q=${encodeURIComponent('site:cafe.naver.com 항공권 특가 코드')}&format=rss&setlang=ko-KR&cc=KR`,
    `https://m.ppomppu.co.kr/new/bbs_list.php?id=ppomppu&search_type=sub_memo&keyword=${encodeURIComponent('항공')}`,
  ]) {
    const r = await txt(u);
    console.log(`\n=== ${u.slice(0, 90)} ${r.status} len=${r.t.length}`);
    const l = titles(r.t); if (l.length > 2) { console.log('  ' + l.slice(0, 10).join('\n  ')); const d = r.t.match(/<pubDate>[^<]+/g); console.log(d && d.slice(0, 5).join(' ')); continue; }
    const subj = [...r.t.matchAll(/class="(?:subject_fixed|list_subject|subject_link|deco|title_link)[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([^<]{4,120})/g)].map(m => m[1].trim());
    console.log('  ' + subj.slice(0, 12).join('\n  '));
    if (!subj.length) console.log(r.t.replace(/\s+/g, ' ').slice(0, 300));
  }
})();
