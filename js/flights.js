/* 최저가 항공권 화면
   - [검색]·[지금 확인]을 누르면 GitHub Actions(scripts/flight-check.js)가 서버에서 조회해 data/ 폴더에 저장하고, 이 화면이 그걸 읽어 보여 줘요. 매일 자동 실행은 없어요.
   - 이 기기 설정(검색 조건, GitHub 연결)은 이 기기에만 저장돼요. */
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
    gh: { ...guessRepo(), branch: 'main', token: '' },
  };
  let cfg;
  try { cfg = Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { cfg = { ...DEFAULT }; }
  cfg.q = Object.assign({}, DEFAULT.q, cfg.q); cfg.q.direct = true; /* 경유편은 아예 보지 않음 */ cfg.q.origin = 'SEL'; /* 출발은 서울(인천·김포) 고정 */ cfg.gh = Object.assign({}, DEFAULT.gh, cfg.gh);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* 저장 불가(사생활 보호 모드) */ } };

  // ───── 자료 불러오기 ─────
  const data = { routes: null, promos: { items: [] }, watch: { settings: {}, watches: [] }, loaded: false, error: '' };
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
    const [p, w, rt] = await Promise.all([fetchData('data/promos.json'), fetchData('data/watchlist.json'), fetchData('data/airlines-by-city.json')]);
    data.routes = rt || null;
    if (p) data.promos = Object.assign({ items: [] }, p);
    if (w) data.watch = Object.assign({ settings: {}, watches: [] }, w);
    data.loaded = true;
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
    renderInfo();
  }
  // ───── 현재 검색 ─────
  function currentDest() {
    const q = cfg.q;
    if (q.dest === '_custom' && q.custom) return { country: q.custom.country || '기타', city: q.custom.city || q.custom.code, alias: [], code: q.custom.code, link: q.custom.code, lat: q.custom.lat, lon: q.custom.lon, region: q.custom.region || 'sea', clim: '' };
    return F.findDest(q.dest) || F.DESTS[0];
  }

  // ───── 화면 ─────
  let ui = { busy: '', open: {}, tab: (() => { try { return localStorage.getItem('flightdeal-tab') || 'price'; } catch { return 'price'; } })() };
  function render() {
    const q = cfg.q;
    const countries = [...new Set(F.DESTS.map(d => d.country))];
    const dest = currentDest();
    const country = q.dest === '_custom' ? '_custom' : dest.country;
    const { dep, ret } = quickDates();
    app.innerHTML = `
      <div class="wrap">
        <header class="topbar">
          <div class="grow brand">최저가 항공권</div>
          <button class="btn icon sm" data-act="settings" aria-label="설정">${ICON.gear}</button>
        </header>
        ${ui.tab === 'price' ? '<div class="fl-season" id="info"></div>' : ''}
        <nav class="fl-tabs" role="tablist">
          <button role="tab" aria-selected="${ui.tab === 'price'}" data-act="tab" data-v="price">항공권 검색</button>
          <button role="tab" aria-selected="${ui.tab === 'promo'}" data-act="tab" data-v="promo">프로모션</button>
          <button role="tab" aria-selected="${ui.tab === 'card'}" data-act="tab" data-v="card">카드</button>
        </nav>
        ${ui.tab === 'promo' ? '<div id="promo"></div>' : ui.tab === 'card' ? '<div id="cards"></div>' : `
        <form class="fl-search" id="search" novalidate>
          <div class="grid2 g-where">
            <label class="field"><span>나라</span><select id="q-country">${countries.map(c => `<option ${c === country ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="_custom" ${country === '_custom' ? 'selected' : ''}>직접 입력</option></select></label>
            <label class="field"><span>도시</span><select id="q-dest">${country === '_custom' ? '<option value="_custom">직접 입력</option>' : F.DESTS.filter(d => d.country === country).map(d => `<option value="${d.code}" ${d.code === dest.code ? 'selected' : ''}>${esc(d.city)}</option>`).join('')}</select></label>
          </div>
          ${country === '_custom' ? `<div class="grid2">
            <label class="field"><span>공항·도시 코드</span><input type="text" id="q-ccode" maxlength="3" placeholder="예: KTM" value="${esc(q.custom?.code || '')}" autocapitalize="characters"></label>
            <label class="field"><span>도시 이름(영문)</span><input type="text" id="q-cname" placeholder="예: Kathmandu" value="${esc(q.custom?.en || '')}"></label>
          </div>` : ''}
          <div class="grid2">
            <label class="field"><span>가는 날</span><input type="date" id="qk-dep" value="${dep}" min="${today}"></label>
            <label class="field"><span>오는 날 <small class="muted" id="qk-nights">${F.nightsBetween(dep, ret)}박</small></span><input type="date" id="qk-ret" value="${ret}" min="${dep}"></label>
          </div>
          <label class="field"><span>인원</span><select id="q-adults">${Array.from({ length: 9 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === q.adults ? 'selected' : ''}>${n}명</option>`).join('')}</select></label>
          <p class="hint fl-fixed">출발 서울(인천·김포) · 직항</p>
          <div id="quick">${quickButtons()}</div>
        </form>
`}
      </div>`;
    if (ui.tab === 'promo') renderPromo(); else if (ui.tab === 'card') renderCards(); else renderInfo();
  }

  // ───── 바로 검색: 고른 목적지·날짜·인원을 네이버·구글·스카이스캐너 검색에 그대로 넣음 ─────
  function quickDates() {
    const q = cfg.q;
    const first = q.from >= thisYM ? `${q.from}-10` : F.addDays(today, 14);
    let dep = q.dep && q.dep >= today ? q.dep : (first < today ? F.addDays(today, 14) : first);
    let ret = q.ret && q.ret > dep ? q.ret : F.addDays(dep, q.minN || 3);
    return { dep, ret };
  }
  function quickButtons() {
    const q = cfg.q, dest = currentDest();
    if (!/^[A-Z]{3}$/.test(dest.code || '')) return '<p class="muted">공항·도시 코드(영문 3글자)를 넣어 주세요.</p>';
    const { dep, ret } = quickDates();
    const L = F.links('SEL', dest, dep, ret, q.adults, { direct: true });
    return `<div class="fl-quick-go">
        <a class="btn primary" href="${L.naver}" target="_blank" rel="noopener">네이버</a>
        <a class="btn primary" href="${L.google}" target="_blank" rel="noopener">구글</a>
        <a class="btn primary" href="${L.sky}" target="_blank" rel="noopener">스카이스캐너</a>
      </div>
      <a class="fl-quick-month" href="${F.skyMonth('SEL', dest, dep.slice(0, 7), ret.slice(0, 7), q.adults, true)}" target="_blank" rel="noopener">날짜를 아직 못 정했으면: 스카이스캐너 ${Number(dep.slice(5, 7))}월 전체 날짜별 가격 보기${ICON.ext}</a>
      <p class="hint">고른 도시·날짜·인원이 그대로 들어가요. 직항 조건은 네이버·스카이스캐너는 주소로 넣고 구글은 검색어로 넣어서, 사이트에서 한 번 더 확인해 주세요.</p>
      <div class="fl-sub"><b>땡처리닷컴</b> <small>인천 출발 · 날짜와 상관없이 그 도시 땡처리 좌석 전체</small></div>
      <div class="fl-quick-go two">
        <a class="btn" href="${F.ttang(dest, q.adults).city}" target="_blank" rel="noopener">${esc(dest.city.replace(/\(.*\)/, ''))} 땡처리</a>
        <a class="btn" href="${F.ttang(dest, q.adults).today}" target="_blank" rel="noopener">오늘 오픈 땡처리</a>
      </div>
      ${airlineBox(dest)}`;
  }

  // 항공사 바로가기: 최근 가격 기록으로 확인된 '서울 출발 직항' 항공사 (data/airlines-by-city.json) + 그 외 국적 항공사(미확인, 접어 둠)
  function airlineBtn(code, name) {
    const known = F.AIRLINES[code], a = F.airline(code), label = known ? a.name : (name || code);
    const href = a.url || `https://www.google.com/search?q=${encodeURIComponent(`${label} 항공 홈페이지`)}`; // 홈페이지 주소를 모르는 항공사는 검색으로
    return `<a class="btn sm" href="${href}" target="_blank" rel="noopener">${esc(label)}</a>`;
  }
  function airlineBox(dest) {
    const R = data.routes, list = R && R.cities ? R.cities[dest.code] : null;
    const head = `<div class="fl-sub"><b>항공사</b> <small>앱이 깔려 있고 항공사가 지원하면 앱으로, 아니면 홈페이지로 열려요 · 날짜는 다시 골라 주세요</small></div>`;
    if (!list) {
      return `${head}<p class="hint">${R ? '이 도시는 직항 항공사 자료가 없어요.' : '도시별 직항 항공사 목록이 아직 없어요. ⚙ 설정 → [항공사 목록 새로 만들기]를 눌러 주세요.'}</p>
        <details class="fl-more-air"><summary>국적 항공사 전체 (운항 여부 미확인)</summary><div class="fl-air-go">${F.KOREAN_AIRLINES.map(c => airlineBtn(c)).join('')}</div></details>`;
    }
    const ok = list.map(x => x.code);
    const rest = F.KOREAN_AIRLINES.filter(c => !ok.includes(c));
    return `${head}
      ${list.length ? `<div class="fl-air-go">${list.map(x => airlineBtn(x.code, x.name)).join('')}</div>` : '<p class="muted">최근 기록에서 확인된 직항 항공사가 없어요.</p>'}
      <p class="hint">서울 → ${esc(dest.city.replace(/\(.*\)/, ''))} 직항 가격이 최근 기록된 항공사예요 (${esc(fmtUpdated(R.updated))} 기준, 앞으로 6개월). 가격 기록이 없으면 빠질 수 있어요.</p>
      ${rest.length ? `<details class="fl-more-air"><summary>그 외 국적 항공사 ${rest.length}곳 (이 노선 운항 여부 미확인)</summary><div class="fl-air-go">${rest.map(c => airlineBtn(c)).join('')}</div></details>` : ''}`;
  }

  // 고른 날짜의 여행 시기 정보 한 줄 (확인된 자료만: 목적지 기후표, Open-Meteo 관측 비 오는 날, 겹치는 공휴일·방학)
  function renderInfo() {
    const box = $('#info'); if (!box) return;
    const dest = currentDest();
    if (!/^[A-Z]{3}$/.test(dest.code || '')) { box.textContent = ''; return; }
    const { dep, ret } = quickDates();
    const C = clim[dest.code];
    const parts = [`${dest.city.replace(/\(.*\)/, '')} ${mmdd(dep)}~${mmdd(ret)}`];
    for (const ym of [...new Set([dep.slice(0, 7), ret.slice(0, 7)])]) {
      const m = Number(ym.slice(5)), cl = F.climateOf(dest, m), c = C?.months?.[m - 1];
      parts.push(`${m}월 ${cl ? cl.label : ''}${c ? `${cl ? ', ' : ''}비 ${c.wet}일` : ''}`.trim());
      for (const h of F.holidaysIn(ym).filter(h => h.to >= dep && h.from <= ret)) parts.push(`${h.name} ${mmdd(h.from)}${h.to !== h.from ? `~${mmdd(h.to)}` : ''}`);
      if (F.PEAK[m]) parts.push(F.PEAK[m]);
    }
    const line = [...new Set(parts)].join(' · ');
    box.textContent = line; box.title = `${line}${C?.months ? ' (비 오는 날: Open-Meteo 최근 10년 평균)' : ''}`;
    if (!dest.clim && dest.lat == null && cfg.q.custom?.en) geocodeCustom();
    else if (dest.lat != null) loadClimate(dest);
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
    q.adults = Number(v('q-adults')) || q.adults;
    q.wantBag = false; q.direct = true;
    save();
  }

  function fmtUpdated(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const fmtDay = s => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}(${F.weekday(s)})`;

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
    const chips = [['all', `전체 ${all.length}`], ...ps.countries.map(c => [c, `${c} ${count(c)}`]), ['_all', `그 외·전 노선 ${count('_all')}`]];
    const byAir = ps.airlines.map(code => ({ code, list: shown.filter(p => (p.airlines || []).find(a => ps.airlines.includes(a)) === code) }));
    const etc = shown.filter(p => !(p.airlines || []).some(a => ps.airlines.includes(a)));
    const sortList = l => l.sort((x, y) => (y.official ? 1 : 0) - (x.official ? 1 : 0) || (y.lastDate || y.date || '').localeCompare(x.lastDate || x.date || ''));
    const withItems = byAir.filter(g => g.list.length).sort((x, y) => y.list.filter(p => p.official).length - x.list.filter(p => p.official).length || y.list.length - x.list.length);
    const empty = byAir.filter(g => !g.list.length);
    box.innerHTML = `
      <section class="pr-head">
        <h2>항공권 프로모션 <small>전체 항공사 · 진행 중이거나 최근 3주</small></h2>
        <div class="fl-chips">${chips.map(([v, t]) => `<button type="button" class="chip ${sel === v ? 'on' : ''}" data-act="lcc" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>
        <div class="fl-actions"><button type="button" class="btn sm primary" data-act="promo-refresh" ${ui.promoBusy ? 'disabled' : ''}>${ICON.refresh}${ui.promoBusy ? `확인 중… ${ui.promoBusy.sec}초 (보통 1~2분)` : '지금 확인'}</button></div>
        <p class="hint">마지막 확인 ${esc(fmtUpdated(data.promos.updated))} · <span class="badge-off">공식</span> 항공사 홈페이지에서 직접 확인 · <span class="badge-news">뉴스</span> 기사 제목 그대로 (조건·가격은 원문에서 확인)</p>
      </section>
      ${withItems.map(g => {
        const a = F.airline(g.code);
        return `<article class="pr-air">
          <header><b>${esc(a.name)}</b><span class="pr-how">${OFFICIAL_AIR.includes(g.code) ? '공식 홈페이지 확인' : '뉴스로만 확인'}</span>${a.url ? `<a href="${a.url}" target="_blank" rel="noopener">홈페이지${ICON.ext}</a>` : ''}</header>
          <ul>${sortList(g.list).map(p => promoItem(p, ps)).join('')}</ul>
        </article>`;
      }).join('')}
      ${etc.length ? `<article class="pr-air"><header><b>항공사 이름 없는 기사</b><span class="pr-how">여행사·카드사·종합 기사</span></header><ul>${sortList(etc).map(p => promoItem(p, ps)).join('')}</ul></article>` : ''}
      ${!withItems.length && !etc.length ? '<p class="muted pr-none">지금 조건에 맞는 특가 소식이 없어요.</p>' : ''}
      ${empty.length ? `<p class="pr-empty"><b>최근 확인된 소식 없음</b> · ${empty.map(g => { const a = F.airline(g.code); return a.url ? `<a href="${a.url}" target="_blank" rel="noopener">${esc(a.name)}</a>` : esc(a.name); }).join(' · ')}</p>` : ''}
      <p class="fl-foot">[지금 확인]을 누르면 제주항공·트리니티항공·비엣젯 홈페이지 이벤트 목록과 특가 뉴스를 확인해요(매일 자동 확인은 하지 않아요). 진에어·에어부산·이스타 등은 사이트가 자동 확인을 막아서 뉴스로만 확인돼요(각 항공사 앱 알림을 켜 두면 가장 빨라요). 범위는 ⚙ 설정에서 바꿔요.</p>`;
  }

  // ───── 카드 탭: 우리·현대·신한 할인 소식 + 항공사 공식 결제 혜택 ─────
  function renderCards() {
    const box = $('#cards'); if (!box) return;
    if (!data.loaded) { box.innerHTML = '<div class="empty">자료를 불러오는 중…</div>'; return; }
    const pay = (data.promos.items || []).filter(p => F.isPayBenefit(p) && isLive(p)).sort((a, b) => (a.until || '9').localeCompare(b.until || '9'));
    box.innerHTML = `
      <section class="pr-head">
        <h2>카드·결제 할인</h2>
        <div class="fl-actions"><button type="button" class="btn sm primary" data-act="promo-refresh" ${ui.promoBusy ? 'disabled' : ''}>${ICON.refresh}${ui.promoBusy ? `확인 중… ${ui.promoBusy.sec}초 (보통 1~2분)` : '지금 확인'}</button></div>
        <p class="hint">마지막 확인 ${esc(fmtUpdated(data.promos.updated))} · 프로모션 탭과 같이 확인돼요</p>
      </section>
      ${cardSection()}
      <section class="fl-cards">
        <h2>✈️ 항공사 결제 혜택 <small>항공사 홈페이지 공지 그대로</small></h2>
        ${pay.length ? `<ul class="news">${pay.map(p => `<li><span class="badge-off">${esc(F.airline((p.airlines || [])[0]).name)}</span> <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a> <small>${p.until ? `~${esc(mmdd(p.until))}` : ''}</small></li>`).join('')}</ul>` : '<p class="muted">지금 확인된 결제 혜택이 없어요.</p>'}
      </section>`;
  }

  function cardSection() {
    const items = (data.promos.items || []).filter(p => p.kind === 'card' && isLive(p));
    return `<section class="fl-cards">
      <h2>💳 카드 할인 <small>우리·현대·신한</small></h2>
      <div class="fl-cardgrid">${F.CARDS.map(c => {
        const news = items.filter(p => (p.cards || []).includes(c.name)).sort((x, y) => (y.official ? 1 : 0) - (x.official ? 1 : 0)).slice(0, 4);
        return `<div class="fl-card">
          <div class="top"><b>${esc(c.name)}</b><a href="${c.url}" target="_blank" rel="noopener">이벤트 보기${ICON.ext}</a></div>
          ${news.length ? `<ul class="news">${news.map(p => `<li><span class="${p.official ? 'badge-off' : 'badge-news'}">${p.official ? esc(F.airline((p.airlines || [])[0]).name) : '뉴스'}</span> <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)}</a> <small>${p.until ? `~${esc(mmdd(p.until))}` : esc(mmdd((p.date || '').slice(0, 10)))}</small></li>`).join('')}</ul>` : '<p class="muted">최근 3주 확인된 할인 소식 없음</p>'}
        </div>`;
      }).join('')}</div>
    </section>`;
  }
  // ───── 동작 ─────
  async function updateWatchFile(mutator) {
    const g = cfg.gh;
    const f = await gh('GET', `/contents/data/watchlist.json?ref=${encodeURIComponent(g.branch)}`);
    const list = JSON.parse(b64utf8(f.content));
    const msg = mutator(list);
    await gh('PUT', '/contents/data/watchlist.json', { message: msg, content: utf8b64(JSON.stringify(list, null, 1) + '\n'), sha: f.sha, branch: g.branch });
    data.watch = list;
  }
  // 서버(GitHub Actions)에서 실행하고 결과 파일이 바뀔 때까지 기다림
  async function runOnServer(inputs, file, isDone, onTick, maxSec = 240) {
    await gh('POST', '/actions/workflows/flight-check.yml/dispatches', { ref: cfg.gh.branch, inputs });
    const t0 = Date.now();
    const tick = setInterval(() => onTick(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      while ((Date.now() - t0) / 1000 < maxSec) {
        await new Promise(r => setTimeout(r, 5000));
        let j = null;
        try { const f = await gh('GET', `/contents/${file}?ref=${encodeURIComponent(cfg.gh.branch)}&t=${Date.now()}`); j = JSON.parse(b64utf8(f.content)); } catch { /* 아직 없음 */ }
        if (j && isDone(j)) return j;
      }
      throw new Error('시간 초과 (GitHub Actions 기록을 확인하세요)');
    } finally { clearInterval(tick); }
  }
  function needToken() {
    if (cfg.gh.token) return false;
    toast('검색하려면 설정에서 GitHub 토큰을 먼저 넣어 주세요');
    settingsSheet();
    return true;
  }
  async function refreshPromos() {
    if (ui.promoBusy || needToken()) return;
    const before = data.promos.updated || '';
    ui.promoBusy = { sec: 0 }; renderPromo(); renderCards();
    try {
      const p = await runOnServer({ mode: 'promos' }, 'data/promos.json', j => (j.updated || '') > before,
        sec => { if (ui.promoBusy) { ui.promoBusy.sec = sec; const b = $('[data-act="promo-refresh"]'); if (b) b.textContent = `확인 중… ${sec}초 (보통 1~2분)`; } }, 300);
      data.promos = Object.assign({ items: [] }, p);
      toast('프로모션을 새로 확인했어요');
    } catch (e) { toast(`확인 실패: ${e.message}`); }
    ui.promoBusy = null; renderPromo(); renderCards();
  }
  async function geocodeCustom() {
    const c = cfg.q.custom; if (!c || !c.en || c.geoTried === c.en) return;
    c.geoTried = c.en;
    try {
      const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c.en)}&count=1&language=ko`)).json();
      const r = j.results && j.results[0];
      if (r) { c.lat = r.latitude; c.lon = r.longitude; c.city = r.name || c.en; c.country = r.country || '기타'; save(); renderInfo(); }
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
    openSheet('설정', `
      <h3 class="fl-h3">GitHub 연결 <small>(프로모션 [지금 확인] 버튼에 필요)</small></h3>
      <label class="field"><span>토큰 <span class="hint">이 기기에만 저장돼요. 만드는 법은 SETUP.md</span></span><input type="password" id="s-token" value="${esc(g.token)}" placeholder="github_pat_…" autocomplete="off"></label>
      <details class="fl-adv"><summary>저장소 정보 (보통 그대로 두세요)</summary>
        <div class="grid3">
          <label class="field"><span>계정</span><input type="text" id="s-owner" value="${esc(g.owner)}"></label>
          <label class="field"><span>저장소</span><input type="text" id="s-repo" value="${esc(g.repo)}"></label>
          <label class="field"><span>브랜치</span><input type="text" id="s-branch" value="${esc(g.branch)}"></label>
        </div>
      </details>

      <h3 class="fl-h3">도시별 직항 항공사 목록</h3>
      <p class="hint">마지막으로 만든 날: ${esc(data.routes ? fmtUpdated(data.routes.updated) : '없음')} · 노선이 바뀌었을 때 가끔 눌러 주세요 (2~3분)</p>
      <button type="button" class="btn sm" data-routes-refresh="1">${ICON.refresh}항공사 목록 새로 만들기</button>

      <h3 class="fl-h3">프로모션 범위 <small>(프로모션 탭에 적용)</small></h3>
      ${(() => {
        const ps = F.promoSettings(data.watch.settings);
        const order = [...F.PROMO_DEFAULT.airlines, ...Object.keys(F.AIRLINES).filter(k => !F.PROMO_DEFAULT.airlines.includes(k))];
        const lcc = order.map(k => [k, F.airline(k)]);
        return `<p class="hint">나라</p><div class="fl-picks">${F.COUNTRIES.map(c => `<label class="check-inline"><input type="checkbox" name="p-country" value="${esc(c)}" ${ps.countries.includes(c) ? 'checked' : ''}>${esc(c)}</label>`).join('')}</div>
          <p class="hint">항공사 (기본: 국적 항공사 + 베트남·일본 항공사)</p><div class="fl-picks">${lcc.map(([k, a]) => `<label class="check-inline"><input type="checkbox" name="p-air" value="${k}" ${ps.airlines.includes(k) ? 'checked' : ''}>${esc(a.name)}</label>`).join('')}</div>
          <button type="button" class="btn sm" data-save-scope="1">범위 저장</button>
          <p class="hint">${g.token ? '저장하면 목록은 바로 바뀌고, 검색어는 다음 [지금 확인]부터 반영돼요.' : 'GitHub 토큰이 있어야 여기서 저장돼요. 없으면 github.com에서 <b>data/watchlist.json</b>의 promoCountries·promoAirlines를 직접 고치면 돼요(SETUP.md 참고).'}</p>`;
      })()}`,
      `<button type="button" class="btn" data-close="1">닫기</button><button type="submit" class="btn primary">저장</button>`,
      (root, close) => {
        root.addEventListener('click', async e => {
          const rb = e.target.closest('[data-routes-refresh]');
          if (rb) {
            if (needToken()) return;
            const before = data.routes?.updated || '';
            rb.disabled = true;
            try {
              const r = await runOnServer({ mode: 'routes' }, 'data/airlines-by-city.json', j => (j.updated || '') > before, sec => { rb.textContent = `만드는 중… ${sec}초 (2~3분)`; }, 420);
              data.routes = r; toast('항공사 목록을 새로 만들었어요'); close(); render();
            } catch (err) { toast(`실패: ${err.message}`); rb.disabled = false; rb.textContent = '항공사 목록 새로 만들기'; }
            return;
          }
          if (e.target.closest('[data-save-scope]')) {
            const countries = [...root.querySelectorAll('input[name=p-country]:checked')].map(i => i.value);
            const airlines = [...root.querySelectorAll('input[name=p-air]:checked')].map(i => F.airline(i.value).name);
            if (!countries.length || !airlines.length) { toast('나라와 항공사를 하나 이상 골라 주세요'); return; }
            if (!cfg.gh.token) { toast('GitHub 토큰이 필요해요 (위 GitHub 연결)'); return; }
            try {
              await updateWatchFile(list => { list.settings = Object.assign(list.settings || {}, { promoCountries: countries, promoAirlines: airlines }); delete list.settings.followAirlines; return `특가 범위 변경: ${countries.join('·')}`; });
              toast('특가 범위를 저장했어요'); close(); render();
            } catch (err) { toast(`저장 실패: ${err.message}`); }
          }
        });
        $('#sheet-form', root).addEventListener('submit', e => {
          e.preventDefault();
          const v = id => ($('#' + id, root).value || '').trim();
          cfg.gh = { owner: v('s-owner'), repo: v('s-repo'), branch: v('s-branch') || 'main', token: v('s-token') };
          save(); close(); toast('저장했어요');
          loadAll().then(render);
        });
      });
  }

  let toastTimer;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3000); }

  // ───── 이벤트 ─────
  app.addEventListener('submit', e => {
    if (e.target.id !== 'search') return;
    e.preventDefault(); readForm(); render();
  });
  app.addEventListener('change', e => {
    if (e.target.id === 'q-country') {
      const c = e.target.value;
      if (c === '_custom') { cfg.q.dest = '_custom'; cfg.q.custom = cfg.q.custom || { code: '', en: '', region: 'sea' }; }
      else cfg.q.dest = (F.DESTS.find(d => d.country === c) || F.DESTS[0]).code;
      readFormKeepDest(); render();
    } else if (e.target.closest('#search') && e.target.type !== 'text' && e.target.type !== 'date') { readForm(); render(); }
  });
  function readFormKeepDest() { cfg.q.origin = 'SEL'; save(); }
  app.addEventListener('change', e => {
    if (e.target.id !== 'qk-dep' && e.target.id !== 'qk-ret') return;
    const q = cfg.q, dep = $('#qk-dep').value, ret = $('#qk-ret').value;
    if (e.target.id === 'qk-dep' && dep) { const n = q.dep && q.ret ? F.nightsBetween(q.dep, q.ret) : q.minN; q.dep = dep; if (!ret || ret <= dep || e.target.id === 'qk-dep') q.ret = F.addDays(dep, Math.max(1, n || 3)); }
    if (e.target.id === 'qk-ret' && ret) q.ret = ret;
    save();
    const d = quickDates(); $('#qk-ret').value = d.ret; $('#qk-ret').min = d.dep; $('#qk-nights').textContent = `${F.nightsBetween(d.dep, d.ret)}박`;
    $('#quick').innerHTML = quickButtons(); renderInfo();
  });
  // 직접 입력한 코드·도시 이름은 입력이 끝나면 반영
  app.addEventListener('change', e => { if (e.target.id === 'q-ccode' || e.target.id === 'q-cname') { readForm(); render(); } });
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'settings') settingsSheet();
    else if (act === 'promo-refresh') refreshPromos();
    else if (act === 'lcc') { ui.lcc = b.dataset.v; renderPromo(); }
    else if (act === 'tab') { ui.tab = b.dataset.v; try { localStorage.setItem('flightdeal-tab', ui.tab); } catch { /* 저장 불가 */ } render(); window.scrollTo(0, 0); }
  });

  render();
  loadAll().then(render);
})();
