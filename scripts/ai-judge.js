/* AI 판독 (DeepSeek): 새로 들어온 뉴스·커뮤니티 글을 AI가 읽고 정리
   - 진짜 항공권 운임 특가인지, 항공사, 특가 이름, 예약기간·탑승기간, 최저가, 최대 할인율
   - 결과는 글마다 p.ai 에 저장 (한 번 판독한 글은 다시 보내지 않음)
   - 앱 화면·같은 소식 묶기·알림에 AI 판단이 우선 (js/flight-core.js 의 isWantedPromo·withAi). 판독 안 된 글은 규칙대로
   - 규칙 판단과 다른 점은 data/ai-check.json 에 남김 (확인용)
   - GitHub Secrets 의 DEEPSEEK_API_KEY 가 없으면 아무것도 안 하고 넘어감 (지금 방식 그대로)
   - 안전장치: 한 번 실행에 최대 MAX_PER_RUN 건, 키 오류·잔액 부족이면 바로 멈춤, 연속 실패 5번이면 멈춤 */
'use strict';
const F = require('../js/flight-core.js');

const MAX_PER_RUN = 150;
const AI_VERSION = 1; // 질문(프롬프트)을 크게 바꾸면 올림 → 다시 판독
const BASE = (process.env.DEEPSEEK_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
let model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
let useThinkingOff = true;

const SYSTEM = `너는 한국 항공권 특가 정보를 정리하는 도우미야. 글 1건(뉴스 기사 또는 커뮤니티 글)을 읽고 JSON 하나로만 답해.
판단 기준:
- fare_promo: 항공사(또는 항공사와 함께하는 판매처)가 '항공권 운임'을 할인·특가로 파는 소식이면 true.
  아래는 false: 환불·피해·실적·주가·논란 기사, 가격 추이·분석·전망 기사, 면세점·호텔·렌터카·보험·eSIM·마일리지 적립·굿즈·퀴즈 이벤트,
  개인이 검색해서 찾은 가격 공유, 광고·체험단·후기, 항공기 모형 판매, 이미 끝난 특가를 돌아보는 글.
- 날짜는 YYYY-MM-DD. 연도가 없으면 글 날짜를 기준으로 가장 자연스러운 연도. 모르면 null. 추측해서 만들지 말 것.
- book = 예약(판매)기간, board = 탑승(출발)기간. 둘을 섞지 말 것.
- min_price_krw: 글에 적힌 가장 싼 항공권 가격(원, 숫자). 세금 포함 여부 무관. 없으면 null.
- trip: "왕복" | "편도" | null
- max_discount_pct: 항공권 운임 최대 할인율(숫자). 쿠폰·카드·면세 할인율은 제외. 없으면 null.
- seoul_departure: 인천·김포(서울) 출발 노선이 포함되면 true, 지방 출발만이면 false, 모르면 null.
형식: {"fare_promo":bool,"reason":"20자 이내","airlines":["항공사 이름"],"promo_name":"특가 이름 또는 null","book_from":null,"book_to":null,"board_from":null,"board_to":null,"min_price_krw":null,"trip":null,"max_discount_pct":null,"seoul_departure":null}`;

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
