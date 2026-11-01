/* 뉴스 기사 본문 읽기 (GitHub 서버에서 실행)
   기사 첫 문단(검색 결과 요약)에는 예약기간·탑승기간·할인코드가 빠진 경우가 많아서, 기사 원문을 열어
   그런 내용이 들어 있는 문장만 저장해요. 저장한 문장에서 날짜·코드를 뽑는 건 앱(js/flight-core.js)이 해요.
   - 구글 뉴스 링크는 원래 기사 주소를 숨겨 둬서, 구글 뉴스 화면이 쓰는 방식 그대로 원래 주소를 받아 와요.
   - 막히거나(로그인·보안 장치) 화면을 자바스크립트로 그리는 사이트는 건너뜀 → 그 기사는 첫 문단만 써요. */
'use strict';
const F = require('../js/flight-core.js');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const HEAD = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' };

async function fetchText(url, opt = {}) {
  const res = await fetch(url, { headers: { ...HEAD, ...(opt.headers || {}) }, method: opt.method || 'GET', body: opt.body, redirect: 'follow', signal: AbortSignal.timeout(opt.timeout || 12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 한국 언론사 중에는 아직 EUC-KR 글자 방식을 쓰는 곳이 있어요
  const head = buf.subarray(0, 4000).toString('latin1');
  const cs = ((res.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let text;
  try { text = new TextDecoder(/euc-?kr|ks_c_5601|cp949/i.test(cs) ? 'euc-kr' : 'utf-8').decode(buf); } catch { text = buf.toString('utf8'); }
  return { text, url: res.url };
}

// 구글 뉴스 링크(news.google.com/rss/articles/…) → 원래 기사 주소
async function resolveGoogle(link) {
  const id = (link.split('/articles/')[1] || '').split('?')[0];
  if (!id) return '';
  const { text: h } = await fetchText(`https://news.google.com/rss/articles/${id}`);
  const sg = (h.match(/data-n-a-sg="([^"]+)"/) || [])[1], ts = (h.match(/data-n-a-ts="([^"]+)"/) || [])[1];
  if (!sg || !ts) return '';
  const req = ['Fbv4je', JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sg])];
  const { text: t } = await fetchText('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: 'f.req=' + encodeURIComponent(JSON.stringify([[req]])),
  });
  // 응답: )]}' 다음 줄에 [["wrb.fr","Fbv4je","[\"garturlreq\",\"https://…\"]",…]] → 두 번 풀어야 주소가 온전히 나옴
  for (const line of t.split('\n')) {
    if (!line.startsWith('[')) continue;
    try {
      for (const row of JSON.parse(line)) {
        if (row[1] !== 'Fbv4je' || typeof row[2] !== 'string') continue;
        const inner = JSON.parse(row[2]);
        if (typeof inner[1] === 'string' && /^https?:\/\//.test(inner[1])) return inner[1];
      }
    } catch { /* 다음 줄 */ }
  }
  return '';
}

// 기사 HTML → 본문 줄들 (메뉴·광고·관련 기사 목록은 최대한 뺌)
const END_RE = /무단\s*전재|재배포\s*금지|저작권자|copyright|ⓒ|©|관련\s*기사|많이\s*본|인기\s*기사|주요\s*뉴스|기사\s*제보|구독\s*신청|기자의\s*다른\s*기사/i;
function articleLines(html, hint) {
  let h = String(html).replace(/<!--[\s\S]*?-->|<head\b[\s\S]*?<\/head>/gi, ' ')
    .replace(/<(script|style|noscript|svg|iframe|button|select|form|nav|header|footer|aside|figure|figcaption|template)\b[\s\S]*?<\/\1>/gi, ' ');
  h = h.replace(/<br\s*\/?>|<\/(?:p|div|li|h\d|tr|section|article|blockquote|dd|dt|td)>|<(?:p|li|h\d|tr|dd|dt)\b[^>]*>/gi, '\n');
  const lines = h.split('\n').map(l => F.stripTags(l)).map(l => l.trim()).filter(l => l.length >= 2);
  // 시작: 검색 결과 요약(첫 문단)과 앞부분이 같은 줄 → 없으면 '…다.'로 끝나는 첫 긴 문장
  const key = String(hint || '').replace(/^\s*[\[(][^\])]{2,30}[\])]\s*/, '').replace(/\s+/g, '').slice(0, 18);
  let start = key.length >= 10 ? lines.findIndex(l => l.replace(/\s+/g, '').includes(key)) : -1;
  if (start < 0) start = lines.findIndex(l => l.length >= 40 && /다\.\s*$|다\.\s/.test(l));
  if (start < 0) return [];
  const out = [];
  for (let i = start; i < lines.length && out.length < 80; i++) {
    // 기사 끝 표시(저작권·관련 기사)에서 멈춤. 아직 본문 문장이 없으면(제목 줄 근처의 메뉴) 그 줄만 건너뜀
    if (i > start && END_RE.test(lines[i]) && lines[i].length < 120) { if (out.some(l => l.length >= 40)) break; continue; }
    out.push(lines[i]);
  }
  return out;
}

// 본문 줄들 → 저장할 문장: 항공사·날짜·기간·코드·가격·할인율이 들어간 문장만, 원문 순서 그대로 (최대 1500글자)
const FACT_RE = /\d{1,2}\s*월|\d{4}\s*[.년]|\d{1,2}\s*일\s*(?:부터|까지|[~∼〜\-–]|\()|\d\s*%|\d\s*원|만\s*원|₩|코드|기간|예약|탑승|판매|발권|부터|까지|다음\s*달|내달|이달/;
function factSentences(lines) {
  const out = [];
  let size = 0;
  for (const line of lines) {
    for (let s of F.splitSentences(line)) {
      if (s.length < 8) continue;
      if (!FACT_RE.test(s) && !F.subjectAirline(s)) continue;
      if (/[\w.-]+@[\w-]+\.[\w.]+/.test(s) && s.length < 60) continue; // 기자 이메일 줄
      if (s.length > 220) s = `${s.slice(0, 218)}…`;
      if (out.includes(s)) continue;
      out.push(s); size += s.length;
      if (size > 1500) return out;
    }
  }
  return out;
}

// item: { link, desc } → { body: [문장…], url: 원래 주소 } (실패하면 예외)
async function readArticle(item) {
  let url = item.link;
  if (/news\.google\.com\/(?:rss\/)?articles\//.test(url)) {
    url = await resolveGoogle(url);
    if (!url) throw new Error('구글 뉴스 원래 주소 못 찾음');
  }
  const { text: html, url: finalUrl } = await fetchText(url);
  const lines = articleLines(html, item.desc || item.title);
  return { body: factSentences(lines), url: finalUrl || url };
}

module.exports = { readArticle, _test: { articleLines, factSentences } };
