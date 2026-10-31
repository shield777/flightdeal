/* 최저가 항공권 화면
   - 가격·특가 자료는 매일 아침 GitHub Actions(scripts/flight-check.js)가 data/ 폴더에 쌓아요. 이 화면은 그걸 읽어 보여 줘요.
   - 이 기기 설정(카드 할인 규칙, 수하물 요금, GitHub 연결)은 이 기기에만 저장돼요. */
(function () {
  'use strict';
  const F = window.FlightCore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = F.won;
  const man = n => n >= 10000 ? `${(Math.round(n / 1000) / 10).toLocaleString('ko-KR')}만원` : won(n);
  const app = $('#app'), sheetRoot = $('#sheet-root');
  const KEY = 'flightdeal-v1';

  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  };

  // ───── 저장된 설정 ─────
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const thisYM = today.slice(0, 7);
  const guessRepo = () => {
    const h = location.hostname, seg = location.pathname.split('/').filter(Boolean);
    if (h.endsWith('.github.io')) return { owner: h.split('.')[0], repo: seg[0] && !seg[0].endsWith('.html') ? seg[0] : `${h.split('.')[0]}.github.io` };
    return { owner: 'shield777', repo: 'flightdeal' };
  };
  const DEFAULT = {
    q: { origin: 'SEL', dest: 'CXR', from: '2027-01', to: '2027-10', minN: 3, maxN: 5, adults: 3, direct: true, wantBag: false, custom: null },
    sort: 'month',
    bagFees: {},
    cardRules: [],
    gh: { ...guessRepo(), branch: 'main', token: '' },
    tpToken: '',
  };
  let cfg;
  try { cfg = Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { cfg = { ...DEFAULT }; }
  cfg.q = Object.assign({}, DEFAULT.q, cfg.q); cfg.q.direct = true; /* 경유편은 아예 보지 않음 */ cfg.q.origin = 'SEL'; /* 출발은 서울(인천·김포) 고정 */ cfg.gh = Object.assign({}, DEFAULT.gh, cfg.gh);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* 저장 불가(사생활 보호 모드) */ } };

  // ───── 자료 불러오기 ─────
  const data = { results: { routes: {} }, promos: { items: [] }, watch: { settings: {}, watches: [] }, loaded: false, error: '' };
  const live = {}; // 이 기기에서 바로 검색한 결과 (저장 안 함)
  const clim = {}; // 목적지별 강수량 통계

  function b64utf8(b64) { const bin = atob(b64.replace(/\n/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
  function utf8b64(str) { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin); }
  async function gh(method, p, body) {
    const g = cfg.gh;
    const res = await fetch(`https://api.github.com/repos/${g.owner}/${g.repo}${p}`, {
      method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${g.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`GitHub ${res.status} ${t.slice(0, 120)}`); }
    return res.status === 204 ? null : res.json();
  }
  async function fetchData(file) {
    const g = cfg.gh;
    const tries = [];
    if (g.token) tries.push(async () => { const j = await gh('GET', `/contents/${file}?ref=${encodeURIComponent(g.branch)}`); return JSON.parse(b64utf8(j.content)); });
    const onPages = location.hostname.endsWith('.github.io');
    const raw = async () => { const r = await fetch(`https://raw.githubusercontent.com/${g.owner}/${g.repo}/${g.branch}/${file}?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); };
    const rel = async () => { const r = await fetch(`${file}?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); };
    if (onPages) tries.push(raw, rel); else tries.push(rel, raw);
    for (const t of tries) { try { return await t(); } catch { /* 다음 방법 */ } }
    return null;
  }
  async function loadAll() {
    const [r, p, w] = await Promise.all([fetchData('data/flight-results.json'), fetchData('data/promos.json'), fetchData('data/watchlist.json')]);
    if (r) data.results = Object.assign({ routes: {} }, r);
    if (p) data.promos = Object.assign({ items: [] }, p);
    if (w) data.watch = Object.assign({ settings: {}, watches: [] }, w);
    data.loaded = true; data.error = r ? '' : '가격 자료를 불러오지 못했어요';
  }

  // ───── 기후(강수량): Open-Meteo 과거 10년 평균, 이 기기에 보관 ─────
  async function loadClimate(dest) {
    if (!dest || clim[dest.code]) return;
    const ck = `tp-clim-${dest.code}-${dest.lat}`;
    try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && c.v === 2) { clim[dest.code] = c; return; } } catch { /* 없음 */ }
    clim[dest.code] = { loading: true };
    try {
      const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${dest.lat}&longitude=${dest.lon}&start_date=2015-01-01&end_date=2024-12-31&daily=precipitation_sum,temperature_2m_max&timezone=auto`;
      const j = await (await fetch(u)).json();
      const sum = Array.from({ length: 12 }, () => ({ rain: 0, wet: 0, tmax: 0, n: 0 }));
      j.daily.time.forEach((t, i) => {
        const m = Number(t.slice(5, 7)) - 1, p = j.daily.precipitation_sum[i], tx = j.daily.temperature_2m_max[i];
        if (p == null || tx == null) return;
        sum[m].rain += p; sum[m].wet += p >= 1 ? 1 : 0; sum[m].tmax += tx; sum[m].n++;
      });
      const months = sum.map(s => { const days = s.n / 10; return s.n ? { rain: Math.round(s.rain / 10), wet: Math.round(s.wet / 10), tmax: Math.round(s.tmax / s.n), days } : null; });
      clim[dest.code] = { v: 2, months };
      try { localStorage.setItem(ck, JSON.stringify(clim[dest.code])); } catch { /* 저장 불가 */ }
    } catch { clim[dest.code] = { failed: true }; }
    renderResults();
  }
  // ───── 현재 검색 ─────
  function currentDest() {
    const q = cfg.q;
    if (q.dest === '_custom' && q.custom) return { country: q.custom.country || '기타', city: q.custom.city || q.custom.code, alias: [], code: q.custom.code, link: q.custom.code, lat: q.custom.lat, lon: q.custom.lon, region: q.custom.region || 'sea', clim: '' };
    return F.findDest(q.dest) || F.DESTS[0];
  }
  const curKey = () => F.routeKey({ origin: cfg.q.origin, dest: currentDest().code, minNights: cfg.q.minN, maxNights: cfg.q.maxN, direct: cfg.q.direct });
  const watchOf = key => (data.watch.watches || []).find(w => F.routeKey(w) === key);

  // ───── 화면 ─────
  let ui = { busy: '', open: {}, tab: (() => { try { return localStorage.getItem('flightdeal-tab') || 'price'; } catch { return 'price'; } })() };
  function render() {
    const q = cfg.q;
    const countries = [...new Set(F.DESTS.map(d => d.country))];
    const dest = currentDest();
    const country = q.dest === '_custom' ? '_custom' : dest.country;
    const nOpts = (sel) => Array.from({ length: 14 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === sel ? 'selected' : ''}>${n}박</option>`).join('');
    app.innerHTML = `
      <div class="wrap">
        <header class="topbar">
          <div class="grow brand">최저가 항공권</div>
          <button class="btn icon sm" data-act="settings" aria-label="설정">${ICON.gear}</button>
        </header>
        <nav class="fl-tabs" role="tablist">
          <button role="tab" aria-selected="${ui.tab === 'price'}" data-act="tab" data-v="price">항공권 가격</button>
          <button role="tab" aria-selected="${ui.tab === 'promo'}" data-act="tab" data-v="promo">프로모션</button>
        </nav>
        ${ui.tab === 'promo' ? '<div id="promo"></div>' : `
        <form class="fl-search" id="search" novalidate>
          <div class="grid2 g-where">
            <label class="field"><span>나라</span><select id="q-country">${countries.map(c => `<option ${c === country ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="_custom" ${country === '_custom' ? 'selected' : ''}>직접 입력</option></select></label>
            <label class="field"><span>도시</span><select id="q-dest">${country === '_custom' ? '<option value="_custom">직접 입력</option>' : F.DESTS.filter(d => d.country === country).map(d => `<option value="${d.code}" ${d.code === dest.code ? 'selected' : ''}>${esc(d.city)}</option>`).join('')}</select></label>
          </div>
          ${country === '_custom' ? `<div class="grid3">
            <label class="field"><span>공항·도시 코드</span><input type="text" id="q-ccode" maxlength="3" placeholder="예: KTM" value="${esc(q.custom?.code || '')}" autocapitalize="characters"></label>
            <label class="field"><span>도시 이름(영문)</span><input type="text" id="q-cname" placeholder="예: Kathmandu" value="${esc(q.custom?.en || '')}"></label>
          </div>` : ''}
          <div class="grid2">
            <label class="field"><span>언제부터</span><input type="month" id="q-from" value="${esc(q.from)}" min="${thisYM}"></label>
            <label class="field"><span>언제까지</span><input type="month" id="q-to" value="${esc(q.to)}" min="${thisYM}"></label>
          </div>
          <div class="grid3">
            <label class="field"><span>짧게</span><select id="q-minN">${nOpts(q.minN)}</select></label>
            <label class="field"><span>길게</span><select id="q-maxN">${nOpts(q.maxN)}</select></label>
            <label class="field"><span>인원</span><select id="q-adults">${Array.from({ length: 9 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === q.adults ? 'selected' : ''}>${n}명</option>`).join('')}</select></label>
          </div>
          <p class="hint fl-fixed">출발 서울(인천·김포) · 직항만</p>
          <button class="btn primary fl-go" type="submit">월별 최저가 보기</button>
        </form>

        <div id="results"></div>`}
      </div>`;
    if (ui.tab === 'promo') renderPromo(); else renderResults();
  }

  function readForm() {
    const q = cfg.q, v = id => $('#' + id)?.value;
    q.origin = 'SEL';
    const country = v('q-country');
    if (country === '_custom') {
      const code = (v('q-ccode') || '').trim().toUpperCase();
      const en = (v('q-cname') || '').trim();
      q.dest = '_custom';
      const prev = q.custom || {};
      q.custom = { code, en, city: en || code, country: '기타', region: prev.region || 'sea', lat: prev.en === en ? prev.lat : null, lon: prev.en === en ? prev.lon : null };
    } else q.dest = v('q-dest');
    q.from = v('q-from') || q.from; q.to = v('q-to') || q.to;
    if (q.to < q.from) [q.from, q.to] = [q.to, q.from];
    q.minN = Number(v('q-minN')); q.maxN = Number(v('q-maxN'));
    if (q.maxN < q.minN) [q.minN, q.maxN] = [q.maxN, q.minN];
    q.adults = Number(v('q-adults'));
    q.wantBag = false; q.direct = true;
    save();
  }

  // 그 달의 표시용 가격: 기록된 운임 그대로 (+ 내가 등록한 카드 할인 규칙). 수하물 등 추정값은 더하지 않음
  function priceView(o) {
    const card = F.applyCard(o.price, o.airline, cfg.cardRules, today);
    return { o, card, final: card ? card.price : o.price };
  }
  function monthInfo(key, ym, dest) {
    const M = (live[key] && live[key][ym]) || data.results.routes[key]?.months?.[ym] || null;
    if (!M || !M.best) return { M, best: null };
    const cands = (M.top && M.top.length ? M.top : [M.best]).map(o => priceView(o));
    cands.sort((a, b) => a.final - b.final);
    return { M, best: cands[0], others: cands.slice(1) };
  }

  function renderResults() {
    const box = $('#results'); if (!box) return;
    const q = cfg.q, dest = currentDest();
    if (!dest.code || dest.code.length !== 3) { box.innerHTML = `<div class="empty">공항·도시 코드(영문 3글자)를 넣어 주세요.</div>`; return; }
    const key = curKey();
    const months = F.monthsBetween(q.from, q.to).filter(m => m >= thisYM);
    const w = watchOf(key);
    const route = data.results.routes[key];
    const covered = w ? months.filter(m => m >= w.from && m <= w.to).length : 0;
    const origin = F.ORIGINS.find(o => o.code === q.origin);
    const C = clim[dest.code];

    const rows = months.map(ym => ({ ym, ...monthInfo(key, ym, dest) }));
    const priced = rows.filter(r => r.best);
    const cheapest = priced.length ? priced.reduce((a, b) => a.best.final <= b.best.final ? a : b) : null;
    const climFor = ym => F.climateOf(dest, Number(ym.slice(5))); // 목적지 기후표에 있는 것만 (강수량으로 추정하지 않음)
    const goodPriced = priced.filter(r => climFor(r.ym)?.tone === 'good');
    const bestGood = goodPriced.length ? goodPriced.reduce((a, b) => a.best.final <= b.best.final ? a : b) : null;
    if (cfg.sort === 'price') rows.sort((a, b) => (a.best ? a.best.final : 9e12) - (b.best ? b.best.final : 9e12));

    const promoN = (data.promos.items || []).filter(p => p.kind === 'airline' && F.isWantedPromo(p, data.watch.settings) && (p.countries || []).includes(dest.country) && (p.until ? p.until >= today : (p.lastFound || p.found) >= F.addDays(today, -21))).length;
    const status = !data.loaded ? '자료를 불러오는 중…'
      : w ? `매일 아침 자동 확인 중${route?.months ? ` · 마지막 ${fmtUpdated(data.results.updated)}` : ' · 첫 확인을 기다리는 중'}${covered < months.length ? ` · 추적 기간 ${w.from}~${w.to}` : ''}`
      : '아직 매일 확인하지 않는 노선이에요. 아래 버튼으로 추적을 시작하면 다음 날부터 가격이 쌓여요.';

    box.innerHTML = `
      <section class="fl-head">
        <div class="crumb">${esc(origin?.name || q.origin)} → ${esc(dest.country)} · <b>${esc(dest.city)}</b> <span class="route-chip">${esc(dest.code)}</span></div>
        <div class="sub">${q.from.replace('-', '.')} ~ ${q.to.replace('-', '.')} · ${q.minN}~${q.maxN}박 · ${q.adults}명 · 직항</div>
        <div class="fl-status ${w ? 'on' : ''}">${esc(status)}</div>
        <div class="fl-actions">
          ${w ? `<button class="btn sm" data-act="refresh" ${ui.busy ? 'disabled' : ''}>${ICON.refresh}${ui.busy === 'refresh' ? '확인 중… (1~3분)' : '지금 갱신'}</button>`
              : `<button class="btn sm primary" data-act="watch" ${ui.busy ? 'disabled' : ''}>${ICON.bell}${ui.busy === 'watch' ? '등록 중…' : '매일 추적 + 알림 시작'}</button>`}
          ${w ? `<button class="btn sm" data-act="watch-edit">목표가·기간</button>` : ''}
          ${cfg.tpToken ? `<button class="btn sm" data-act="live" ${ui.busy ? 'disabled' : ''}>${ui.busy === 'live' ? '검색 중…' : '이 기기에서 바로 검색'}</button>` : ''}
        </div>
      </section>

      ${priced.length ? `<section class="fl-sum">
        ${cheapest ? `<div><span>가장 싼 달</span><b>${Number(cheapest.ym.slice(5))}월 ${man(cheapest.best.final)}</b><small>${esc(climFor(cheapest.ym)?.label || '')}</small></div>` : ''}
        ${bestGood && bestGood !== cheapest ? `<div><span>날씨 좋은 달 중 최저</span><b>${Number(bestGood.ym.slice(5))}월 ${man(bestGood.best.final)}</b><small>${esc(climFor(bestGood.ym)?.label || '')}</small></div>` : ''}
        <div><span>가격 기준</span><b>1인 왕복 운임</b><small>${cfg.cardRules.length ? '내 카드 할인 규칙 반영' : '수하물 포함 여부는 예약 화면에서 확인'}</small></div>
      </section>` : ''}

      ${promoN ? `<button type="button" class="fl-promo-link" data-act="tab" data-v="promo">🏷️ ${esc(dest.country)} 관련 특가 소식 ${promoN}건 → 프로모션 탭</button>` : ''}

      <div class="fl-sortbar">
        <div class="seg" role="tablist">
          <button role="tab" aria-selected="${cfg.sort === 'month'}" data-act="sort" data-v="month">월 순서</button>
          <button role="tab" aria-selected="${cfg.sort === 'price'}" data-act="sort" data-v="price">싼 순서</button>
        </div>
        <small>${C?.months ? '강수량: 최근 10년 평균(Open-Meteo)' : C?.loading ? '강수량 불러오는 중…' : ''}</small>
      </div>

      <div class="fl-months">${rows.map(r => monthCard(r, dest, key, C, climFor(r.ym), r === cheapest)).join('')}</div>

      ${tipsSection(dest)}
      <p class="fl-foot">가격은 Travelpayouts(Aviasales)에 <b>기록된 검색 가격</b>(1인 왕복, 확인한 날짜 기준)이에요. 실시간 좌석 가격이 아니라서 결제 화면과 다를 수 있어요. 수하물 포함 여부·최종 총액은 예약 화면에서 확인하세요. 강수량은 Open-Meteo 최근 10년 관측 평균이에요.</p>`;

    if (!dest.clim && dest.lat == null && q.custom?.en) geocodeCustom();
    else if (dest.lat != null) loadClimate(dest);
  }

  function fmtUpdated(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const fmtDay = s => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}(${F.weekday(s)})`;

  function monthCard(r, dest, key, C, cl, isCheapest) {
    const { ym, M, best, others } = r;
    const mNum = Number(ym.slice(5));
    const c = C?.months?.[mNum - 1];
    const hol = F.holidaysIn(ym);
    const peak = F.PEAK[mNum];
    const mid = `${ym}-${String(Math.min(28, 10)).padStart(2, '0')}`;
    const L0 = F.links(cfg.q.origin, dest, best ? best.o.dep : mid, best ? best.o.ret : F.addDays(mid, cfg.q.minN), cfg.q.adults);
    const meta = [
      c ? `강수 ${c.rain}mm · 비 ${c.wet}일 · 최고 ${c.tmax}℃` : '',
    ].filter(Boolean).join('');
    const notes = [cl?.note, ...hol.map(h => `${h.name} ${fmtDay(h.from)}${h.to !== h.from ? `~${fmtDay(h.to)}` : ''}`), peak ? `${peak}(성수기)` : ''].filter(Boolean);

    let body;
    if (best) {
      const o = best.o, a = F.airline(o.airline);
      const hist = (M.history || []).filter(h => h.min);
      const avg30 = M.avg30 && M.avg30 !== o.price ? M.avg30 : 0;
      const L = F.links(cfg.q.origin, dest, o.dep, o.ret, cfg.q.adults);
      const stops = o.transfers || o.backTransfers ? `경유 ${Math.max(o.transfers, o.backTransfers)}회` : '직항';
      body = `
        <div class="fl-price">
          <div><b>${won(best.final)}</b><small>1인 왕복${best.card ? '·카드 할인 후' : ''}</small></div>
        </div>
        <div class="fl-trip">${fmtDay(o.dep)} → ${fmtDay(o.ret)} · <b>${o.nights}박</b> · ${esc(a.name)} · ${stops}${o.dep.length > 10 ? ` · ${o.dep.slice(11, 16)} 출발` : ''}</div>
        <ul class="fl-lines">
          ${best.card ? `<li class="card">💳 ${esc(best.card.rule.card)} ${esc(ruleText(best.card.rule))} → -${won(best.card.off)} (기록 운임 ${won(o.price)})</li>` : ''}
          ${M.checked ? `<li>확인한 날 ${esc(M.checked.slice(5).replace('-', '/'))}${M.count ? ` · 조건에 맞는 기록 ${M.count}건` : ''}${avg30 ? ` · 지난 30일 기록 최저가 평균 ${won(avg30)}` : ''}${hist.length > 1 ? ` · 기록 ${hist.length}일` : ''}</li>` : ''}
        </ul>
        ${hist.length > 2 ? sparkline(hist) : ''}
        <div class="fl-links">
          <a class="btn sm primary" href="${L.google}" target="_blank" rel="noopener">구글 항공권</a>
          <a class="btn sm" href="${L.naver}" target="_blank" rel="noopener">네이버</a>
          <a class="btn sm" href="${L.sky}" target="_blank" rel="noopener">스카이스캐너</a>
          ${a.url ? `<a class="btn sm" href="${a.url}" target="_blank" rel="noopener">${esc(a.name)} 직판</a>` : ''}
          ${o.link ? `<a class="btn sm ghost" href="${o.link}" target="_blank" rel="noopener">찾은 곳${ICON.ext}</a>` : ''}
        </div>
        ${others && others.length ? `<details class="fl-more" ${ui.open[ym] ? 'open' : ''} data-ym="${ym}"><summary>다른 날짜 ${others.length}개</summary>
          <ul>${others.map(x => { const l = F.links(cfg.q.origin, dest, x.o.dep, x.o.ret, cfg.q.adults); return `<li><a href="${l.google}" target="_blank" rel="noopener"><b>${won(x.final)}</b> ${fmtDay(x.o.dep)}→${fmtDay(x.o.ret)} ${x.o.nights}박 · ${esc(F.airline(x.o.airline).name)}</a></li>`; }).join('')}</ul></details>` : ''}`;
    } else {
      const why = M?.error ? `가격 확인 실패(${M.error}).` : M ? '조건에 맞는 가격 기록이 아직 없어요. 먼 달은 검색한 사람이 적어 비어 있을 수 있어요.' : '아직 가격 기록이 없어요.';
      body = `<p class="fl-none">${esc(why)} 아래 버튼으로 ${Number(ym.slice(5))}월 ${10}일 출발 기준 바로 확인할 수 있어요.</p>
        <div class="fl-links">
          <a class="btn sm primary" href="${L0.google}" target="_blank" rel="noopener">구글 항공권</a>
          <a class="btn sm" href="${L0.naver}" target="_blank" rel="noopener">네이버</a>
          <a class="btn sm" href="${L0.sky}" target="_blank" rel="noopener">스카이스캐너</a>
        </div>`;
    }
    return `
      <article class="fl-month ${isCheapest ? 'cheapest' : ''}" id="m-${ym}">
        <header>
          <div class="ym"><b>${mNum}월</b><small>${ym.slice(0, 4)}</small></div>
          ${cl ? `<span class="clim ${cl.tone}">${esc(cl.label)}</span>` : ''}
          ${isCheapest ? '<span class="clim best">최저</span>' : ''}
          <span class="fl-meta">${esc(meta)}</span>
        </header>
        ${notes.length ? `<div class="fl-notes">${notes.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
        ${body}
      </article>`;
  }

  function sparkline(hist) {
    const h = hist.slice(-60), vals = h.map(x => x.min);
    const lo = Math.min(...vals), hi = Math.max(...vals), W = 240, H = 36;
    const x = i => (i / Math.max(1, h.length - 1)) * W, y = v => hi === lo ? H / 2 : H - 3 - ((v - lo) / (hi - lo)) * (H - 6);
    const d = h.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.min).toFixed(1)}`).join('');
    return `<div class="fl-spark"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg><span>최근 ${h.length}일 최저가 ${man(lo)} ~ ${man(hi)}</span></div>`;
  }

  // ───── 프로모션 탭 ─────
  // 항공사별 요약. 공식 홈페이지(제주항공·트리니티항공·비엣젯)와 뉴스 기사를 구분하고, 원문에 적힌 내용만 보여 줌 (가격 계산·추정 없음)
  const OFFICIAL_AIR = ['7C', 'TW', 'VJ'];
  const isLive = p => p.until ? p.until >= today : (p.lastFound || p.found) >= F.addDays(today, -21);
  const mmdd = s => s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : '';
  function promoItem(p, ps) {
    const where = (p.countries || []).filter(c => ps.countries.includes(c));
    const facts = p.official
      ? [p.from && p.until && p.from < p.until ? `기간 ${mmdd(p.from)}~${mmdd(p.until)}` : p.until ? `~${mmdd(p.until)}까지` : '', where.length ? `언급: ${where.join('·')}` : p.allRoutes ? '국제선 대상' : '']
      : [`${p.source || '뉴스'} · ${mmdd((p.date || '').slice(0, 10))} 보도`, where.length ? `언급: ${where.join('·')}` : p.allRoutes ? '국제선 언급' : '', p.more && p.more.length ? `같은 소식 기사 ${p.more.length}건 더` : ''];
    return `<li>
      <span class="${p.official ? 'badge-off' : 'badge-news'}">${p.official ? '공식' : '뉴스'}</span>
      <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a>
      ${p.official && p.desc && !p.title.includes(p.desc.slice(0, 15)) ? `<div class="desc">${esc(p.desc.slice(0, 120))}</div>` : ''}
      <div class="src">${esc(facts.filter(Boolean).join(' · '))}</div>
    </li>`;
  }
  function renderPromo() {
    const box = $('#promo'); if (!box) return;
    if (!data.loaded) { box.innerHTML = '<div class="empty">자료를 불러오는 중…</div>'; return; }
    const st = data.watch.settings, ps = F.promoSettings(st);
    const all = (data.promos.items || []).filter(p => p.kind === 'airline' && F.isWantedPromo(p, st) && isLive(p));
    const mine = p => (p.countries || []).filter(c => ps.countries.includes(c));
    const sel = ui.lcc || 'all';
    const shown = all.filter(p => sel === 'all' || (sel === '_all' ? !mine(p).length : mine(p).includes(sel)));
    const count = c => all.filter(p => c === '_all' ? !mine(p).length : mine(p).includes(c)).length;
    const chips = [['all', `전체 ${all.length}`], ...ps.countries.map(c => [c, `${c} ${count(c)}`]), ['_all', `국제선 전체 ${count('_all')}`]];
    const byAir = ps.airlines.map(code => ({ code, list: shown.filter(p => (p.airlines || []).find(a => ps.airlines.includes(a)) === code) }));
    const etc = shown.filter(p => !(p.airlines || []).some(a => ps.airlines.includes(a)));
    const sortList = l => l.sort((x, y) => (y.official ? 1 : 0) - (x.official ? 1 : 0) || (y.lastDate || y.date || '').localeCompare(x.lastDate || x.date || ''));
    const withItems = byAir.filter(g => g.list.length).sort((x, y) => y.list.filter(p => p.official).length - x.list.filter(p => p.official).length || y.list.length - x.list.length);
    const empty = byAir.filter(g => !g.list.length);
    box.innerHTML = `
      <section class="pr-head">
        <h2>항공권 프로모션 <small>${esc(ps.countries.join('·'))} · LCC · 진행 중이거나 최근 3주</small></h2>
        <div class="fl-chips">${chips.map(([v, t]) => `<button type="button" class="chip ${sel === v ? 'on' : ''}" data-act="lcc" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>
        <p class="hint">마지막 확인 ${esc(fmtUpdated(data.promos.updated))} · <span class="badge-off">공식</span> 항공사 홈페이지에서 직접 확인 · <span class="badge-news">뉴스</span> 기사 제목 그대로 (조건·가격은 원문에서 확인)</p>
      </section>
      ${withItems.map(g => {
        const a = F.airline(g.code);
        return `<article class="pr-air">
          <header><b>${esc(a.name)}</b><span class="pr-how">${OFFICIAL_AIR.includes(g.code) ? '공식 홈페이지 매일 확인' : '뉴스로만 확인'}</span>${a.url ? `<a href="${a.url}" target="_blank" rel="noopener">홈페이지${ICON.ext}</a>` : ''}</header>
          <ul>${sortList(g.list).map(p => promoItem(p, ps)).join('')}</ul>
        </article>`;
      }).join('')}
      ${etc.length ? `<article class="pr-air"><header><b>항공사 이름 없는 기사</b><span class="pr-how">여행사·카드사·종합 기사</span></header><ul>${sortList(etc).map(p => promoItem(p, ps)).join('')}</ul></article>` : ''}
      ${!withItems.length && !etc.length ? '<p class="muted pr-none">지금 조건에 맞는 특가 소식이 없어요.</p>' : ''}
      ${empty.length ? `<p class="pr-empty"><b>최근 확인된 소식 없음</b> · ${empty.map(g => { const a = F.airline(g.code); return a.url ? `<a href="${a.url}" target="_blank" rel="noopener">${esc(a.name)}</a>` : esc(a.name); }).join(' · ')}</p>` : ''}
      ${cardSection()}
      <p class="fl-foot">공식: 제주항공·트리니티항공·비엣젯 홈페이지 이벤트 목록을 매일 아침 확인해요. 진에어·에어부산·이스타 등은 사이트가 자동 확인을 막아서 뉴스로만 확인돼요(각 항공사 앱 알림을 켜 두면 가장 빨라요). 범위는 ⚙ 설정에서 바꿔요.</p>`;
  }

  function ruleText(r) {
    const where = !r.merchant || r.merchant === 'any' ? '어디서나' : `${F.airline(r.merchant).name}`;
    return `${where} ${r.kind === 'won' ? won(r.value) : `${r.value}%`} ${r.type || ''}${r.cap ? `(최대 ${man(r.cap)})` : ''}`.replace(/\s+/g, ' ').trim();
  }
  function cardSection() {
    const items = (data.promos.items || []).filter(p => p.kind === 'card' && isLive(p));
    return `<section class="fl-cards">
      <h2>💳 카드 할인 <small>우리·현대·신한</small></h2>
      <div class="fl-cardgrid">${F.CARDS.map(c => {
        const news = items.filter(p => (p.cards || []).includes(c.name)).sort((x, y) => (y.official ? 1 : 0) - (x.official ? 1 : 0)).slice(0, 4);
        const rules = cfg.cardRules.filter(r => r.card === c.short);
        return `<div class="fl-card">
          <div class="top"><b>${esc(c.name)}</b><a href="${c.url}" target="_blank" rel="noopener">이벤트 보기${ICON.ext}</a></div>
          ${news.length ? `<ul class="news">${news.map(p => `<li><span class="${p.official ? 'badge-off' : 'badge-news'}">${p.official ? esc(F.airline((p.airlines || [])[0]).name) : '뉴스'}</span> <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a> <small>${p.until ? `~${esc(mmdd(p.until))}` : esc(mmdd((p.date || '').slice(0, 10)))}</small></li>`).join('')}</ul>` : '<p class="muted">최근 3주 확인된 할인 소식 없음</p>'}
          ${rules.length ? `<ul class="rules">${rules.map(r => `<li>내 규칙: ${esc(ruleText(r))}${r.until ? ` · ~${esc(r.until.slice(5).replace('-', '/'))}` : ''}</li>`).join('')}</ul>` : ''}
        </div>`;
      }).join('')}</div>
      <div class="fl-actions"><button class="btn sm" data-act="card-add">${ICON.plus}내 카드 할인 등록</button><span class="hint">카드사 앱에서 확인한 즉시·청구할인을 넣으면 가격 탭에 반영돼요.</span></div>
    </section>`;
  }
  function tipsSection(dest) {
    return `<section class="fl-tips">
      <h2>결제 전 체크</h2>
      <ol>
        <li><b>최종 총액으로 비교</b> — 수하물·좌석 지정·결제 수수료까지 더한 금액으로 비교하세요. 위 가격에는 수하물이 포함됐는지 알 수 없어요.</li>
        <li><b>직판과 비교</b> — 최저가 판매처와 항공사 직판 차이가 1~2만 원 이내면 직판(변경·환불·결항 대응이 깔끔).</li>
        <li><b>해외 사이트는 현지 통화·USD로 결제</b> — 원화 결제(DCC)는 수수료가 이중으로 붙어요.</li>
        <li><b>인원</b> — 표시가는 1인 기준. ${cfg.q.adults}명을 한 번에 검색하면 싼 좌석이 모자라 더 비싸게 나올 수 있어요. 1명씩 나눠 예약할 수 있지만 좌석이 떨어질 수 있어요. 국제선은 만 12세부터 성인 운임.</li>
        <li><b>성수기·연휴 매진</b> — 여행사 블록좌석을 확인: ${F.AGENCIES.slice(0, 4).map(a => `<a href="${a.url}" target="_blank" rel="noopener">${esc(a.name)}</a>`).join(' · ')}. 환불·변경 조건은 결제 전에 꼭 확인.</li>
        <li><b>특가 운임</b> — 환불·변경·수하물 조건을 예약 화면에서 꼭 확인하세요.</li>
      </ol>
    </section>`;
  }

  // ───── 동작 ─────
  async function startWatch() {
    const dest = currentDest(), q = cfg.q;
    const w = { origin: q.origin, dest: dest.code, from: q.from < thisYM ? thisYM : q.from, to: q.to, minNights: q.minN, maxNights: q.maxN, direct: q.direct, adults: q.adults, targetPrice: 0, added: today };
    if (q.dest === '_custom') { w.destName = dest.city; w.region = dest.region; }
    if (!cfg.gh.token) { manualWatchSheet(w); return; }
    ui.busy = 'watch'; renderResults();
    try {
      await updateWatchFile(list => { list.watches = (list.watches || []).filter(x => F.routeKey(x) !== F.routeKey(w)); list.watches.push(w); return `추적 추가: ${dest.city} ${w.from}~${w.to}`; });
      toast('추적을 시작했어요. 지금 첫 확인을 돌려요');
      await dispatchAndWait();
    } catch (e) { toast(`등록 실패: ${e.message}`); }
    ui.busy = ''; renderResults();
  }
  async function updateWatchFile(mutator) {
    const g = cfg.gh;
    const f = await gh('GET', `/contents/data/watchlist.json?ref=${encodeURIComponent(g.branch)}`);
    const list = JSON.parse(b64utf8(f.content));
    const msg = mutator(list);
    await gh('PUT', '/contents/data/watchlist.json', { message: msg, content: utf8b64(JSON.stringify(list, null, 1) + '\n'), sha: f.sha, branch: g.branch });
    data.watch = list;
  }
  async function dispatchAndWait() {
    const before = data.results.updated;
    await gh('POST', '/actions/workflows/flight-check.yml/dispatches', { ref: cfg.gh.branch, inputs: { mode: 'check' } });
    ui.busy = 'refresh'; renderResults();
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 20000));
      const r = await fetchData('data/flight-results.json');
      if (r && r.updated !== before) { data.results = r; const p = await fetchData('data/promos.json'); if (p) data.promos = p; toast('새 가격을 받았어요'); break; }
    }
    ui.busy = '';
  }
  async function refresh() {
    if (!cfg.gh.token) { toast('설정에서 GitHub 연결을 먼저 해 주세요'); settingsSheet(); return; }
    ui.busy = 'refresh'; renderResults();
    try { await dispatchAndWait(); } catch (e) { toast(`갱신 실패: ${e.message}`); }
    ui.busy = ''; renderResults();
  }
  // 이 기기에서 바로 검색 (Travelpayouts가 브라우저 요청을 막으면 실패할 수 있어요)
  async function liveSearch() {
    const dest = currentDest(), q = cfg.q, key = curKey();
    ui.busy = 'live'; renderResults();
    live[key] = live[key] || {};
    let ok = 0, fail = '';
    for (const ym of F.monthsBetween(q.from, q.to).filter(m => m >= thisYM)) {
      const u = new URLSearchParams({ origin: q.origin, destination: dest.code, departure_at: ym, one_way: 'false', direct: String(q.direct), sorting: 'price', limit: '1000', currency: 'krw', token: cfg.tpToken });
      try {
        const j = await (await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${u}`)).json();
        if (j.success === false) { fail = j.error || '조회 실패'; continue; }
        const s = F.summarizeMonth(F.normalizeOffers(j), { month: ym, minNights: q.minN, maxNights: q.maxN, direct: q.direct });
        const prev = data.results.routes[key]?.months?.[ym] || {};
        live[key][ym] = { ...prev, ...s, checked: today };
        ok++;
      } catch { fail = '브라우저에서 직접 조회가 막혀 있어요. "매일 추적"을 써 주세요'; break; }
    }
    ui.busy = '';
    toast(ok ? `${ok}개월 가격을 받았어요` : fail || '받은 가격이 없어요');
    renderResults();
  }
  async function geocodeCustom() {
    const c = cfg.q.custom; if (!c || !c.en || c.geoTried === c.en) return;
    c.geoTried = c.en;
    try {
      const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c.en)}&count=1&language=ko`)).json();
      const r = j.results && j.results[0];
      if (r) { c.lat = r.latitude; c.lon = r.longitude; c.city = r.name || c.en; c.country = r.country || '기타'; save(); renderResults(); }
    } catch { /* 강수량 없이 진행 */ }
  }

  // ───── 시트(창) ─────
  function openSheet(title, body, foot, onMount) {
    sheetRoot.innerHTML = `<div class="sheet-scrim" data-scrim="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="btn icon ghost" data-close="1" aria-label="닫기">${ICON.close}</button></div>
      <form class="form" id="sheet-form" novalidate>${body}<div class="sheet-foot">${foot}</div></form></div></div>`;
    const root = sheetRoot.firstElementChild;
    const close = () => { sheetRoot.innerHTML = ''; document.body.classList.remove('sheet-open'); };
    root.addEventListener('click', e => { if (e.target.dataset.scrim || e.target.closest('[data-close]')) close(); });
    onMount && onMount(root, close);
    return close;
  }

  function settingsSheet() {
    const g = cfg.gh;
    const watches = data.watch.watches || [];
    openSheet('설정', `
      <h3 class="fl-h3">매일 추적 목록</h3>
      ${watches.length ? `<ul class="fl-wlist">${watches.map((w, i) => { const d = F.findDest(w.dest); return `<li><span>${esc(w.origin)}→${esc(d ? d.city : (w.destName || w.dest))} · ${esc(w.from)}~${esc(w.to)} · ${w.minNights}~${w.maxNights}박${w.targetPrice ? ` · 목표 ${man(w.targetPrice)}` : ''}</span><button type="button" class="btn sm ghost danger" data-del-watch="${i}" aria-label="추적 삭제">${ICON.trash}</button></li>`; }).join('')}</ul>` : '<p class="muted">없음</p>'}

      <h3 class="fl-h3">특가 알림 범위 <small>(매일 점검·알림에 적용)</small></h3>
      ${(() => {
        const ps = F.promoSettings(data.watch.settings);
        const lcc = Object.entries(F.AIRLINES).filter(([, a]) => a.type === 'LCC').sort((a, b) => a[1].name.localeCompare(b[1].name, 'ko'));
        return `<p class="hint">나라</p><div class="fl-picks">${F.COUNTRIES.map(c => `<label class="check-inline"><input type="checkbox" name="p-country" value="${esc(c)}" ${ps.countries.includes(c) ? 'checked' : ''}>${esc(c)}</label>`).join('')}</div>
          <p class="hint">항공사 (LCC)</p><div class="fl-picks">${lcc.map(([k, a]) => `<label class="check-inline"><input type="checkbox" name="p-air" value="${k}" ${ps.airlines.includes(k) ? 'checked' : ''}>${esc(a.name)}</label>`).join('')}</div>
          <button type="button" class="btn sm" data-save-scope="1">범위 저장</button>
          <p class="hint">${g.token ? '저장하면 내일 아침 점검부터 반영돼요(앱 목록은 바로 바뀜).' : 'GitHub 토큰이 있어야 여기서 저장돼요. 없으면 github.com에서 <b>data/watchlist.json</b>의 promoCountries·promoAirlines를 직접 고치면 돼요(SETUP.md 참고).'}</p>`;
      })()}

      <h3 class="fl-h3">GitHub 연결 <small>(추적 추가·지금 갱신용)</small></h3>
      <div class="grid3">
        <label class="field"><span>계정</span><input type="text" id="s-owner" value="${esc(g.owner)}"></label>
        <label class="field"><span>저장소</span><input type="text" id="s-repo" value="${esc(g.repo)}"></label>
        <label class="field"><span>브랜치</span><input type="text" id="s-branch" value="${esc(g.branch)}"></label>
      </div>
      <label class="field"><span>토큰 <span class="hint">이 기기에만 저장. 만드는 법은 SETUP.md</span></span><input type="password" id="s-token" value="${esc(g.token)}" placeholder="github_pat_…" autocomplete="off"></label>

      <h3 class="fl-h3">카드 할인 규칙</h3>
      ${cfg.cardRules.length ? `<ul class="fl-wlist">${cfg.cardRules.map((r, i) => `<li><span>${esc(r.card)} · ${esc(ruleText(r))}${r.until ? ` · ~${esc(r.until)}` : ''}${r.memo ? ` · ${esc(r.memo)}` : ''}</span><button type="button" class="btn sm ghost danger" data-del-rule="${i}" aria-label="규칙 삭제">${ICON.trash}</button></li>`).join('')}</ul>` : '<p class="muted">없음</p>'}
      <button type="button" class="btn sm" data-card-add="1">${ICON.plus}카드 할인 등록</button>

      <h3 class="fl-h3">이 기기에서 바로 검색 <small>(선택)</small></h3>
      <label class="field"><span>Travelpayouts 토큰</span><input type="password" id="s-tp" value="${esc(cfg.tpToken)}" autocomplete="off"></label>
      <p class="hint">브라우저 직접 조회는 막혀 있을 수 있어요. 안 되면 비워 두고 "매일 추적"만 쓰면 돼요.</p>`,
      `<button type="button" class="btn" data-close="1">닫기</button><button type="submit" class="btn primary">저장</button>`,
      (root, close) => {
        root.addEventListener('click', async e => {
          const dw = e.target.closest('[data-del-watch]'), dr = e.target.closest('[data-del-rule]');
          if (e.target.closest('[data-card-add]')) { close(); cardRuleSheet(); }
          if (e.target.closest('[data-save-scope]')) {
            const countries = [...root.querySelectorAll('input[name=p-country]:checked')].map(i => i.value);
            const airlines = [...root.querySelectorAll('input[name=p-air]:checked')].map(i => F.airline(i.value).name);
            if (!countries.length || !airlines.length) { toast('나라와 항공사를 하나 이상 골라 주세요'); return; }
            if (!cfg.gh.token) { toast('GitHub 토큰이 필요해요 (아래 GitHub 연결)'); return; }
            try {
              await updateWatchFile(list => { list.settings = Object.assign(list.settings || {}, { promoCountries: countries, promoAirlines: airlines }); delete list.settings.followAirlines; return `특가 범위 변경: ${countries.join('·')}`; });
              toast('특가 범위를 저장했어요'); close(); render();
            } catch (err) { toast(`저장 실패: ${err.message}`); }
          }
          if (dr) { cfg.cardRules.splice(Number(dr.dataset.delRule), 1); save(); close(); settingsSheet(); render(); }
          if (dw) {
            if (!cfg.gh.token) { toast('GitHub 토큰이 있어야 지울 수 있어요'); return; }
            const w = watches[Number(dw.dataset.delWatch)];
            try { await updateWatchFile(list => { list.watches = list.watches.filter(x => F.routeKey(x) !== F.routeKey(w)); return `추적 삭제: ${w.dest} ${w.from}~${w.to}`; }); toast('추적을 멈췄어요'); close(); settingsSheet(); renderResults(); }
            catch (err) { toast(`삭제 실패: ${err.message}`); }
          }
        });
        $('#sheet-form', root).addEventListener('submit', e => {
          e.preventDefault();
          const v = id => ($('#' + id, root).value || '').trim();
          cfg.gh = { owner: v('s-owner'), repo: v('s-repo'), branch: v('s-branch') || 'main', token: v('s-token') };
          cfg.tpToken = v('s-tp');
          save(); close(); toast('저장했어요');
          loadAll().then(render);
        });
      });
  }

  function cardRuleSheet() {
    const airlines = Object.entries(F.AIRLINES).sort((a, b) => a[1].name.localeCompare(b[1].name, 'ko'));
    openSheet('카드 할인 등록', `
      <div class="grid2">
        <label class="field"><span>카드</span><select id="c-card">${F.CARDS.map(c => `<option value="${c.short}">${c.name}</option>`).join('')}</select></label>
        <label class="field"><span>어디서 결제할 때</span><select id="c-merchant"><option value="any">어디서나(판매처 무관)</option>${airlines.map(([k, a]) => `<option value="${k}">${esc(a.name)} 직판</option>`).join('')}</select></label>
      </div>
      <div class="grid3">
        <label class="field"><span>할인</span><select id="c-kind"><option value="pct">% 할인</option><option value="won">원 할인</option></select></label>
        <label class="field"><span>값</span><input type="number" inputmode="decimal" id="c-value" placeholder="예: 7"></label>
        <label class="field"><span>종류</span><select id="c-type"><option>즉시할인</option><option>청구할인</option><option>캐시백</option></select></label>
      </div>
      <div class="grid3">
        <label class="field"><span>최대 할인(원)</span><input type="number" inputmode="numeric" id="c-cap" placeholder="없으면 비움"></label>
        <label class="field"><span>최소 결제(원)</span><input type="number" inputmode="numeric" id="c-min" placeholder="없으면 비움"></label>
        <label class="field"><span>끝나는 날</span><input type="date" id="c-until"></label>
      </div>
      <label class="field"><span>메모 <span class="hint">예: 트립닷컴 결제 시, 코드 SHINHAN7</span></span><input type="text" id="c-memo"></label>
      <p class="hint">"어디서나"는 판매처를 따지지 않고 모든 가격에 적용해요. 특정 사이트(트립닷컴 등)에서만 되는 할인은 메모에 적고 "어디서나"로 넣으면, 그 사이트에서 결제할 때의 예상가로 보면 돼요.</p>`,
      `<button type="button" class="btn" data-close="1">취소</button><button type="submit" class="btn primary">등록</button>`,
      (root, close) => {
        $('#sheet-form', root).addEventListener('submit', e => {
          e.preventDefault();
          const v = id => ($('#' + id, root).value || '').trim();
          const value = Number(v('c-value'));
          if (!(value > 0)) { toast('할인 값을 넣어 주세요'); return; }
          cfg.cardRules.push({ card: v('c-card'), merchant: v('c-merchant'), kind: v('c-kind'), value, type: v('c-type'), cap: Number(v('c-cap')) || 0, min: Number(v('c-min')) || 0, until: v('c-until'), memo: v('c-memo') });
          save(); close(); render(); toast('가격에 반영했어요');
        });
      });
  }

  function watchEditSheet() {
    const key = curKey(), w = watchOf(key); if (!w) return;
    openSheet('추적 설정', `
      <div class="grid2">
        <label class="field"><span>언제부터</span><input type="month" id="w-from" value="${esc(w.from)}"></label>
        <label class="field"><span>언제까지</span><input type="month" id="w-to" value="${esc(w.to)}"></label>
      </div>
      <label class="field"><span>목표가(1인 왕복, 원) <span class="hint">이 값 이하로 나오면 알림</span></span><input type="number" inputmode="numeric" step="10000" id="w-target" value="${w.targetPrice || ''}" placeholder="예: 300000"></label>
      <p class="hint">목표가가 없어도 지난 30일 평균보다 ${data.watch.settings?.notifyDropPct || 15}% 이상 싸지거나 기록 최저가가 나오면 알려 줘요.</p>`,
      `<button type="button" class="btn" data-close="1">취소</button><button type="submit" class="btn primary">저장</button>`,
      (root, close) => {
        $('#sheet-form', root).addEventListener('submit', async e => {
          e.preventDefault();
          if (!cfg.gh.token) { toast('GitHub 토큰이 있어야 바꿀 수 있어요'); return; }
          const from = $('#w-from', root).value, to = $('#w-to', root).value, target = Number($('#w-target', root).value) || 0;
          try { await updateWatchFile(list => { const x = list.watches.find(y => F.routeKey(y) === key); if (x) { x.from = from; x.to = to; x.targetPrice = target; } return `추적 설정 변경: ${w.dest}`; }); close(); toast('저장했어요'); renderResults(); }
          catch (err) { toast(`저장 실패: ${err.message}`); }
        });
      });
  }

  function manualWatchSheet(w) {
    const line = JSON.stringify(w);
    openSheet('매일 추적 시작', `
      <p style="margin:0">추적 목록은 GitHub 저장소의 <code>data/watchlist.json</code>에 있어요. 두 가지 방법 중 하나를 고르세요.</p>
      <ol class="fl-steps">
        <li><b>편한 방법</b>: 설정(⚙)에 GitHub 토큰을 한 번 넣으면, 이 버튼 하나로 추가·갱신돼요. (토큰 만드는 법: 저장소의 SETUP.md)</li>
        <li><b>직접 넣기</b>: github.com에서 <code>data/watchlist.json</code>을 열고 연필(✏️)을 눌러 <code>"watches": [</code> 안에 아래 한 줄을 추가 → Commit.</li>
      </ol>
      <textarea readonly id="w-line" rows="4">${esc(line)}</textarea>`,
      `<button type="button" class="btn" data-copy="1">복사</button><a class="btn" href="https://github.com/${esc(cfg.gh.owner)}/${esc(cfg.gh.repo)}/edit/${esc(cfg.gh.branch)}/data/watchlist.json" target="_blank" rel="noopener">GitHub에서 열기</a><button type="button" class="btn primary" data-open-settings="1">토큰 넣기</button>`,
      (root, close) => {
        root.addEventListener('click', e => {
          if (e.target.closest('[data-copy]')) { navigator.clipboard?.writeText(line).then(() => toast('복사했어요'), () => { $('#w-line', root).select(); }); }
          if (e.target.closest('[data-open-settings]')) { close(); settingsSheet(); }
        });
      });
  }

  let toastTimer;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3000); }

  // ───── 이벤트 ─────
  app.addEventListener('submit', e => {
    if (e.target.id !== 'search') return;
    e.preventDefault(); readForm(); render();
    setTimeout(() => $('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  });
  app.addEventListener('change', e => {
    if (e.target.id === 'q-country') {
      const c = e.target.value;
      if (c === '_custom') { cfg.q.dest = '_custom'; cfg.q.custom = cfg.q.custom || { code: '', en: '', region: 'sea' }; }
      else cfg.q.dest = (F.DESTS.find(d => d.country === c) || F.DESTS[0]).code;
      readFormKeepDest(); render();
    } else if (e.target.closest('#search') && e.target.type !== 'text') { readForm(); render(); }
  });
  function readFormKeepDest() {
    const d = cfg.q.dest;
    const v = id => $('#' + id)?.value;
    cfg.q.origin = 'SEL'; cfg.q.from = v('q-from') || cfg.q.from; cfg.q.to = v('q-to') || cfg.q.to;
    cfg.q.dest = d; save();
  }
  app.addEventListener('toggle', e => { const d = e.target.closest?.('details[data-ym]'); if (d) ui.open[d.dataset.ym] = d.open; }, true);
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'settings') settingsSheet();
    else if (act === 'watch') startWatch();
    else if (act === 'watch-edit') watchEditSheet();
    else if (act === 'refresh') refresh();
    else if (act === 'live') liveSearch();
    else if (act === 'card-add') cardRuleSheet();
    else if (act === 'sort') { cfg.sort = b.dataset.v; save(); renderResults(); }
    else if (act === 'lcc') { ui.lcc = b.dataset.v; renderPromo(); }
    else if (act === 'tab') { ui.tab = b.dataset.v; try { localStorage.setItem('flightdeal-tab', ui.tab); } catch { /* 저장 불가 */ } render(); window.scrollTo(0, 0); }
  });

  // 알림에서 눌러 들어온 경우: #r=SEL-CXR-3-5-A&m=2027-01
  function fromHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const r = h.get('r'); if (!r) return null;
    const [origin, dest, minN, maxN, dir] = r.split('-');
    if (!F.findDest(dest)) return null;
    Object.assign(cfg.q, { origin: 'SEL', dest, minN: Number(minN), maxN: Number(maxN), direct: true });
    const w = (data.watch.watches || []).find(x => F.routeKey(x) === r);
    if (w) { cfg.q.from = w.from; cfg.q.to = w.to; }
    return h.get('m');
  }

  render();
  loadAll().then(() => {
    const m = fromHash();
    render();
    if (m) setTimeout(() => $(`#m-${m}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  });
})();
