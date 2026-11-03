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
// 여행사·예약 사이트 (항공사 이름이 없어도 이 이름이 있으면 항공권 소식일 수 있음)
const AGENCY_RE = /트립닷컴|아고다|익스피디아|클룩|마이리얼트립|인터파크|하나투어|모두투어|노랑풍선|땡처리닷컴|스카이스캐너|네이버\s?항공|온라인투어|웹투어|와그|트립비토즈/;
// 특가 말: 이게 하나도 없으면 특가 글이 아님
const DEAL_RE = /특가|할인|초특가|세일|sale|할인\s?코드|프로모\s?코드|프로모션\s?코드|코드\s?공유|쿠폰|땡처리|반값|타임\s?딜|타임\s?세일|얼리버드|선착순|\d[\d,.]*\s?(?:만\s?)?원|\d+\s?%/i;
// 광고·후기·질문·여행기: 제목에 있으면 뺌
const SKIP_RE = /후기|리뷰|협찬|원고료|체험단|광고|제공\s?받|질문|문의|궁금|어떤가요|어떨까요|있나요|되나요|할까요|맞나요|추천\s?(?:부탁|해\s?주)|여행기|일정\s?공유|맛집|숙소|호텔|리조트|환전|유심|이심|esim|보험|면세|렌트|렌터카|투어\s?예약|판매합니다|양도|삽니다|팝니다|구해요|구합니다|대리\s?구매|클릭\s?적립|적립금|포인트\s?적립|\d+\s?원\s?적립|\?\s*$/i;
// 뽐뿌 게시판 (RSS 주소의 id)
const PPOMPPU = { ppomppu: '뽐뿌게시판', ppomppu4: '해외뽐뿌', tour: '여행포럼', event: '이벤트게시판', coupon: '쿠폰게시판' };

// 루리웹 핫딜 검색어 ('항공'으로 대부분 잡히고, 이름에 '항공'이 없는 곳은 따로)
const RULIWEB_KEYS = ['항공', '진에어', '티웨이', '에어서울', '에어부산', '에어아시아', '비엣젯', '트립닷컴'];

// 제목만 보고 항공권 특가 글인지
function isDealTitle(title) {
  const t = F.stripTags(title);
  if (t.length < 6 || SKIP_RE.test(t) || !DEAL_RE.test(t)) return false;
  // 적혀 있는 금액이 모두 1,000원 미만이면 항공권 특가가 아님 (예: '[네이버페이] 제주항공 12원' 클릭 적립)
  const won = [...t.matchAll(/(\d[\d,]*)\s?(만\s?)?원/g)].map(m => Number(m[1].replace(/,/g, '')) * (m[2] ? 10000 : 1));
  if (won.length && won.every(n => n < 1000)) return false;
  return F.airlineInText(t).length > 0 || AGENCY_RE.test(t) || /항공권|항공\s?특가|비행기\s?표|왕복|편도|국제선/.test(t);
}

// 커뮤니티 검색어: 나라마다 1개 + 그 나라 항공사 몇 곳 + 공통 (뉴스보다 적게)
function communityQueries(countries, airlinesOf) {
  const qs = new Set(['항공권 할인코드', '항공권 프로모션 코드', '항공 타임세일', '항공권 특가 오픈']);
  for (const c of countries) {
    qs.add(`${c} 항공권 특가`);
    for (const a of airlinesOf(c).slice(0, countries.length > 1 ? 3 : 6)) qs.add(`${a} 특가`);
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

// 네이버 카페 검색 (키가 있을 때만). 결과: [{ title, link, desc, source, date }]
async function naverCafe(q, env, now) {
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) return [];
  const t = await fetchText(`https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(q)}&display=20&sort=date`, {
    'X-Naver-Client-Id': env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
  });
  const items = (JSON.parse(t).items || []);
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
      try { const l = await naverCafe(q, env, now); report.naver += l.length; raw.push(...l.map(it => ({ ...it, query: q }))); } catch (e) { report.fail++; }
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
    if (seen.has(k) || !isDealTitle(it.title)) return false;
    seen.add(k); return true;
  }).map(it => {
    // 커뮤니티 요약은 마침표 없이 끝나는 경우가 많아요. 그대로 두면 제목과 한 문장으로 이어져 '탑승기간'이 예약기간으로 잘못 읽힘
    const d = String(it.desc || '').trim();
    return { ...it, desc: d && !/[.!?。…]$/.test(d) ? `${d}.` : d };
  });
  report.kept = items.length;
  log(`■ 커뮤니티: 네이버 카페 ${hasNaver ? `${report.naver}건` : '건너뜀(네이버 키 없음)'} · 뽐뿌 ${report.ppomppu}건 · 루리웹 ${report.ruliweb}건 → 항공권 특가 글 ${items.length}건${report.fail ? ` · 실패 ${report.fail}번` : ''}`);
  return { items, report };
}

module.exports = { fetchCommunity, isDealTitle, communityQueries, ruliweb };
