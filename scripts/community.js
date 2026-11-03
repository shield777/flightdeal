/* 커뮤니티 글 찾기 (GitHub 서버에서 실행)
   뉴스 기사가 안 나는 반짝 특가·할인 코드는 커뮤니티에 먼저 올라와요. 앱 프로모션 탭에 기사와 함께 항공사별로, '커뮤니티' 표시를 붙여 보여 줘요.
   - 네이버 카페 검색 (스사사·네일동 같은 여행 카페 포함): NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 이 있을 때만
     카페 검색 결과에는 글 쓴 날짜가 없어서, 최신순 검색 결과의 맨 앞만 쓰고 '처음 찾은 날'을 날짜로 써요.
   - 뽐뿌 RSS (뽐뿌게시판·해외뽐뿌·여행포럼·이벤트·쿠폰): 키 없이. 게시판마다 최신 글 십여 개만 줘서 일부만 잡혀요.
   - 루리웹 핫딜 게시판 검색 ('항공'·항공사 이름): 키 없이. 검색이라 지나간 글도 잡혀요. '[종료]' 표시된 글은 뺌.
   광고·후기·질문 글은 제목으로 걸러요. 제목에 항공사·여행사 이름과 특가 말(특가·세일·할인코드·가격 등)이 함께 있어야 해요. */
'use strict';
const F = require('../js/flight-core.js');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
// 광고·후기·질문·여행기: 제목에 있으면 뺌
const SKIP_RE = /후기|리뷰|협찬|원고료|체험단|광고|제공\s?받|질문|문의|궁금|어떤가요|어떨까요|있나요|되나요|할까요|맞나요|추천\s?(?:부탁|해\s?주)|여행기|일정\s?공유|맛집|숙소|호텔|리조트|환전|유심|이심|esim|보험|면세|렌트|렌터카|투어\s?예약|판매합니다|양도|삽니다|팝니다|구해요|구합니다|대리\s?구매|클릭\s?적립|적립금|포인트\s?적립|\d+\s?원\s?적립|\?\s*$/i;
// 감상·불만 글('특가 실화인가요', '가격 올리네요', '…잡았어요ㅋㅋ')과 제휴 링크 홍보 글('… 할인코드 바로 예약하기!', '… 총정리')
const CHAT_RE = /[ㅋㅎㅠㅜ]{2,}|실화|올리네|올렸네|별로|아쉽|비싸|잡았어요|했어요|했네요|(?:가요|나요|까요|네요|죠)\s*[.!~]*$|바로\s?예약하기|총정리|사용법|정리\s*!?$/;
// 개인이 항공권 검색 사이트에서 찾은 특정 날짜 가격 글 (항공사 프로모션이 아님 → 내 여행 날짜와 상관없음)
//  '11/29(일)~12/3(목) 4박5일', '평소 대비 -27%', '땡처리 항공권 현황', '에러페어'
const PRICE_FIND_RE = /\d{1,2}\/\d{1,2}\s*\([월화수목금토일]\)\s*[~\-–]|\d\s?박\s?\d\s?일|평소\s*(?:대비|가)|평균가|항공권\s*현황|에러\s*페어|매물/;
// 서울(인천·김포)이 아닌 곳에서 출발하는 글 ('청주→오사카', '시애틀 - 도쿄', '미국 출발')
const ROUTE_RE = /([가-힣A-Za-z]{2,10})\s*(?:→|->|\s-\s)\s*[가-힣A-Za-z]{2,}/;
const notFromSeoul = t => F.nonSeoulOnly(t) || /(?:미국|유럽|해외|현지|일본)\s*출발/.test(t) || (() => { const m = t.match(ROUTE_RE); return !!m && !/인천|서울|김포|ICN|GMP|SEL/i.test(m[1]); })();
// 광고성 카페 (체험단·기자단 등)
const AD_SOURCE_RE = /체험단|기자단|서포터즈|홍보|원고/;
// 뽐뿌 게시판 (RSS 주소의 id)
const PPOMPPU = { ppomppu: '뽐뿌게시판', ppomppu4: '해외뽐뿌', tour: '여행포럼', event: '이벤트게시판', coupon: '쿠폰게시판' };

