#!/usr/bin/env node
/* 시험용: 항공사 홈페이지·이벤트 페이지를 GitHub 서버에서 열 수 있는지 확인 (각 주소 1번씩만 요청)
   결과: 응답 코드, 크기, 제목, 특가 관련 단어 수, 이벤트로 보이는 링크 몇 개 */
'use strict';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const SITES = [
  ['제주항공', ['https://www.jejuair.net/ko/main/base/index.do', 'https://www.jejuair.net/ko/event/eventList.do', 'https://www.jejuair.net/ko/event/eventDetail.do?eventNo=0000004425']],
  ['진에어', ['https://www.jinair.com/', 'https://www.jinair.com/promotion/index']],
  ['티웨이', ['https://www.twayair.com/app/main', 'https://www.twayair.com/app/promotion/event/list']],
  ['이스타', ['https://www.eastarjet.com/']],
  ['에어부산', ['https://www.airbusan.com/']],
  ['비엣젯', ['https://www.vietjetair.com/ko', 'https://www.vietjetair.com/ko/pages/promotions']],
  ['대한항공', ['https://www.koreanair.com/kr/ko', 'https://www.koreanair.com/kr/ko/promotion']],
  ['베트남항공', ['https://www.vietnamairlines.com/kr/ko/home']],
];
const strip = s => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
(async () => {
  for (const [name, urls] of SITES) {
    console.log(`\n■ ${name}`);
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
        const html = await res.text();
        const text = strip(html);
        const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
        const words = (text.match(/특가|할인|프로모션|이벤트|세일|SALE/gi) || []).length;
        const links = [...new Set([...html.matchAll(/href=["']([^"']*(?:event|promo|sale|special)[^"']*)["']/gi)].map(m => m[1]))].slice(0, 6);
        const blocked = /captcha|access denied|cf-chl|akamai|are you a robot|request unsuccessful|incapsula/i.test(html);
        console.log(`  ${res.status} ${url} → ${res.url !== url ? '(이동: ' + res.url + ') ' : ''}${html.length}B, 글자 ${text.length}, 특가단어 ${words}${blocked ? ', 차단 의심' : ''}`);
        console.log(`     제목: ${title.trim().slice(0, 60)}`);
        if (links.length) console.log(`     링크: ${links.join(' | ')}`);
        if (text.length < 400) console.log(`     본문: ${text.trim().slice(0, 200)}`);
      } catch (e) { console.log(`  ✗ ${url} → ${e.message}`); }
      await new Promise(r => setTimeout(r, 800));
    }
  }
})();
