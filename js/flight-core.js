/* 항공권 최저가: 브라우저(index.html)와 매일 점검 스크립트(scripts/flight-check.js)가 함께 쓰는 데이터·계산
   - 여기 숫자(수하물 요금, 기후, 공휴일)는 "참고값"이에요. 바뀌면 이 파일만 고치면 돼요. */
(function (root) {
  'use strict';

  // ───── 출발지 ─────
  const ORIGINS = [
    { code: 'SEL', name: '서울(인천·김포)', link: 'ICN' },
    { code: 'PUS', name: '부산(김해)', link: 'PUS' },
    { code: 'CJU', name: '제주', link: 'CJU' },
    { code: 'TAE', name: '대구', link: 'TAE' },
    { code: 'CJJ', name: '청주', link: 'CJJ' },
  ];

  // ───── 기후 코드 ─────
  // D 건기 · W 우기 · M 전환기(소나기) · R 장마 · T 태풍 주의 · C 비 적은 편(사계절) · S 겨울·눈
  const CLIMATE = {
    D: { label: '건기', tone: 'good' },
    W: { label: '우기', tone: 'bad' },
    M: { label: '전환기·소나기', tone: 'mid' },
    R: { label: '장마', tone: 'bad' },
    T: { label: '태풍 주의', tone: 'bad' },
    C: { label: '비 적은 편', tone: 'good' },
    S: { label: '겨울·눈', tone: 'mid' },
  };

  // ───── 목적지 ─────
  // code: 가격 검색용(도시 코드), link: 구글·네이버·스카이스캐너 링크용 공항, region: 수하물 요금 구역
  // clim: 1~12월 기후 코드, notes: 달별 메모 (1월 = 1)
  const DESTS = [
    { country: '베트남', city: '나트랑', alias: ['냐짱', '깜라인', '나짱'], code: 'CXR', link: 'CXR', lat: 12.24, lon: 109.19, region: 'sea',
      clim: 'DDDDDDDDMWWM', notes: { 1: '건기 시작, 바다 아직 거칠 수 있음', 5: '덥고 맑음', 9: '우기 시작', 10: '폭우·태풍 가능', 11: '폭우·태풍 가능(가장 비 많음)' } },
    { country: '베트남', city: '다낭', alias: ['호이안'], code: 'DAD', link: 'DAD', lat: 16.05, lon: 108.2, region: 'sea',
      clim: 'MDDDDDDDWWWM', notes: { 1: '선선, 비 가끔', 6: '무더움', 10: '홍수·태풍 주의', 11: '홍수·태풍 주의' } },
    { country: '베트남', city: '푸꾸옥', alias: ['푸쿠옥'], code: 'PQC', link: 'PQC', lat: 10.23, lon: 103.96, region: 'sea',
      clim: 'DDDDMWWWWWMD', notes: { 8: '비·파도 많음', 9: '비 가장 많음' } },
    { country: '베트남', city: '호치민', alias: ['사이공'], code: 'SGN', link: 'SGN', lat: 10.82, lon: 106.63, region: 'sea',
      clim: 'DDDDMWWWWWMD', notes: { 4: '가장 더움', 9: '오후 스콜 잦음' } },
    { country: '베트남', city: '하노이', alias: ['하롱베이'], code: 'HAN', link: 'HAN', lat: 21.03, lon: 105.85, region: 'sea',
      clim: 'DDDMWWWWWMDD', notes: { 1: '춥고 흐림(15℃ 안팎)', 2: '이슬비·쌀쌀', 6: '무더움', 8: '비 가장 많음' } },
    { country: '베트남', city: '달랏', alias: [], code: 'DLI', link: 'DLI', lat: 11.94, lon: 108.46, region: 'sea',
      clim: 'DDDMWWWWWWMD', notes: { 1: '아침저녁 쌀쌀(고원)' } },
    { country: '태국', city: '방콕', alias: ['파타야'], code: 'BKK', link: 'BKK', lat: 13.75, lon: 100.5, region: 'sea',
      clim: 'DDDDMWWWWWMD', notes: { 4: '가장 더움(송끄란)', 9: '비 가장 많음', 10: '비 많음' } },
    { country: '태국', city: '푸켓', alias: ['피피섬', '크라비'], code: 'HKT', link: 'HKT', lat: 7.88, lon: 98.39, region: 'sea',
      clim: 'DDDMWWWWWWMD', notes: { 9: '파도 높음', 10: '비 많음' } },
    { country: '태국', city: '치앙마이', alias: [], code: 'CNX', link: 'CNX', lat: 18.79, lon: 98.98, region: 'sea',
      clim: 'DDDDMWWWWWMD', notes: { 2: '연무(미세먼지) 시작', 3: '연무(미세먼지) 심함', 4: '연무·가장 더움' } },
    { country: '필리핀', city: '세부', alias: ['막탄'], code: 'CEB', link: 'CEB', lat: 10.31, lon: 123.89, region: 'sea',
      clim: 'DDDDDMWWWWWM', notes: { 10: '태풍 가능', 11: '태풍 가능', 12: '태풍 가능' } },
    { country: '필리핀', city: '보홀', alias: ['팡라오'], code: 'TAG', link: 'TAG', lat: 9.57, lon: 123.77, region: 'sea',
      clim: 'DDDDDMWWWWWM', notes: { 10: '태풍 가능', 11: '태풍 가능' } },
    { country: '필리핀', city: '보라카이', alias: ['칼리보'], code: 'KLO', link: 'KLO', lat: 11.97, lon: 121.93, region: 'sea',
      clim: 'DDDDDWWWWWMD', notes: { 7: '서쪽 해변 파도 높음', 8: '태풍 가능', 9: '태풍 가능' } },
    { country: '필리핀', city: '마닐라', alias: [], code: 'MNL', link: 'MNL', lat: 14.6, lon: 120.98, region: 'sea',
      clim: 'DDDDDWWWWWMD', notes: { 7: '태풍', 8: '태풍', 9: '태풍' } },
    { country: '인도네시아', city: '발리', alias: ['덴파사르', '우붓'], code: 'DPS', link: 'DPS', lat: -8.65, lon: 115.22, region: 'sea',
      clim: 'WWWMDDDDDMWW', notes: { 1: '비 가장 많음', 7: '성수기(유럽·호주 휴가)', 8: '성수기(유럽·호주 휴가)' } },
    { country: '말레이시아', city: '코타키나발루', alias: ['코키날'], code: 'BKI', link: 'BKI', lat: 5.98, lon: 116.07, region: 'sea',
      clim: 'MDDDMWWWWWWW', notes: { 10: '비 가장 많음' } },
    { country: '말레이시아', city: '쿠알라룸푸르', alias: [], code: 'KUL', link: 'KUL', lat: 3.14, lon: 101.69, region: 'sea',
      clim: 'MMWWMMMMMWWM', notes: { 4: '오후 스콜 잦음', 11: '비 가장 많음' } },
    { country: '싱가포르', city: '싱가포르', alias: [], code: 'SIN', link: 'SIN', lat: 1.35, lon: 103.82, region: 'sea',
      clim: 'WMMMMMMMMMWW', notes: { 1: '몬순(비 잦음)', 12: '몬순(비 잦음)', 6: '연중 소나기' } },
    { country: '일본', city: '도쿄', alias: ['나리타', '하네다'], code: 'TYO', link: 'NRT', lat: 35.68, lon: 139.69, region: 'jp',
      clim: 'CCCCCRRTTCCC', notes: { 1: '겨울(맑고 건조)', 3: '벚꽃(하순)', 7: '장마 7월 중순까지', 8: '무더움·태풍 가능', 9: '태풍 가능', 11: '단풍' } },
    { country: '일본', city: '오사카', alias: ['교토', '고베', '간사이'], code: 'OSA', link: 'KIX', lat: 34.69, lon: 135.5, region: 'jp',
      clim: 'CCCCCRRTTCCC', notes: { 3: '벚꽃(하순)', 4: '벚꽃(초순)', 7: '장마 7월 중순까지', 8: '무더움·태풍 가능', 11: '단풍' } },
    { country: '일본', city: '후쿠오카', alias: ['큐슈', '유후인'], code: 'FUK', link: 'FUK', lat: 33.59, lon: 130.4, region: 'jp',
      clim: 'CCCCCRRTTCCC', notes: { 7: '장마 7월 중순까지', 8: '태풍 가능', 9: '태풍 가능' } },
    { country: '일본', city: '나고야', alias: [], code: 'NGO', link: 'NGO', lat: 35.18, lon: 136.91, region: 'jp',
      clim: 'CCCCCRRTTCCC', notes: { 7: '장마 7월 중순까지', 8: '무더움·태풍 가능' } },
    { country: '일본', city: '오키나와', alias: ['나하'], code: 'OKA', link: 'OKA', lat: 26.21, lon: 127.68, region: 'jp',
      clim: 'CCCCRRTTTCCC', notes: { 5: '장마 시작(중순)', 6: '장마 6월 하순까지', 7: '맑지만 태풍 가능', 8: '태풍', 9: '태풍', 10: '태풍 가능' } },
    { country: '일본', city: '삿포로', alias: ['홋카이도', '오타루'], code: 'SPK', link: 'CTS', lat: 43.06, lon: 141.35, region: 'jp',
      clim: 'SSSCCCCCCCCS', notes: { 2: '눈축제(초순)', 7: '라벤더·장마 없음', 12: '눈' } },
    { country: '대만', city: '타이베이', alias: ['타이페이', '대만'], code: 'TPE', link: 'TPE', lat: 25.03, lon: 121.56, region: 'tw',
      clim: 'CMMMRRTTTCCC', notes: { 1: '흐리고 쌀쌀', 2: '이슬비 잦음', 5: '매우(梅雨) 장마', 6: '매우 장마', 8: '태풍', 9: '태풍' } },
    { country: '홍콩', city: '홍콩', alias: [], code: 'HKG', link: 'HKG', lat: 22.32, lon: 114.17, region: 'tw',
      clim: 'DDCCWWTTTCDD', notes: { 3: '습하고 안개', 6: '비 많음', 7: '태풍', 8: '태풍', 9: '태풍', 11: '가장 쾌적' } },
    { country: '마카오', city: '마카오', alias: [], code: 'MFM', link: 'MFM', lat: 22.2, lon: 113.54, region: 'tw',
      clim: 'DDCCWWTTTCDD', notes: { 7: '태풍', 8: '태풍', 9: '태풍' } },
    { country: '중국', city: '상하이', alias: [], code: 'SHA', link: 'PVG', lat: 31.23, lon: 121.47, region: 'cn',
      clim: 'CCCCCRRTTCCC', notes: { 6: '매우 장마(중순부터)', 7: '장마 초순까지·무더움', 8: '태풍 가능' } },
    { country: '미국령', city: '괌', alias: [], code: 'GUM', link: 'GUM', lat: 13.44, lon: 144.79, region: 'pac',
      clim: 'DDDDDMWWWWWM', notes: { 8: '태풍 가능', 9: '태풍 가능', 10: '태풍 가능', 11: '태풍 가능' } },
    { country: '미국령', city: '사이판', alias: [], code: 'SPN', link: 'SPN', lat: 15.18, lon: 145.75, region: 'pac',
      clim: 'DDDDDMWWWWWM', notes: { 8: '태풍 가능', 9: '태풍 가능', 10: '태풍 가능' } },
    { country: '미국', city: '하와이(호놀룰루)', alias: ['하와이', '호놀룰루', '오아후'], code: 'HNL', link: 'HNL', lat: 21.31, lon: -157.86, region: 'far',
      clim: 'MMMDDDDDDDMM', notes: { 1: '겨울(비 가끔·북쪽 파도)', 12: '겨울(비 가끔·북쪽 파도)' } },
  ];

  // ───── 항공사 ─────
  // bag: inc = 기본 운임에 위탁수하물 포함 / maybe = 운임 종류에 따라 다름 / exc = 최저 운임엔 보통 미포함
  const AIRLINES = {
    KE: { name: '대한항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.koreanair.com' },
    OZ: { name: '아시아나항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://flyasiana.com' },
    '7C': { name: '제주항공', type: 'LCC', bag: 'exc', url: 'https://www.jejuair.net' },
    LJ: { name: '진에어', type: 'LCC', bag: 'maybe', kg: 15, url: 'https://www.jinair.com', bagNote: '일반 운임은 15kg 포함, 특가 운임은 미포함일 수 있어요' },
    TW: { name: '티웨이항공', type: 'LCC', bag: 'exc', url: 'https://www.twayair.com' },
    BX: { name: '에어부산', type: 'LCC', bag: 'exc', url: 'https://www.airbusan.com' },
    RS: { name: '에어서울', type: 'LCC', bag: 'exc', url: 'https://flyairseoul.com' },
    ZE: { name: '이스타항공', type: 'LCC', bag: 'exc', url: 'https://www.eastarjet.com' },
    RF: { name: '에어로케이', type: 'LCC', bag: 'exc', url: 'https://www.aerok.com' },
    YP: { name: '에어프레미아', type: 'HSC', bag: 'maybe', kg: 23, url: 'https://www.airpremia.com', bagNote: '이코노미 운임 종류에 따라 달라요' },
    VJ: { name: '비엣젯', type: 'LCC', bag: 'exc', url: 'https://www.vietjetair.com' },
    VN: { name: '베트남항공', type: 'FSC', bag: 'maybe', kg: 23, url: 'https://www.vietnamairlines.com', bagNote: '가장 싼 이코노미 운임은 위탁수하물이 없을 수 있어요' },
    QH: { name: '뱀부항공', type: 'FSC', bag: 'maybe', kg: 20, url: 'https://www.bambooairways.com' },
    VU: { name: '비엣트래블', type: 'LCC', bag: 'exc', url: 'https://www.vietravelairlines.com' },
    '5J': { name: '세부퍼시픽', type: 'LCC', bag: 'exc', url: 'https://www.cebupacificair.com' },
    PR: { name: '필리핀항공', type: 'FSC', bag: 'maybe', kg: 23, url: 'https://www.philippineairlines.com' },
    Z2: { name: '에어아시아 필리핀', type: 'LCC', bag: 'exc', url: 'https://www.airasia.com' },
    AK: { name: '에어아시아', type: 'LCC', bag: 'exc', url: 'https://www.airasia.com' },
    D7: { name: '에어아시아X', type: 'LCC', bag: 'exc', url: 'https://www.airasia.com' },
    XJ: { name: '타이 에어아시아X', type: 'LCC', bag: 'exc', url: 'https://www.airasia.com' },
    FD: { name: '타이 에어아시아', type: 'LCC', bag: 'exc', url: 'https://www.airasia.com' },
    TG: { name: '타이항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.thaiairways.com' },
    TR: { name: '스쿠트', type: 'LCC', bag: 'exc', url: 'https://www.flyscoot.com' },
    SQ: { name: '싱가포르항공', type: 'FSC', bag: 'inc', kg: 25, url: 'https://www.singaporeair.com' },
    MH: { name: '말레이시아항공', type: 'FSC', bag: 'maybe', kg: 25, url: 'https://www.malaysiaairlines.com' },
    GA: { name: '가루다항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.garuda-indonesia.com' },
    CX: { name: '캐세이퍼시픽', type: 'FSC', bag: 'maybe', kg: 23, url: 'https://www.cathaypacific.com', bagNote: '가장 싼 이코노미 운임은 위탁수하물이 없을 수 있어요' },
    UO: { name: '홍콩익스프레스', type: 'LCC', bag: 'exc', url: 'https://www.hkexpress.com' },
    CI: { name: '중화항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.china-airlines.com' },
    BR: { name: '에바항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.evaair.com' },
    IT: { name: '타이거에어 타이완', type: 'LCC', bag: 'exc', url: 'https://www.tigerairtw.com' },
    JL: { name: '일본항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.jal.co.jp' },
    NH: { name: 'ANA', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.ana.co.jp' },
    MM: { name: '피치항공', type: 'LCC', bag: 'exc', url: 'https://www.flypeach.com' },
    GK: { name: '젯스타 재팬', type: 'LCC', bag: 'exc', url: 'https://www.jetstar.com' },
    UA: { name: '유나이티드항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.united.com' },
    HA: { name: '하와이안항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.hawaiianairlines.com' },
    MU: { name: '중국동방항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.ceair.com' },
    CA: { name: '중국국제항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.airchina.com' },
    CZ: { name: '중국남방항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.csair.com' },
  };

  // 수하물 15kg 사전구매 추정 요금 (1인 · 편도 · 원). 2026년 국내 LCC 공지(동남아 6~7만 원대)를 바탕으로 한 대략값.
  // 화면의 설정에서 바꿀 수 있어요.
  const BAG_FEE_DEFAULT = { jp: 50000, cn: 50000, tw: 55000, sea: 65000, pac: 70000, far: 90000 };
  const REGION_NAME = { jp: '일본', cn: '중국', tw: '대만·홍콩', sea: '동남아', pac: '괌·사이판', far: '장거리' };

  // ───── 한국 공휴일 (2026.11 ~ 2027.12, 대체공휴일 포함 · 참고용) ─────
  const HOLIDAYS = [
    { from: '2026-12-25', to: '2026-12-27', name: '성탄절 연휴' },
    { from: '2027-01-01', to: '2027-01-03', name: '신정 연휴' },
    { from: '2027-02-05', to: '2027-02-08', name: '설 연휴' },
    { from: '2027-02-27', to: '2027-03-01', name: '삼일절 연휴' },
    { from: '2027-05-05', to: '2027-05-05', name: '어린이날' },
    { from: '2027-05-13', to: '2027-05-13', name: '부처님오신날' },
    { from: '2027-06-05', to: '2027-06-06', name: '현충일(일)' },
    { from: '2027-08-14', to: '2027-08-16', name: '광복절 연휴' },
    { from: '2027-09-14', to: '2027-09-16', name: '추석 연휴' },
    { from: '2027-10-02', to: '2027-10-04', name: '개천절 연휴' },
    { from: '2027-10-09', to: '2027-10-11', name: '한글날 연휴' },
    { from: '2027-12-25', to: '2027-12-27', name: '성탄절 연휴' },
  ];
  // 방학·휴가철 (가격이 오르는 때)
  const PEAK = { 1: '겨울방학', 2: '겨울방학', 7: '여름휴가(하순부터)', 8: '여름휴가(중순까지)', 12: '연말' };

  // ───── 카드·판매처 ─────
  const CARDS = [
    { id: 'woori', name: '우리카드', short: '우리', url: 'https://pc.wooricard.com' },
    { id: 'hyundai', name: '현대카드', short: '현대', url: 'https://www.hyundaicard.com' },
    { id: 'shinhan', name: '신한카드', short: '신한', url: 'https://www.shinhancard.com' },
  ];
  const AGENCIES = [
    { name: '하나투어', url: 'https://www.hanatour.com' },
    { name: '모두투어', url: 'https://www.modetour.com' },
    { name: '노랑풍선', url: 'https://www.ybtour.co.kr' },
    { name: '인터파크 투어', url: 'https://travel.interpark.com' },
    { name: '트립닷컴', url: 'https://kr.trip.com' },
    { name: '마이리얼트립', url: 'https://www.myrealtrip.com' },
  ];

  // ───── 날짜 도구 ─────
  const pad = n => String(n).padStart(2, '0');
  function monthsBetween(from, to) {
    const out = [];
    let [y, m] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    let guard = 0;
    while ((y < ty || (y === ty && m <= tm)) && guard++ < 36) {
      out.push(`${y}-${pad(m)}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  function dayNum(s) { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; }
  function nightsBetween(a, b) { return Math.round(dayNum(b) - dayNum(a)); }
  function addDays(s, n) { const t = new Date((dayNum(s) + n) * 864e5); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
  function addMonths(ym, n) { let [y, m] = ym.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; }
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  function weekday(s) { return WD[new Date(dayNum(s) * 864e5).getUTCDay()]; }

  function findDest(code) { return DESTS.find(d => d.code === code) || null; }
  function airline(code) { return AIRLINES[code] || { name: code || '항공사 미상', type: '?', bag: 'maybe', url: '' }; }

  // ───── 가격 데이터 정리 ─────
  // Travelpayouts(Aviasales) v3 prices_for_dates 응답 → 공통 모양
  function normalizeOffers(raw, src) {
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : []);
    return list.map(o => {
      const dep = o.departure_at || o.depart_date || '';
      const ret = o.return_at || o.return_date || '';
      const price = Number(o.price != null ? o.price : o.value);
      if (!dep || !ret || !(price > 0)) return null;
      return {
        price: Math.round(price),
        dep: dep.slice(0, 16), ret: ret.slice(0, 16),
        nights: nightsBetween(dep, ret),
        airline: o.airline || '',
        flight: o.flight_number ? `${o.airline || ''}${o.flight_number}` : '',
        transfers: Number(o.transfers != null ? o.transfers : o.number_of_changes) || 0,
        backTransfers: Number(o.return_transfers != null ? o.return_transfers : o.transfers) || 0,
        link: o.link ? `https://www.aviasales.com${o.link}` : '',
        gate: o.gate || '',
        src: src || 'tp',
      };
    }).filter(Boolean);
  }
  function median(nums) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b), h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : Math.round((s[h - 1] + s[h]) / 2);
  }
  // 한 달치 후보에서: 조건에 맞는 것만 → 최저가, 보통 가격(중앙값), 상위 5개
  function summarizeMonth(offers, opt) {
    const minN = opt.minNights || 1, maxN = opt.maxNights || 30;
    const ym = opt.month;
    const ok = offers.filter(o => o.nights >= minN && o.nights <= maxN && (!ym || o.dep.slice(0, 7) === ym) && (!opt.direct || (o.transfers === 0 && o.backTransfers === 0)));
    ok.sort((a, b) => a.price - b.price);
    // 같은 날짜·항공사 중복 정리
    const seen = new Set(), uniq = [];
    for (const o of ok) { const k = `${o.dep.slice(0, 10)}|${o.ret.slice(0, 10)}|${o.airline}`; if (seen.has(k)) continue; seen.add(k); uniq.push(o); }
    return {
      count: uniq.length,
      best: uniq[0] || null,
      median: median(uniq.map(o => o.price)),
      top: uniq.slice(0, 5),
    };
  }

  // ───── 수하물 ─────
  // 왕복 1인 기준으로 "포함/미포함, 더하면 얼마" 계산
  function baggage(airlineCode, region, fees) {
    const a = airline(airlineCode);
    const fee = ((fees && fees[region]) || BAG_FEE_DEFAULT[region] || 65000) * 2; // 왕복
    if (a.bag === 'inc') return { status: 'inc', label: `수하물 포함(${a.kg || 20}kg)`, add: 0, note: '' };
    if (a.bag === 'maybe') return { status: 'maybe', label: '수하물 확인 필요', add: fee, note: a.bagNote || '운임 종류에 따라 달라요' };
    return { status: 'exc', label: '수하물 미포함', add: fee, note: `15kg 사전구매 왕복 약 ${won(fee)} (추정)` };
  }

  // ───── 링크 (바로 그 날짜로) ─────
  function links(originCode, dest, dep, ret, adults) {
    const o = (ORIGINS.find(x => x.code === originCode) || { link: originCode }).link;
    const d = dest.link || dest.code;
    const n = Math.max(1, adults || 1);
    const ymd = s => s.slice(0, 10).replace(/-/g, '');
    const yymmdd = s => s.slice(2, 10).replace(/-/g, '');
    const q = `Flights from ${o} to ${d} on ${dep.slice(0, 10)} through ${ret.slice(0, 10)}${n > 1 ? ` for ${n} adults` : ''}`;
    return {
      google: `https://www.google.com/travel/flights?hl=ko&gl=KR&curr=KRW&q=${encodeURIComponent(q)}`,
      naver: `https://flight.naver.com/flights/international/${o}-${d}-${ymd(dep)}/${d}-${o}-${ymd(ret)}?adult=${n}&fareType=Y`,
      sky: `https://www.skyscanner.co.kr/transport/flights/${o.toLowerCase()}/${d.toLowerCase()}/${yymmdd(dep)}/${yymmdd(ret)}/?adultsv2=${n}&cabinclass=economy&rtn=1`,
    };
  }

  // ───── 기후·시기 ─────
  function climateOf(dest, month /* 1~12 */) {
    if (!dest || !dest.clim) return null;
    const code = dest.clim[month - 1];
    const c = CLIMATE[code] || null;
    return c ? { code, label: c.label, tone: c.tone, note: (dest.notes && dest.notes[month]) || '' } : null;
  }
  function holidaysIn(ym) { return HOLIDAYS.filter(h => h.from.slice(0, 7) === ym || h.to.slice(0, 7) === ym); }
  // 문서 기준: 단거리 국제선 2~4개월 전, 장거리 3~6개월 전
  function buyWindow(ym, region) {
    const far = region === 'far';
    return { from: addMonths(ym, far ? -6 : -4), to: addMonths(ym, far ? -3 : -2) };
  }

  // ───── 뉴스(프로모션·카드) 해석 ─────
  const PROMO_WORDS = ['특가', '프로모션', '할인', '세일', '얼리버드', '타임세일', '찜특가', '진마켓', '땡처리', '이벤트', '최저가', '반값', '쿠폰'];
  const CARD_NAMES = ['우리카드', '현대카드', '신한카드'];
  function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
  // "7만9000원", "7만 9천원", "79,000원", "9만원" → 숫자들
  function parseWon(text) {
    const s = String(text || '');
    const out = [];
    const re1 = /(\d{1,3})\s*만\s*(?:(\d{1,4})\s*(천)?)?\s*원/g;
    let m;
    while ((m = re1.exec(s))) out.push(Number(m[1]) * 10000 + (m[2] ? (m[3] ? Number(m[2]) * 1000 : Number(m[2])) : 0));
    const re2 = /(\d{1,3}(?:,\d{3})+|\d{4,7})\s*원/g;
    while ((m = re2.exec(s))) out.push(Number(m[1].replace(/,/g, '')));
    return out.filter(v => v >= 10000 && v <= 5000000);
  }
  function promoPrice(text) {
    const vals = parseWon(text);
    if (!vals.length) return null;
    const one = /편도/.test(text), rt = /왕복/.test(text);
    return { amount: Math.min(...vals), trip: one && !rt ? 'oneway' : rt && !one ? 'round' : 'oneway?' };
  }
  function destKeywords(dest) {
    const regionWords = dest.region === 'sea' ? ['동남아'] : dest.region === 'jp' ? ['일본'] : dest.region === 'pac' ? ['괌', '사이판', '대양주'] : [];
    return { strong: [dest.city.replace(/\(.*\)/, ''), ...(dest.alias || [])].filter(Boolean), medium: [dest.country, ...regionWords] };
  }
  function airlineInText(text) {
    const hit = [];
    for (const [code, a] of Object.entries(AIRLINES)) if (text.includes(a.name)) hit.push(code);
    return hit;
  }
  // 뉴스 한 건 → { kind: 'airline'|'card'|null, routes: [{key, level}], airlines, price }
  function classifyNews(title, desc, routes) {
    const text = `${stripTags(title)} ${stripTags(desc)}`;
    const isPromo = PROMO_WORDS.some(w => text.includes(w));
    if (!isPromo) return null;
    const cards = CARD_NAMES.filter(c => text.includes(c));
    const air = airlineInText(text);
    const flightish = /항공|항공권|비행|국제선|노선|트립닷컴|여행/.test(text);
    if (!flightish) return null;
    const matched = [];
    for (const r of routes || []) {
      const dest = findDest(r.dest) || r.destObj;
      if (!dest) continue;
      const kw = destKeywords(dest);
      if (kw.strong.some(k => k && text.includes(k))) matched.push({ key: r.key, level: 'strong' });
      else if (kw.medium.some(k => k && text.includes(k))) matched.push({ key: r.key, level: 'medium' });
      else if (air.length && /국제선|전 노선|전노선|해외/.test(text)) matched.push({ key: r.key, level: 'weak' });
    }
    const kind = cards.length ? 'card' : (air.length || /항공권/.test(text)) ? 'airline' : null;
    if (!kind) return null;
    return { kind, cards, airlines: air, routes: matched, price: promoPrice(text) };
  }
  // 프로모션가 vs 보통 가격(왕복 1인) → 할인율(%)
  function promoVsTypical(price, typicalRound) {
    if (!price || !typicalRound) return null;
    const round = price.trip === 'round' ? price.amount : price.amount * 2;
    const pct = Math.round((1 - round / typicalRound) * 100);
    return { round, pct, approx: price.trip !== 'round' };
  }

  // ───── 카드 할인 규칙 적용 ─────
  // rule: { card, merchant: 'any'|항공사코드|'OTA', kind: 'pct'|'won', value, cap, min, until, memo }
  function applyCard(price, airlineCode, rules, today) {
    let best = null;
    for (const r of rules || []) {
      if (r.until && today && r.until < today) continue;
      if (r.merchant && r.merchant !== 'any' && r.merchant !== airlineCode) continue;
      if (r.min && price < r.min) continue;
      let off = r.kind === 'won' ? Number(r.value) || 0 : Math.round(price * (Number(r.value) || 0) / 100);
      if (r.cap) off = Math.min(off, Number(r.cap));
      if (off > 0 && (!best || off > best.off)) best = { off, price: price - off, rule: r };
    }
    return best;
  }

  function won(n) { return n ? `${Math.round(n).toLocaleString('ko-KR')}원` : '-'; }
  function routeKey(w) { return `${w.origin}-${w.dest}-${w.minNights}-${w.maxNights}-${w.direct ? 'D' : 'A'}`; }

  const api = {
    ORIGINS, DESTS, AIRLINES, CLIMATE, BAG_FEE_DEFAULT, REGION_NAME, HOLIDAYS, PEAK, CARDS, AGENCIES, CARD_NAMES,
    monthsBetween, nightsBetween, addDays, addMonths, weekday, findDest, airline,
    normalizeOffers, summarizeMonth, median, baggage, links, climateOf, holidaysIn, buyWindow,
    stripTags, parseWon, promoPrice, classifyNews, promoVsTypical, applyCard, won, routeKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlightCore = api;
})(typeof self !== 'undefined' ? self : this);