// 루리웹 핫딜 검색어 ('항공'으로 대부분 잡히고, 이름에 '항공'이 없는 곳은 따로)
const RULIWEB_KEYS = ['항공', '진에어', '티웨이', '에어서울', '에어부산', '에어아시아', '비엣젯', '트립닷컴'];

// 제목만 보고 항공권 특가 글인지 — 뉴스와 같은 기준 + 커뮤니티만의 기준(광고·후기·질문·감상, 특정 날짜 가격 글, 서울 아닌 출발, 옛 글)
function isDealTitle(title) {
  const t = F.stripTags(title);
  if (t.length < 6 || SKIP_RE.test(t) || CHAT_RE.test(t) || PRICE_FIND_RE.test(t) || notFromSeoul(t)) return false;
  // 제목에 지난해 이전 연도가 적힌 옛 글 ('[2014/1116] …') — 카페 검색은 날짜가 없어서 옛 글이 섞여 들어옴
  const thisYear = new Date().getFullYear();
  if ([...t.matchAll(/(?:^|\D)(20\d{2})(?=[\/.년\s-]|\d{4}\])/g)].some(m => Number(m[1]) < thisYear)) return false;
  // 적혀 있는 금액이 모두 1~999원이면 항공권 특가가 아님 (예: '[네이버페이] 제주항공 12원' 클릭 적립)
  //  0원은 뺌: 비엣젯 '0원 항공권'처럼 운임 0원 이벤트가 있음
  const won = [...t.matchAll(/(\d[\d,]*)\s?(만\s?)?원/g)].map(m => Number(m[1].replace(/,/g, '')) * (m[2] ? 10000 : 1));
  if (won.length && won.every(n => n >= 1 && n < 1000)) return false;
  // 뉴스와 같은 제목 기준 (js/flight-core.js promoTitleCheck): 문제·경영 / 다른 상품 제외, 주제어 + 특가 말이 제목에
  return F.promoTitleCheck(t, { airlineOnly: true }).ok; // ③은 항공사 이름만
}

