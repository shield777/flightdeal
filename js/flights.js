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
  const data = { recent: null, promos: { items: [] }, watch: { settings: {}, watches: [] }, loaded: false, error: '' };
  const clim = {}; // 목적지별 강수량 통계

  function b64utf8(b64) { const bin = atob(b64.replace(/\n/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
  function utf8b64(str) { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin); }
  async function gh(method, p, body) {
    const g = cfg.gh;
    const res = await fetch(`https://api.github.com/repos/${g.owner}/${g.repo}${p}`, {
      method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${g.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); const e = new Error(ghReason(res.status, t, method, p)); e.status = res.status; throw e; }
    return res.status === 204 ? null : res.json();
  }
  // GitHub 오류를 알아듣기 쉬운 말로 (토큰 권한 문제가 대부분)
  function ghReason(status, text, method, path) {
    const dispatch = /dispatches/.test(path);
    if (status === 401) return '토큰이 틀렸거나 만료됐어요. ⚙ 설정에 토큰을 다시 붙여넣거나 새로 만들어 주세요.';
    if (status === 403) return dispatch ? '토큰에 Actions 쓰기 권한이 없어요. GitHub 토큰 설정에서 Actions를 Read and write로 바꿔 주세요.' : '토큰 권한이 부족해요. Actions·Contents를 Read and write로 해 주세요.';
    if (status === 404) return '토큰이 flightdeal 저장소에 접근하지 못해요. 토큰의 Repository access에서 flightdeal을 골라 주세요.';
    if (status === 422) return `실행 요청 형식 오류예요(앱 문제). 알려 주세요: ${String(text).slice(0, 80)}`;
    return `GitHub 오류 ${status}: ${String(text).slice(0, 80)}`;
  }
  // ⚙ 설정의 [토큰 점검]: 저장소 접근 → 결과 파일 읽기(Contents) → 실행 목록 읽기(Actions) 순서로 확인
  async function checkToken() {
    const out = [];
    const step = async (label, fn) => { try { await fn(); out.push(`✅ ${label}`); return true; } catch (e) { out.push(`❌ ${label}: ${e.message}`); return false; } };
    if (!cfg.gh.token) return ['❌ 토큰이 비어 있어요'];
    if (!(await step('저장소 접근', () => gh('GET', '')))) return out;
    await step('Contents 읽기', () => gh('GET', `/contents/data/promos.json?ref=${encodeURIComponent(cfg.gh.branch)}`));
    await step('Actions 읽기', () => gh('GET', '/actions/workflows'));
    out.push('ℹ️ 쓰기 권한(Actions·Contents Read and write)은 실제로 [지금 확인]을 눌러야 확인돼요');
    return out;
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
    data.recent = rt || null;
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
        ${ui.tab === 'price' ? '<div class="fl-season" id="info"></div><div class="fl-refresh" id="refresh"></div>' : ''}
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
    if (ui.tab === 'promo') renderPromo(); else if (ui.tab === 'card') renderCards(); else { renderInfo(); renderRefresh(); }
  }

  // ───── 바로 검색: 고른 목적지·날짜·인원을 네이버·구글·스카이스캐너 검색에 그대로 넣음 ─────
  function quickDates() {
    const q = cfg.q;
    const first = q.from >= thisYM ? `${q.from}-10` : F.addDays(today, 14);
    let dep = q.dep && q.dep >= today ? q.dep : (first < today ? F.addDays(today, 14) : first);
    let ret = q.ret && q.ret > dep ? q.ret : F.addDays(dep, q.minN || 3);
    return { dep, ret };
  }
  // ───── 바로 검색 버튼: 세 묶음(가격 비교 · 땡처리 · 항공사)을 같은 모양으로 ─────
  const goBtn = (href, label) => `<a class="go-btn" href="${href}" target="_blank" rel="noopener">${esc(label)}</a>`;
  const goGroup = (no, title, sub, inner) => `<section class="go-group"><h3><span class="go-no">${no}</span>${title} <small>${sub}</small></h3>${inner}</section>`;
  function quickButtons() {
    const q = cfg.q, dest = currentDest();
    if (!/^[A-Z]{3}$/.test(dest.code || '')) return '<p class="muted">공항·도시 코드(영문 3글자)를 넣어 주세요.</p>';
    const { dep, ret } = quickDates();
    const L = F.links('SEL', dest, dep, ret, q.adults, { direct: true });
    const T = F.ttang(dest, q.adults), city = dest.city.replace(/\(.*\)/, '');
    return `
      ${goGroup(1, '가격 비교', '고른 날짜·인원·직항 그대로', `<div class="go-grid">${goBtn(L.naver, '네이버')}${goBtn(L.google, '구글')}${goBtn(L.sky, '스카이스캐너')}</div>
        <a class="go-more" href="${F.skyMonth('SEL', dest, dep.slice(0, 7), ret.slice(0, 7), q.adults, true)}" target="_blank" rel="noopener">날짜 미정이면 · 스카이스캐너 ${Number(dep.slice(5, 7))}월 전체 날짜별 가격${ICON.ext}</a>`)}
      ${goGroup(2, '땡처리', '땡처리닷컴 · 인천 출발 · 날짜와 상관없이 전체', `<div class="go-grid">${goBtn(T.city, `${city} 땡처리`)}${goBtn(T.today, '오늘 오픈 땡처리')}</div>`)}
      ${goGroup(3, '항공사', `서울 → ${esc(city)} 직항 · 앱이 있으면 앱으로`, airlineBox(dest))}
      <p class="hint">직항 조건은 네이버·스카이스캐너는 주소로, 구글은 검색어로 넣어요. 항공사 홈페이지는 날짜를 다시 골라야 해요. 앱이 안 열리면 버튼을 길게 눌러 '앱에서 열기'를 확인하세요.</p>`;
  }

  // 항공사: 최근 가격 기록으로 확인된 '서울 출발 직항' 항공사 (data/airlines-by-city.json) + 그 외 국적 항공사(미확인, 접어 둠)
  function airlineBtn(code, name) {
    const known = F.AIRLINES[code], a = F.airline(code), label = known ? a.name : (name || code);
    const href = a.url || `https://www.google.com/search?q=${encodeURIComponent(`${label} 항공 홈페이지`)}`; // 홈페이지 주소를 모르는 항공사는 검색으로
    return goBtn(href, label);
  }
  function airlineBox(dest) {
    const R = data.recent, list = R && R.cities ? R.cities[dest.code] : null;
    const others = codes => `<details class="go-others"><summary>그 외 국적 항공사 ${codes.length}곳 · 이 노선 운항 여부 미확인</summary><div class="go-grid">${codes.map(c => airlineBtn(c)).join('')}</div></details>`;
    if (!list) return `<p class="hint">${R ? '이 도시는 직항 항공사 자료가 없어요.' : '항공사 목록이 아직 없어요. ⚙ 설정 → [항공사 목록 새로 만들기]'}</p>${others(F.KOREAN_AIRLINES)}`;
    const ok = list.map(x => x.code), rest = F.KOREAN_AIRLINES.filter(c => !ok.includes(c));
    return `${list.length ? `<div class="go-grid">${list.map(x => airlineBtn(x.code, x.name)).join('')}</div>` : '<p class="muted">최근 기록에서 확인된 직항 항공사가 없어요.</p>'}
      <p class="go-note">최근 6개월 직항 가격 기록 기준 (${esc(fmtUpdated(R.updated))}) · 기록이 없는 항공사는 빠질 수 있어요</p>
      ${rest.length ? others(rest) : ''}`;
  }

  // 고른 날짜의 여행 시기 정보 한 줄 (확인된 자료만: 목적지 기후표, Open-Meteo 관측 비 오는 날, 겹치는 공휴일·방학)
  const CLIM_ICON = { good: '☀️', mid: '🌦', bad: '🌧' };
  function renderInfo() {
    const box = $('#info'); if (!box) return;
    const dest = currentDest();
    if (!/^[A-Z]{3}$/.test(dest.code || '')) { box.innerHTML = ''; return; }
    const { dep, ret } = quickDates();
    const C = clim[dest.code];
    const parts = [esc(`${dest.city.replace(/\(.*\)/, '')} ${mmdd(dep)}~${mmdd(ret)}`)];
    const plain = [parts[0]];
    for (const ym of [...new Set([dep.slice(0, 7), ret.slice(0, 7)])]) {
      const m = Number(ym.slice(5)), cl = F.climateOf(dest, m), c = C?.months?.[m - 1];
      const rain = c ? ` 비 ${c.wet}일` : '';
      parts.push(cl ? `${m}월 <span class="clim-chip tone-${cl.tone}">${CLIM_ICON[cl.tone] || ''} ${esc(cl.label)}</span>${rain}` : `${m}월${rain}`);
      plain.push(`${m}월 ${cl ? cl.label : ''}${rain}`);
      for (const h of F.holidaysIn(ym).filter(h => h.to >= dep && h.from <= ret)) { const t = `${h.name} ${mmdd(h.from)}${h.to !== h.from ? `~${mmdd(h.to)}` : ''}`; parts.push(esc(t)); plain.push(t); }
      if (F.PEAK[m]) { parts.push(esc(F.PEAK[m])); plain.push(F.PEAK[m]); }
    }
    box.innerHTML = [...new Set(parts)].join(' · ');
    box.title = `${[...new Set(plain)].join(' · ')}${C?.months ? ' (비 오는 날: Open-Meteo 최근 10년 평균)' : ''}`;
    if (!dest.clim && dest.lat == null && cfg.q.custom?.en) geocodeCustom();
    else if (dest.lat != null) loadClimate(dest);
  }

  // ───── [지금 확인] 한 번으로 프로모션·카드 모두 (항공권 검색 탭) ─────
  function renderRefresh() {
    const box = $('#refresh'); if (!box) return;
    const C = currentDest().country;
    const checked = data.promos.checked && data.promos.checked[C];
    const n = data.loaded ? countsFor(C) : null;
    // 토큰이 있는 기기만 [지금 확인] 버튼. 없으면(공유받은 지인 등) 자동 확인 안내만
    const status = checked ? `${esc(C)} 마지막 확인 ${esc(fmtUpdated(checked))}${n ? ` · 프로모션 ${n.promo}건 · ${esc(C)}에 쓸 수 있는 카드 할인 ${n.cardOk}건` : ''}` : `<b>${esc(C)}는 아직 확인 전이에요.</b>`;
    box.innerHTML = cfg.gh.token
      ? `<button type="button" class="btn primary fl-refresh-btn" data-act="promo-refresh" ${ui.promoBusy ? 'disabled' : ''}>${ICON.refresh}${ui.promoBusy ? `${esc(C)} 확인 중… ${ui.promoBusy.sec}초 (보통 1~2분)` : `${esc(C)} 특가·카드 지금 확인`}</button>
        <p class="hint">${status} · 자동 확인 오전 6시~밤 10시 2시간마다</p>`
      : `<p class="fl-auto">🔄 프로모션·카드는 오전 6시~밤 10시 2시간마다 자동으로 새로 확인돼요</p><p class="hint">${status}</p>`;
  }
  // 다른 탭: 마지막 확인 시각 + 항공권 검색 탭으로
  function checkedLine(C) {
    const checked = data.promos.checked && data.promos.checked[C];
    return `<p class="hint">${checked ? `${esc(C)} 마지막 확인 ${esc(fmtUpdated(checked))}` : `<b>${esc(C)}는 아직 확인 전이에요.</b>`} · 자동 확인 오전 6시~밤 10시 2시간마다${cfg.gh.token ? ` · 바로 확인은 <button type="button" class="link-btn" data-act="tab" data-v="price">항공권 검색 탭의 [지금 확인]</button>` : ''}${ui.promoBusy ? ` · 지금 확인 중… ${ui.promoBusy.sec}초` : ''}</p>`;
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
  // 기사·공지 묶음에서 핵심 사실 모으기 (대표 + 같은 소식 기사들)
  function groupFacts(p) {
    const base = (p.found || today).slice(0, 10);
    const all = [p, ...(p.more || [])].map(m => F.promoFacts(`${m.title} ${m.desc || ''}`, (m.date || base).slice(0, 10)));
    const f = {};
    for (const x of all) {
      if (x.price && (!f.price || x.price.amount < f.price.amount)) f.price = x.price;
      if (x.pct && (!f.pct || x.pct > f.pct)) f.pct = x.pct;
      if (x.code && !f.code) f.code = x.code;
      if (x.codeHint) f.codeHint = true;
      if (x.board && !f.board) f.board = x.board;
      if (x.book && !f.book) f.book = x.book;
    }
    if (p.official && p.until && !f.book) f.book = { from: p.from || null, to: p.until };
    return f;
  }
  const hasFacts = f => !!(f.price || f.pct || f.code || f.codeHint || f.board || f.book);
  // 날짜: 올해면 11/30, 다른 해면 2027.10.31
  const dayStr = d => d.slice(0, 4) !== today.slice(0, 4) ? `${d.slice(0, 4)}.${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}` : mmdd(d);
  const periodStr = x => x ? `${x.from ? `${dayStr(x.from)} ~ ` : '~ '}${dayStr(x.to)}${x.from ? '' : '까지'}` : '';
  // 주요내용: 가격·할인율·코드 (글에 적힌 그대로). 없으면 기사 첫 핵심 문장, 그것도 없으면 제목
  function mainLine(p, f) {
    const won0 = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
    const parts = [
      f.price ? `<b>${f.price.trip === 'round' ? '왕복 ' : f.price.trip === 'oneway' ? '편도 ' : ''}${won0(f.price.amount)}~</b>` : '',
      f.pct ? `<b>최대 ${f.pct}% 할인</b>` : '',
      f.code ? `코드 <b>${esc(f.code)}</b>` : f.codeHint ? '<b>할인 코드 제공</b>' : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
    const sum = p.summary || ((p.more || []).find(m => m.summary) || {}).summary || [];
    const t = F.stripTags(sum[0] || p.title);
    return esc(t.length > 70 ? `${t.slice(0, 68)}…` : t);
  }
  function promoItem(p, trip) {
    const f = groupFacts(p);
    const fit = F.fitsTrip(f, trip.dep, trip.ret);
    const src = p.official ? `${esc(F.airline((p.airlines || [])[0]).name)} 홈페이지` : `${esc(p.source || '뉴스')} · ${mmdd((p.date || '').slice(0, 10))}`;
    const none = '<span class="muted">글에 없음</span>';
    return `<li class="pr-item">
      <dl class="pr-facts">
        <dt>주요내용</dt><dd>${mainLine(p, f)}</dd>
        <dt>예약기간</dt><dd>${f.book ? `<b>${periodStr(f.book)}</b>` : none}</dd>
        <dt>탑승기간</dt><dd>${f.board ? `<b>${periodStr(f.board)}</b>` : none}${fit === 'in' ? ' <span class="fit in">내 여행 날짜 탑승 가능</span>' : fit === 'out' ? ' <span class="fit out">내 여행 날짜는 기간 밖</span>' : ''}</dd>
      </dl>
      <a class="pr-title" href="${esc(p.link)}" target="_blank" rel="noopener">${esc(F.stripTags(p.title))}</a>
      ${summaryList(p)}
      <div class="src"><span class="${p.official ? 'badge-off' : 'badge-news'}">${p.official ? '공식' : '뉴스'}</span> ${src}${p.more && p.more.length ? ` · 같은 소식 ${p.more.length + 1}건 묶음` : ''}</div>
    </li>`;
  }
  function promosFor(C) {
    const rec = (data.recent && data.recent.cities) || {};
    const order = [...new Set(F.DESTS.filter(d => d.country === C).flatMap(d => (rec[d.code] || []).map(r => r.code)))];
    const all = (data.promos.items || []).filter(p => p.kind === 'airline' && F.isWantedPromo(p, {}) && isLive(p));
    const rel = all.filter(p => !F.isPayBenefit(p) && ((p.countries || []).includes(C) || (p.allRoutes && !(p.countries || []).length && (p.airlines || []).some(a => order.includes(a)))));
    return { order, rel, useful: rel.filter(p => p.official || hasFacts(groupFacts(p))) };
  }
  function countsFor(C) {
    const c = cardsFor(C);
    return { promo: promosFor(C).useful.length, cardOk: c.useful.filter(x => x.u.use === 'ok' || x.u.use === 'all').length };
  }
  function renderPromo() {
    const box = $('#promo'); if (!box) return;
    if (!data.loaded) { box.innerHTML = '<div class="empty">자료를 불러오는 중…</div>'; return; }
    const dest = currentDest(), C = dest.country, trip = quickDates();
    // 이 나라 관련: 기사에 나라·도시가 나오거나, 이 나라를 운항하는 항공사의 '전 노선·국제선' 특가
    // 불필요한 기사 숨김: 공식이 아니고 가격·할인율·코드·기간 중 하나도 없는 기사
    const { order, rel, useful } = promosFor(C);
    const hidden = rel.length - useful.length;
    const fitRank = p => ({ in: 0, null: 1, out: 2 })[String(F.fitsTrip(groupFacts(p), trip.dep, trip.ret))];
    const sortList = l => l.sort((x, y) => fitRank(x) - fitRank(y) || (y.official ? 1 : 0) - (x.official ? 1 : 0) || (y.lastDate || y.date || '').localeCompare(x.lastDate || x.date || ''));
    const groups = order.map(code => ({ code, list: useful.filter(p => (p.airlines || []).find(a => order.includes(a)) === code) })).filter(g => g.list.length);
    const etc = useful.filter(p => !(p.airlines || []).some(a => order.includes(a)));
    const checked = data.promos.checked && data.promos.checked[C];
    box.innerHTML = `
      <section class="pr-head">
        <h2>${esc(C)} 항공권 프로모션 <small>${esc(C)} 운항 항공사 ${order.length}곳 기준 · 진행 중이거나 최근 3주</small></h2>
        ${checkedLine(C)}
        <p class="hint">나라·날짜는 항공권 검색 탭에서 고른 것 · 내 여행 ${mmdd(trip.dep)}~${mmdd(trip.ret)}</p>
      </section>
      ${groups.map(g => { const a = F.airline(g.code); return `<article class="pr-air">
          <header><b>${esc(a.name)}</b><span class="pr-how">${OFFICIAL_AIR.includes(g.code) ? '공식 홈페이지 + 뉴스' : '뉴스'}</span>${a.url ? `<a href="${a.url}" target="_blank" rel="noopener">홈페이지${ICON.ext}</a>` : ''}</header>
          <ul>${sortList(g.list).map(p => promoItem(p, trip)).join('')}</ul></article>`; }).join('')}
      ${etc.length ? `<article class="pr-air"><header><b>여행사·종합</b><span class="pr-how">항공사 이름 없는 ${esc(C)} 특가 기사</span></header><ul>${sortList(etc).map(p => promoItem(p, trip)).join('')}</ul></article>` : ''}
      ${!groups.length && !etc.length ? `<p class="muted pr-none">${esc(C)} 관련 특가 소식이 없어요.</p>` : ''}
      <p class="fl-foot">굵은 글씨는 기사·공지에 적힌 숫자·날짜를, 점(•) 문장은 기사 첫 문단의 문장을 그대로 옮긴 거예요(계산·추정·재작성 없음). 같은 소식은 하나로 묶었고, 가격·할인율·코드·기간이 하나도 없는 기사${hidden ? ` ${hidden}건` : ''}는 숨겼어요. 조건은 원문에서 꼭 확인하세요.</p>`;
  }

  // ───── 카드 탭: 우리·현대·신한 할인 소식 + 항공사 공식 결제 혜택 ─────
  function cardsFor(C) {
    const rec = (data.recent && data.recent.cities) || {};
    const serving = [...new Set(F.DESTS.filter(d => d.country === C).flatMap(d => (rec[d.code] || []).map(r => r.code)))];
    // 카드사 할인 + 항공사 공식 결제 혜택(간편결제 등)
    const raw = (data.promos.items || []).filter(p => (p.kind === 'card' || F.isPayBenefit(p)) && isLive(p));
    const facts = p => {
      const all = [p, ...(p.more || [])].map(m => F.cardFacts(`${m.title} ${m.desc || ''}`, (m.date || p.found || today).slice(0, 10)));
      const f = Object.assign({}, ...all.reverse());
      if (p.official && p.until) f.period = { from: p.from || null, to: p.until };
      return f;
    };
    const items = raw.map(p => ({ p, f: facts(p), u: F.cardUse(p, C, serving) }))
      .filter(x => !(x.f.period && x.f.period.to < today)); // 결제 기간이 끝난 것
    const useful = items.filter(x => x.p.official || x.f.amount || x.f.pct || x.f.period);
    return { items, useful };
  }
  function renderCards() {
    const box = $('#cards'); if (!box) return;
    if (!data.loaded) { box.innerHTML = '<div class="empty">자료를 불러오는 중…</div>'; return; }
    const dest = currentDest(), C = dest.country;
    const { items, useful } = cardsFor(C);
    const hidden = items.length - useful.length;
    const per = x => x ? `${x.from ? `${mmdd(x.from)}~` : '~'}${mmdd(x.to)}` : '';
    const who = p => p.kind === 'card' ? (p.cards || []).join('·') || '카드' : '간편결제';
    const row = ({ p, f, u }) => {
      const line = [f.amount ? `<b>${esc(f.amount)}</b>` : '', f.pct ? `<b>${f.pct}% 할인</b>` : '', f.min ? esc(f.min) : '', f.period ? `결제 ${per(f.period)}` : ''].filter(Boolean).join(' · ');
      const air = (u.why || []).map(c => F.AIRLINES[c] ? F.airline(c).name : c).join('·');
      const why = u.use === 'ok' ? (air ? `${air} 결제 · ${C} 운항` : `${C} 언급`) : u.use === 'all' ? '해외 항공권·여행 플랫폼 결제' : u.use === 'no' ? `${air} 대상 · ${C} 해당 없음` : u.air ? `${air} 결제 · ${C} 운항 여부 미확인` : '사용처가 기사에 없음';
      const src = p.official ? `${esc(F.airline((p.airlines || [])[0]).name)} 홈페이지` : `${esc(p.source || '뉴스')} · ${mmdd((p.date || '').slice(0, 10))}`;
      return `<li class="pr-item">
        <div class="src"><span class="badge-card">${esc(who(p))}</span> <span class="use use-${u.use}">${esc(why)}</span></div>
        ${line ? `<div class="pr-key">${line}</div>` : ''}
        <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(F.stripTags(p.title))}</a>
        ${summaryList(p)}
        <div class="src"><span class="${p.official ? 'badge-off' : 'badge-news'}">${p.official ? '공식' : '뉴스'}</span> ${src}${p.more && p.more.length ? ` · 같은 소식 ${p.more.length + 1}건 묶음` : ''}</div>
      </li>`;
    };
    const sec = (title, sub, list) => list.length ? `<section class="fl-cards"><h2>${title} <small>${sub}</small></h2><ul class="news">${list.map(row).join('')}</ul></section>` : '';
    const by = k => useful.filter(x => x.u.use === k);
    const no = by('no');
    box.innerHTML = `
      <section class="pr-head">
        <h2>${esc(C)} 여행에 쓸 수 있는 카드 할인</h2>
        ${checkedLine(C)}
        <p class="hint">판단 기준은 기사·공지에 적힌 사용처(항공사·나라·여행 플랫폼)</p>
      </section>
      ${sec('✅ 이 여행에 사용 가능', `${esc(C)} 운항 항공사 결제 또는 ${esc(C)} 언급`, by('ok'))}
      ${sec('🌏 해외 항공권 전체', '국제선·해외 결제·여행 플랫폼', by('all'))}
      ${sec('❓ 확인 필요', '사용처가 안 나오거나, 그 항공사의 운항 여부를 모름', by('unknown'))}
      ${no.length ? `<details class="fl-cards pr-no"><summary>❌ ${esc(C)}에는 해당 없음 ${no.length}건</summary><ul class="news">${no.map(row).join('')}</ul></details>` : ''}
      ${!useful.length ? `<p class="muted pr-none">지금 확인된 카드 할인이 없어요.</p>` : ''}
      <section class="fl-cards"><h2>카드사 이벤트 페이지</h2><div class="go-grid">${F.CARDS.map(c => goBtn(c.url, c.name)).join('')}</div></section>
      <p class="fl-foot">굵은 글씨는 기사·공지에 적힌 금액·할인율·기간을 그대로 뽑은 거예요. 결제 기간이 끝난 것${hidden ? `과 금액·할인율·기간이 하나도 없는 기사 ${hidden}건` : ''}은 숨겼어요. 대상 카드 종류·최소 결제 금액 등 세부 조건은 카드사 이벤트 페이지에서 꼭 확인하세요.</p>`;
  }
  // 기사 본문에서 뽑은 핵심 문장 (서버가 저장한 p.summary, 원문 문장 그대로)
  function summaryList(p) {
    const s = p.summary || ((p.more || []).find(m => m.summary) || {}).summary || [];
    return s.length ? `<ul class="pr-sum">${s.slice(0, 3).map(t => `<li>${esc(F.stripTags(t))}</li>`).join('')}</ul>` : '';
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
    ui.promoBusy = { sec: 0 }; renderRefresh(); renderPromo(); renderCards();
    try {
      const country = currentDest().country;
      const p = await runOnServer({ mode: 'promos', country }, 'data/promos.json', j => (j.updated || '') > before,
        sec => { if (ui.promoBusy) { ui.promoBusy.sec = sec; const b = $('[data-act="promo-refresh"]'); if (b) b.textContent = `${country} 확인 중… ${sec}초 (보통 1~2분)`; } }, 360);
      data.promos = Object.assign({ items: [] }, p);
      const n = countsFor(country);
      toast(`${country}: 프로모션 ${n.promo}건 · 쓸 수 있는 카드 할인 ${n.cardOk}건`);
    } catch (e) { toast(`확인 실패: ${e.message}`, 9000); }
    ui.promoBusy = null; renderRefresh(); renderPromo(); renderCards();
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
      <div class="fl-tokencheck"><button type="button" class="btn sm" data-token-check="1">토큰 점검</button><span class="hint">입력한 토큰으로 저장소·권한을 확인해요 (저장 후 누르세요)</span></div>
      <div id="token-result" class="hint"></div>
      <label class="field"><span>토큰 <span class="hint">이 기기에만 저장돼요. 만드는 법은 SETUP.md</span></span><input type="password" id="s-token" value="${esc(g.token)}" placeholder="github_pat_…" autocomplete="off"></label>
      <details class="fl-adv"><summary>저장소 정보 (보통 그대로 두세요)</summary>
        <div class="grid3">
          <label class="field"><span>계정</span><input type="text" id="s-owner" value="${esc(g.owner)}"></label>
          <label class="field"><span>저장소</span><input type="text" id="s-repo" value="${esc(g.repo)}"></label>
          <label class="field"><span>브랜치</span><input type="text" id="s-branch" value="${esc(g.branch)}"></label>
        </div>
      </details>

      <h3 class="fl-h3">도시별 직항 항공사 목록</h3>
      <p class="hint">마지막으로 만든 날: ${esc(data.recent ? fmtUpdated(data.recent.updated) : '없음')} · 노선이 바뀌었을 때 가끔 눌러 주세요 (2~3분)</p>
      <button type="button" class="btn sm" data-routes-refresh="1">${ICON.refresh}항공사 목록 새로 만들기</button>`,
      `<button type="button" class="btn" data-close="1">닫기</button><button type="submit" class="btn primary">저장</button>`,
      (root, close) => {
        root.addEventListener('click', async e => {
          const tc = e.target.closest('[data-token-check]');
          if (tc) {
            const typed = ($('#s-token', root).value || '').trim();
            if (typed && typed !== cfg.gh.token) { cfg.gh.token = typed; save(); }
            tc.disabled = true; $('#token-result', root).textContent = '확인 중…';
            const r = await checkToken();
            $('#token-result', root).innerHTML = r.map(x => esc(x)).join('<br>'); tc.disabled = false;
            render(); // 토큰이 생기면 [지금 확인] 버튼이 보이게
            return;
          }
          const rb = e.target.closest('[data-routes-refresh]');
          if (rb) {
            if (needToken()) return;
            const before = data.recent?.updated || '';
            rb.disabled = true;
            try {
              const r = await runOnServer({ mode: 'routes' }, 'data/airlines-by-city.json', j => (j.updated || '') > before, sec => { rb.textContent = `만드는 중… ${sec}초 (2~3분)`; }, 420);
              data.recent = r; toast('항공사 목록을 새로 만들었어요'); close(); render();
            } catch (err) { toast(`실패: ${err.message}`); rb.disabled = false; rb.textContent = '항공사 목록 새로 만들기'; }
            return;
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
  function toast(msg, ms = 3000) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms); }

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
    else if (act === 'tab') { ui.tab = b.dataset.v; try { localStorage.setItem('flightdeal-tab', ui.tab); } catch { /* 저장 불가 */ } render(); window.scrollTo(0, 0); }
  });

  render();
  loadAll().then(render);
})();
