#!/usr/bin/env node
/* 시험용: 뉴스 본문을 가져올 수 있는지 (구글 뉴스 원문 주소 찾기 / Bing 뉴스 RSS / 기사 본문) */
'use strict';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' };
const sq = s => s.replace(/\s+/g, ' ').trim();
const strip = s => sq(String(s).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
(async () => {
  const q = '비엣젯 베트남 특가';
  // 1) 구글 뉴스 RSS → 기사 링크 → 원문 주소 찾기
  const rss = await (await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:30d')}&hl=ko&gl=KR&ceid=KR:ko`, { headers: H })).text();
  const g = [...rss.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>/g)].slice(0, 3);
  for (const [, t, link, desc] of g) {
    console.log('\n== 구글 기사:', strip(t).slice(0, 60), '\n   링크:', link.slice(0, 90), '\n   설명:', strip(strip(desc)).slice(0, 120));
    // a) 그냥 열기(리다이렉트 따라가기)
    try { const r = await fetch(link, { headers: H, redirect: 'follow' }); const h = await r.text(); console.log('   그냥 열기 →', r.status, r.url.slice(0, 90), h.length + 'B'); 
      // b) batchexecute 방식 (data-n-a-sg / data-n-a-ts)
      const id = link.split('/articles/')[1]?.split('?')[0];
      const sg = (h.match(/data-n-a-sg="([^"]+)"/) || [])[1], ts = (h.match(/data-n-a-ts="([^"]+)"/) || [])[1];
      console.log('   sg/ts 있음:', !!sg, !!ts);
      if (id && sg && ts) {
        const payload = ['Fbv4je', JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sg])];
        const body = 'f.req=' + encodeURIComponent(JSON.stringify([[payload]]));
        const r2 = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
        const t2 = await r2.text();
        const url = (t2.match(/https?:\/\/[^"\\]+/g) || []).find(u => !/google\./.test(u));
        console.log('   원문 주소 찾기 →', r2.status, url || t2.slice(0, 150));
        if (url) {
          const r3 = await fetch(url, { headers: H, redirect: 'follow', signal: AbortSignal.timeout(15000) });
          const h3 = await r3.text();
          const og = (h3.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i) || [])[1];
          const ps = [...h3.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => strip(m[1])).filter(x => x.length > 40);
          const art = strip((h3.match(/<article[\s\S]*?<\/article>/i) || [''])[0]);
          console.log('   기사 →', r3.status, h3.length + 'B', '| og:', (og || '').slice(0, 120), '| <p> 문단', ps.length, '| article 글자', art.length);
          console.log('   본문 앞:', (ps.join(' ') || art).slice(0, 300));
        }
      }
    } catch (e) { console.log('   실패', e.message); }
  }
  // 2) Bing 뉴스 RSS
  try {
    const r = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=ko-KR&cc=KR`, { headers: H });
    const x = await r.text();
    const items = [...x.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>/g)].slice(0, 3);
    console.log('\n== Bing RSS', r.status, x.length + 'B', '기사', items.length);
    for (const [, t, l, d] of items) console.log('  ', strip(t).slice(0, 50), '|', strip(d).slice(0, 150), '|', l.slice(0, 80));
  } catch (e) { console.log('Bing 실패', e.message); }
})();
