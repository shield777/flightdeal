// [시험] 커뮤니티 출처 확인 (병합하지 않음)
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' };
async function txt(url, headers = UA) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    let t = buf.toString('utf8');
    const cs = (ct.match(/charset=([\w-]+)/i) || t.slice(0, 400).match(/encoding="([\w-]+)"|charset=["']?([\w-]+)/i) || [])
    const enc = (cs[1] || cs[2] || '').toLowerCase();
    if (/euc-kr|ks_c|cp949/.test(enc)) t = new TextDecoder('euc-kr').decode(buf);
    return { status: r.status, ct, enc, t };
  } catch (e) { return { status: 'ERR ' + e.message, t: '' }; }
}
const titles = t => [...t.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)].map(m => m[1].trim()).slice(0, 12);
(async () => {
  const rss = ['ppomppu', 'ppomppu4', 'travel', 'oversea', 'ppomppu8', 'freeboard'];
  for (const id of rss) {
    const r = await txt(`https://www.ppomppu.co.kr/rss.php?id=${id}`);
    console.log(`\n=== ppomppu rss ${id} ${r.status} ${r.enc} len=${r.t.length}`); console.log(titles(r.t).join('\n'));
    const d = r.t.match(/<pubDate>[^<]+/); console.log(d && d[0]);
  }
  const s = await txt('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu&search_type=sub_memo&keyword=%C7%D7%B0%F8%B1%C7');
  console.log(`\n=== ppomppu search 항공권 ${s.status} ${s.enc} len=${s.t.length}`);
  console.log([...s.t.matchAll(/<a href="view\.php\?id=ppomppu[^"]*no=(\d+)[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([^<]{4,120})/g)].slice(0, 15).map(m => m[1] + ' ' + m[2].trim()).join('\n'));
  const home = await txt('https://www.ppomppu.co.kr/');
  console.log(`\n=== ppomppu home ${home.status} boards:`, [...new Set([...home.t.matchAll(/zboard\.php\?id=([a-z0-9_]+)"[^>]*>([^<]{1,20})</g)].map(m => m[1] + ':' + m[2].trim()))].filter(x => /여행|항공|해외|travel|tour/i.test(x)).join(' | '));
  for (const u of ['https://www.clien.net/service/board/jirum', 'https://bbs.ruliweb.com/market/board/1020/rss', 'https://www.fmkorea.com/hotdeal']) {
    const r = await txt(u); console.log(`\n=== ${u} ${r.status} len=${r.t.length}`); console.log(titles(r.t).slice(0, 6).join('\n'));
  }
  const id = process.env.NAVER_CLIENT_ID, sec = process.env.NAVER_CLIENT_SECRET;
  console.log('\nNAVER keys:', !!id, !!sec);
  if (id && sec) for (const k of ['cafearticle', 'blog']) {
    const r = await txt(`https://openapi.naver.com/v1/search/${k}.json?query=${encodeURIComponent('항공권 특가 코드')}&display=10&sort=date`, { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': sec });
    console.log(`\n=== naver ${k} ${r.status}`); try { for (const it of JSON.parse(r.t).items) console.log(JSON.stringify(it).slice(0, 300)); } catch { console.log(r.t.slice(0, 300)); }
  }
})();
