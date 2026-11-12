/* AI 판독 (DeepSeek): 새로 들어온 뉴스·커뮤니티 글을 AI가 읽고 정리
   - 진짜 항공권 운임 특가인지, 항공사, 특가 이름, 예약기간·탑승기간, 최저가, 최대 할인율
   - 결과는 글마다 p.ai 에 저장 (한 번 판독한 글은 다시 보내지 않음)
   - 앱 화면·같은 소식 묶기·알림에 AI 판단이 우선 (js/flight-core.js 의 isWantedPromo·withAi). 판독 안 된 글은 규칙대로
   - 규칙 판단과 다른 점은 data/ai-check.json 에 남김 (확인용)
   - GitHub Secrets 의 DEEPSEEK_API_KEY 가 없으면 아무것도 안 하고 넘어감 (지금 방식 그대로)
   - 안전장치: 한 번 실행에 최대 MAX_PER_RUN 건(300), 키 오류·잔액 부족이면 바로 멈춤, 연속 실패 5번이면 멈춤 */
'use strict';
const F = require('../js/flight-core.js');

const MAX_PER_RUN = 300;
const AI_VERSION = 2; // 질문(프롬프트)을 크게 바꾸면 올림 → 다시 판독
const BASE = (process.env.DEEPSEEK_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
let model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
let useThinkingOff = true;

const SYSTEM = `너는 한국에 사는 여행자를 위해 항공권 특가 소식을 골라 주는 도우미야.
글 1건(뉴스 기사 또는 커뮤니티 글)을 읽고 JSON 하나로만 답해. 설명이나 다른 글자는 쓰지 마.

[1] fare_promo — 이 글이 "지금 예약할 수 있는 항공권 운임 할인" 소식인가?
true 로 보는 것
- 항공사의 특가·프로모션·얼리버드·타임세일·할인코드·1+1·동반자 할인 등 항공권 운임이 싸지는 소식
- 항공사 항공권을 특정 결제수단(카카오페이·네이버페이·카드)으로 사면 즉시 할인되는 소식
- 여행사·예약 사이트의 "항공권" 할인 쿠폰·특가 (항공권이 중심일 때)
- 새 노선 취항·재취항과 함께 내놓은 특가 운임
- 커뮤니티 글: 제목에 항공사 이름과 특가·프로모션이 있으면, 질문·공유 형식이어도 실제 진행 중인 프로모션을 알려 주는 글이면 true
  (예: "에어마카오 1+1 프로모션 가입해야 하나요?" → 프로모션이 진행 중이라는 정보라 true)
false 로 보는 것
- 항공권이 경품·사은품일 뿐인 행사 (면세점·백화점·카드사·쇼핑몰 이벤트에서 항공권 추첨·증정)
- 호텔·패키지·에어텔·골프텔·투어가 중심인 상품, 숙박 할인 결합
- 항공사 이름만 빌린 다른 상품 (유모차·굿즈·기내식 판매, 항공기 모형, 콜라보 상품)
- 카드 신상품 출시, 포인트 적립·마일리지 적립·마일리지 항공권
- 환불·피해·지연·결항·실적·주가·인사·논란 기사, 가격 추이·분석·전망 기사, 서비스·앱 기능 소개 기사
- 개인이 직접 검색해서 찾은 가격 공유("○월 ○일 출발 ○○만원 나왔어요"), 발권 후기, 쿠폰 교환·구함 글, 광고·체험단
- 이미 끝난 특가를 돌아보는 글
애매하면: 항공권 운임이 싸지는 이야기가 글의 중심이면 true, 곁가지면 false.

[2] seoul_departure — 인천·김포 출발로 이용할 수 있나?
- true: 인천·김포 출발 노선이 적혀 있거나, "전 노선·국제선 전체"처럼 서울 출발이 당연히 포함될 때
- false: 부산·대구·청주·무안·양양·제주 등 지방 공항 출발 노선만 적혀 있고 서울 출발 이야기가 전혀 없을 때만
- null: 출발지가 안 적혀 있거나 판단하기 어려울 때 (해외 예약 사이트의 전 세계 세일 등). 모르면 꼭 null.

[3] 날짜 (YYYY-MM-DD, 모르면 null — 절대 지어내지 말 것)
- book = 예약(판매) 기간, board = 탑승(출발) 기간. 둘을 섞지 마.
- 연·월이 빠진 날짜("28일부터", "오는 5일까지", "내달 2일")는 "글 날짜"를 기준으로 채워. 글 날짜보다 앞선 날이 되면 다음 달·다음 해로.
- "~11/16까지"처럼 끝만 있으면 from 은 null, to 만.
- 노선마다 탑승기간이 다르면 가장 넓은 범위가 아니라 null 로.

[4] 숫자
- min_price_krw: 한국 출발 국제선 항공권의 가장 싼 가격(원, 숫자만). 국내선(제주 등) 가격, 외화 가격, 쿠폰 금액, 할인 금액("2만원 할인")은 넣지 마. 없으면 null.
- trip: 그 가격이 "왕복" 인지 "편도" 인지. 안 적혀 있으면 null.
- max_discount_pct: 항공권 운임 자체의 최대 할인율(숫자). 쿠폰·카드 캐시백·포인트·면세품·호텔 할인율은 넣지 마. 없으면 null.

[5] 그 밖
- airlines: 특가를 내놓은 항공사 한글 이름 (예: 제주항공, 진에어, 트리니티항공(옛 티웨이), 에어부산, 이스타항공, 에어서울, 에어프레미아, 비엣젯). 여행사 특가면 [].
- promo_name: 특가 이름(예: "11월 매진 특가", "블프 특가"), 없으면 null.
- reason: 판단 이유 20자 이내.

형식: {"fare_promo":bool,"reason":"","airlines":[],"promo_name":null,"book_from":null,"book_to":null,"board_from":null,"board_to":null,"min_price_krw":null,"trip":null,"max_discount_pct":null,"seoul_departure":null}

예시
- "롯데면세점, 블프 최대 65% 할인…괌 비즈니스석 항공권 경품도" → fare_promo false (면세점 행사, 항공권은 경품)
- "대한항공 콜라보 휴대용 유모차 20만원대" → false (유모차 판매)
- "에어프레미아/ 27년 2월 1일~2월 14일/ 110만원대(인당)" → false (개인 가격 공유)
- "진에어 항공권 카카오페이 결제 시 즉시 할인!" → true (결제 즉시 할인), seoul_departure null
- "트리니티항공, 지방 공항 '우리 동네 할인' 프로모션" → true, seoul_departure false
- "11월 11일 세일 기간 동안 저렴한 항공권과 호텔을 찾아보세요" → 항공권 할인이 중심이면 true, seoul_departure null
- "비엣젯 11월 11일 더블데이 특가, 11~13일 판매, 탑승 2027년 12월 31일까지" (글 날짜 2026-11-10) → book_from 2026-11-11, book_to 2026-11-13, board_to 2027-12-31`;

const kst = d => new Date(new Date(d).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
const num = v => (typeof v === 'number' && isFinite(v) && v > 0) ? Math.round(v) : null;

function userText(p) {
  const body = (p.body || []).map(F.stripTags).join(' ').slice(0, 1500);
  return [
    `글 종류: ${p.community ? '커뮤니티 글 (제목과 짧은 요약만 있음)' : '뉴스 기사'}`,
    `출처: ${p.source || ''}`,
    `글 날짜: ${p.dateFound ? '모름 (찾은 날 ' + (p.found || '') + ')' : kst(p.date)}`,
    `제목: ${F.stripTags(p.title)}`,
    `요약: ${F.stripTags(p.desc || '').slice(0, 400)}`,
    body ? `본문 일부: ${body}` : '',
  ].filter(Boolean).join('\n');
}

class StopError extends Error {}

async function ask(p, key) {
  const body = {
    model,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userText(p) }],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 400,
    ...(useThinkingOff ? { thinking: { type: 'disabled' } } : {}),
  };
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const text = await res.text();
  if (res.status === 401 || res.status === 402 || res.status === 403) throw new StopError(`HTTP ${res.status} (키가 틀렸거나 잔액 부족) ${text.slice(0, 120)}`);
  if (res.status === 400) {
    // 모델 이름이나 '생각 끄기' 옵션을 모르는 경우 한 번씩 바꿔서 다시
    if (/model/i.test(text) && model !== 'deepseek-chat') { model = 'deepseek-chat'; return ask(p, key); }
    if (/thinking/i.test(text) && useThinkingOff) { useThinkingOff = false; return ask(p, key); }
    throw new Error(`HTTP 400 ${text.slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = JSON.parse(text);
  const content = j.choices?.[0]?.message?.content || '';
  const o = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  return { o, usage: j.usage || {} };
}

function clean(o) {
  return {
    v: AI_VERSION,
    promo: !!o.fare_promo,
    why: String(o.reason || '').slice(0, 40),
    airlines: Array.isArray(o.airlines) ? o.airlines.map(String).slice(0, 5) : [],
    name: o.promo_name ? String(o.promo_name).slice(0, 40) : null,
    book: (isDay(o.book_from) || isDay(o.book_to)) ? { from: isDay(o.book_from), to: isDay(o.book_to) } : null,
    board: (isDay(o.board_from) || isDay(o.board_to)) ? { from: isDay(o.board_from), to: isDay(o.board_to) } : null,
    price: num(o.min_price_krw),
    trip: o.trip === '왕복' || o.trip === '편도' ? o.trip : null,
    pct: num(o.max_discount_pct) && o.max_discount_pct <= 99 ? Math.round(o.max_discount_pct) : null,
    seoul: typeof o.seoul_departure === 'boolean' ? o.seoul_departure : null,
  };
}

// items: 저장된 모든 글, fresh: 이번에 새로 들어온 글 (먼저 판독), today: 'YYYY-MM-DD'
async function judge(items, fresh, { env, today, log, rulesFacts }) {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const since = F.addDays(today, -21);
  const freshSet = new Set(fresh);
  const todo = items.filter(p => !p.official && p.title && (!p.ai || p.ai.v !== AI_VERSION) && (p.found || '') >= since)
    .sort((a, b) => (freshSet.has(b) ? 1 : 0) - (freshSet.has(a) ? 1 : 0) || String(b.date).localeCompare(String(a.date)))
    .slice(0, MAX_PER_RUN);
  if (!todo.length) { log('■ AI 판독: 새로 판독할 글 없음'); return { done: [] }; }
  const done = [];
  let fails = 0, stop = null, inTok = 0, outTok = 0, cacheTok = 0, lastErr = '';
  const queue = [...todo];
  const work = async () => {
    for (let p; !stop && (p = queue.shift());) {
      try {
        const { o, usage } = await ask(p, key);
        p.ai = { ...clean(o), at: today, model };
        done.push(p); fails = 0;
        inTok += usage.prompt_tokens || 0; outTok += usage.completion_tokens || 0; cacheTok += usage.prompt_cache_hit_tokens || 0;
      } catch (e) {
        lastErr = String(e.message).slice(0, 160);
        if (e instanceof StopError) stop = lastErr;
        else if (++fails >= 5) stop = `연속 실패 5번: ${lastErr}`;
      }
    }
  };
  // 첫 건은 혼자 보내서 모델 이름·옵션을 먼저 맞춘 뒤 4건씩 동시에
  const first = queue.splice(0, 1);
  const rest = queue.splice(0);
  queue.push(...first); await work();
  queue.push(...rest); await Promise.all([1, 2, 3, 4].map(work));
  // 대략 요금 (V4 Flash 기준, 100만 토큰당 입력 0.14달러·캐시 0.0028달러·출력 0.28달러)
  const usd = ((inTok - cacheTok) * 0.14 + cacheTok * 0.0028 + outTok * 0.28) / 1e6;
  log(`■ AI 판독(${model}): ${done.length}/${todo.length}건 · 특가 아님 ${done.filter(p => !p.ai.promo).length}건 · 토큰 입력 ${inTok}(캐시 ${cacheTok})/출력 ${outTok} · 약 $${usd.toFixed(4)}${stop ? ` · 멈춤: ${stop}` : lastErr ? ` · 일부 실패: ${lastErr}` : ''}`);
  return { done, compare: compare(done, rulesFacts), usd };
}

// 규칙 판단과 비교 (기록만 단계에서 확인용)
function compare(done, rulesFacts) {
  const rows = [];
  for (const p of done) {
    const r = rulesFacts(p) || {};
    const a = p.ai;
    const diff = [];
    if (!a.promo) diff.push('AI: 특가 아님');
    const bt = (r.book || {}).to || null, at = (a.book || {}).to || null;
    if (bt !== at) diff.push(`예약 마감 규칙 ${bt || '-'} / AI ${at || '-'}`);
    const rp = r.pct || null;
    if (rp !== a.pct) diff.push(`할인율 규칙 ${rp || '-'} / AI ${a.pct || '-'}`);
    const rprice = (r.price || {}).amount || null;
    if (rprice !== a.price) diff.push(`가격 규칙 ${rprice || '-'} / AI ${a.price || '-'}`);
    rows.push({ at: a.at, title: F.stripTags(p.title).slice(0, 80), community: !!p.community, ai: a, rules: { book: r.book || null, board: r.board || null, pct: rp, price: rprice }, diff });
  }
  return rows;
}

module.exports = { judge, userText, clean, SYSTEM, MAX_PER_RUN };