// 제목 앞 날짜 ('[11/3 19시] …', '[G클럽] [26.10.29 08시] …') → 그 날 (한국 시각 정오). 없으면 null
//  네이버 카페 글은 날짜가 없어서, 제목에 날짜가 있으면 그걸 씀 (10일 지난 글은 앱에 안 들어감)
function titleDate(title, now) {
  const m = String(title).match(/^\s*(?:\[[^\]\d]{1,10}\]\s*)?\[\s*(?:(\d{2}|\d{4})\.)?(\d{1,2})[\/.](\d{1,2})\b/);
  if (!m) return null;
  const mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const kst = new Date(now.getTime() + 9 * 3600e3);
  let y = m[1] ? Number(m[1].length === 2 ? `20${m[1]}` : m[1]) : kst.getUTCFullYear();
  if (!m[1] && mo > kst.getUTCMonth() + 2) y -= 1; // 1월에 '[12/30 …]' → 작년
  const t = new Date(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00+09:00`);
  return isNaN(t) ? null : t;
}
// 검색 결과 요약은 끝이 잘려 있어요('최대 14,000원...'). 잘린 마지막 문장은 버림 (잘린 금액을 가격으로 읽지 않게)
function cleanDesc(desc) {
  let d = String(desc || '').trim();
  if (/(?:\.\.\.|…)$/.test(d)) {
    d = d.replace(/\s*(?:\.\.\.|…)$/, '');
    const ends = [...d.matchAll(/(?:다\.|요\.|(?<!\.)[.!?](?!\.))(?=\s|$)/g)]; // '중...' 같은 말줄임은 문장 끝이 아님
    d = ends.length ? d.slice(0, ends[ends.length - 1].index + ends[ends.length - 1][0].length) : '';
  }
  // 마침표 없이 끝나면 붙임 (제목과 한 문장으로 이어져 '탑승기간'이 예약기간으로 잘못 읽히지 않게)
  return d && !/[.!?。…]$/.test(d) ? `${d}.` : d;
}
// 글 하나를 쓸지 (제목 + 출처 카페 이름)
const keepPost = it => isDealTitle(it.title) && !AD_SOURCE_RE.test(it.source || '');

// 커뮤니티 검색어: 나라마다 1개 + 그 나라 항공사 몇 곳 + 공통 (뉴스보다 적게)
function communityQueries(countries, airlinesOf) {
  const qs = new Set(['항공권 할인코드', '항공권 프로모션 코드', '항공 타임세일', '항공권 특가 오픈']);
  for (const c of countries) {
    qs.add(`${c} 항공권 특가`);
    // 항공사마다 '특가'와 '할인' 두 가지로 검색 ('특가' 없이 '할인·프로모션'만 쓴 글도 잡히게)
    for (const a of airlinesOf(c).slice(0, countries.length > 1 ? 3 : 6)) { qs.add(`${a} 특가`); qs.add(`${a} 할인`); }
  }
  return [...qs];
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', ...headers }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.subarray(0, 600).toString('latin1');
  const euc = /euc-?kr|ks_c_5601|cp949/i.test((res.headers.get('content-type') || '') + head);
  return new TextDecoder(euc ? 'euc-kr' : 'utf-8').decode(buf);
}

// 네이버 검색 API. 2026.7.31부터 새 키는 NAVER API HUB(네이버 클라우드)에서만 발급 → 주소·헤더 이름이 바뀜
//  새 주소(API HUB)를 먼저 쓰고, 안 되면 예전 개발자센터 주소(예전에 받은 키). 처음 성공한 방식을 기억
//  kind: 'cafearticle' | 'news' … / 결과 형식(items: title·link·description …)은 둘이 같음
let naverMode = null;
async function naverSearch(kind, params, env) {
  const id = env.NAVER_CLIENT_ID, secret = env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return null;
  const qs = new URLSearchParams(params).toString();
  const tries = [
    ['hub', `https://naverapihub.apigw.ntruss.com/search/v1/${kind}?${qs}&format=json`, { 'X-NCP-APIGW-API-KEY-ID': id, 'X-NCP-APIGW-API-KEY': secret }],
    ['old', `https://openapi.naver.com/v1/search/${kind}.json?${qs}`, { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }],
  ].filter(t => !naverMode || t[0] === naverMode);
  let err;
  for (const [mode, url, headers] of tries) {
    try { const j = JSON.parse(await fetchText(url, headers)); naverMode = mode; return j; } catch (e) { err = new Error(`${mode} ${e.message}`); }
  }
  throw err;
}

// 네이버 카페 검색 (키가 있을 때만). 결과: [{ title, link, desc, source, date }]
async function naverCafe(q, env, now) {
  const j = await naverSearch('cafearticle', { query: q, display: 20, sort: 'date' }, env);
  const items = ((j && j.items) || []);
  // 날짜가 없어서 최신순 앞쪽 10개만 (오래된 글이 '오늘 찾은 글'로 들어오지 않게)
  return items.slice(0, 10).map(it => ({ title: F.stripTags(it.title), link: it.link, desc: F.stripTags(it.description), source: `네이버 카페 · ${F.stripTags(it.cafename || '카페')}`, date: now.toISOString(), dateFound: true }));
}

// 뽐뿌 게시판 RSS
async function ppomppu(id) {
  const xml = await fetchText(`https://www.ppomppu.co.kr/rss.php?id=${id}`);
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const x = m[1], tag = n => { const r = x.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)); return r ? r[1].replace(/^<!\[CDATA\[|\]\]>$/g, '') : ''; };
    const d = new Date(tag('pubDate'));
    if (isNaN(d)) continue;
    out.push({ title: F.stripTags(tag('title')), link: F.stripTags(tag('link')).replace(/^http:/, 'https:'), desc: F.stripTags(tag('description')), source: `뽐뿌 · ${PPOMPPU[id]}`, date: d.toISOString() });
  }
  return out;
}

// 루리웹 핫딜 게시판 검색 (한 화면 30여 개, 최신 순). 날짜: 오늘 글은 '18:20', 지난 글은 '2026.10.22' (한국 시각)
async function ruliweb(key, now) {
  const html = await fetchText(`https://bbs.ruliweb.com/market/board/1020?search_type=subject&search_key=${encodeURIComponent(key)}`);
  const kstToday = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const out = [];
  for (const row of html.split(/<tr[^>]*class="table_body/).slice(1)) {
    if (!/^\s*blocktarget"/.test(row)) continue; // 공지·BEST(검색과 상관없이 위에 붙는 글) 제외
    if (/\[종료\]/.test(row)) continue; // 글쓴이가 끝났다고 표시한 특가
    const a = row.match(/<a class="subject_link deco" href="([^"]+)"[^>]*>([\s\S]*?)(?:<span class="num_reply|<\/a>)/);
    const tm = (row.match(/<td class="time">\s*([^<]+?)\s*<\/td>/) || [])[1] || '';
    if (!a) continue;
    let day = '', hm = '12:00';
    const d = tm.match(/(\d{4})\.(\d{2})\.(\d{2})/), h = tm.match(/^(\d{1,2}):(\d{2})$/);
    if (d) day = `${d[1]}-${d[2]}-${d[3]}`;
    else if (h) { day = kstToday; hm = `${h[1].padStart(2, '0')}:${h[2]}`; }
    if (!day) continue;
    const date = new Date(`${day}T${hm}:00+09:00`);
    if (isNaN(date)) continue;
    out.push({ title: F.stripTags(a[2]), link: a[1].replace(/\?.*$/, ''), desc: '', source: '루리웹 · 핫딜', date: date.toISOString() });
  }
  return out;
}

// 모든 커뮤니티 글 → 항공권 특가 글만. report: 출처별 건수 (기록용)
async function fetchCommunity({ countries, airlinesOf, env, now, log, mock }) {
  const report = { naver: 0, ppomppu: 0, ruliweb: 0, kept: 0, fail: 0 };
  const raw = mock ? [...mock] : [];
  const hasNaver = !mock && !!(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET);
  if (hasNaver) {
    for (const q of communityQueries(countries, airlinesOf)) {
      try { const l = await naverCafe(q, env, now); report.naver += l.length; raw.push(...l.map(it => ({ ...it, query: q }))); } catch (e) { report.fail++; report.err = e.message; }
      await new Promise(r => setTimeout(r, 150));
    }
  }
  if (!mock) for (const id of Object.keys(PPOMPPU)) {
    try { const l = await ppomppu(id); report.ppomppu += l.length; raw.push(...l); } catch (e) { report.fail++; }
  }
  if (!mock) for (const key of RULIWEB_KEYS) {
    try { const l = await ruliweb(key, now); report.ruliweb += l.length; raw.push(...l); } catch (e) { report.fail++; }
    await new Promise(r => setTimeout(r, 300));
  }
  const seen = new Set();
  const items = raw.filter(it => {
    const k = it.link.replace(/[?#].*$/, '');
    if (seen.has(k) || !keepPost(it)) return false;
    seen.add(k); return true;
  }).map(it => {
    const td = it.dateFound ? titleDate(it.title, now) : null;
    return { ...it, desc: cleanDesc(it.desc), ...(td ? { date: td.toISOString(), dateFound: false } : {}) };
  });
  report.kept = items.length;
  log(`■ 커뮤니티: 네이버 카페 ${hasNaver ? `${report.naver}건${naverMode ? ` (${naverMode === 'hub' ? 'API HUB' : '예전 개발자센터'} 방식)` : ''}${report.err ? ` · 오류: ${report.err}` : ''}` : '건너뜀(네이버 키 없음)'} · 뽐뿌 ${report.ppomppu}건 · 루리웹 ${report.ruliweb}건 → 항공권 특가 글 ${items.length}건${report.fail ? ` · 실패 ${report.fail}번` : ''}`);
  return { items, report };
}

module.exports = { fetchCommunity, isDealTitle, keepPost, cleanDesc, titleDate, communityQueries, ruliweb, naverSearch };
