/* 항공권 최저가: 브라우저(index.html)와 서버 검색 스크립트(scripts/flight-check.js)가 함께 쓰는 데이터·계산
   - 목적지·기후표·공휴일·항공사 목록이 여기 있어요. 바뀌면 이 파일만 고치면 돼요. */
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
  // code: 도시 코드, link: 구글·네이버·스카이스캐너 링크용 공항, region: 지역 구분
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
    // 미야코지마: 인천 직항(진에어)은 시모지시마 공항(SHI)에 내림. 기후는 오키나와와 같은 아열대(장마 5~6월, 태풍 7~10월)
    { country: '일본', city: '미야코지마', alias: ['미야코', '시모지시마'], code: 'SHI', link: 'SHI', lat: 24.8, lon: 125.28, region: 'jp',
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
  // bag·kg·bagNote: 예전 수하물 추정용 (지금 화면에는 표시하지 않음)
  const AIRLINES = {
    KE: { name: '대한항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.koreanair.com' },
    OZ: { name: '아시아나항공', alias: ['아시아나'], type: 'FSC', bag: 'inc', kg: 23, url: 'https://flyasiana.com' },
    '7C': { name: '제주항공', type: 'LCC', bag: 'exc', url: 'https://www.jejuair.net', app: true }, // app: 앱 연결 등록 확인(2026-11-01)
    LJ: { name: '진에어', type: 'LCC', bag: 'maybe', kg: 15, url: 'https://www.jinair.com', bagNote: '일반 운임은 15kg 포함, 특가 운임은 미포함일 수 있어요' },
    TW: { name: '트리니티항공', alias: ['티웨이항공', '티웨이'], type: 'LCC', bag: 'exc', url: 'https://www.trinityairways.com' }, // 2026년 티웨이항공 → 트리니티항공 사명 변경
    BX: { name: '에어부산', type: 'LCC', bag: 'exc', url: 'https://www.airbusan.com' },
    RS: { name: '에어서울', type: 'LCC', bag: 'exc', url: 'https://flyairseoul.com' },
    ZE: { name: '이스타항공', type: 'LCC', bag: 'exc', url: 'https://www.eastarjet.com' },
    WE: { name: '파라타항공', type: 'LCC', bag: 'exc', url: '' }, // 홈페이지 주소 미확인 → 앱에서 검색 링크
    RF: { name: '에어로케이', type: 'LCC', bag: 'exc', url: 'https://www.aerok.com' },
    YP: { name: '에어프레미아', type: 'HSC', bag: 'maybe', kg: 23, url: 'https://www.airpremia.com', bagNote: '이코노미 운임 종류에 따라 달라요' },
    VJ: { name: '비엣젯', alias: ['비엣젯항공'], type: 'LCC', bag: 'exc', url: 'https://www.vietjetair.com' },
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
    TR: { name: '스쿠트', type: 'LCC', bag: 'exc', url: 'https://www.flyscoot.com', app: true },
    SQ: { name: '싱가포르항공', type: 'FSC', bag: 'inc', kg: 25, url: 'https://www.singaporeair.com' },
    MH: { name: '말레이시아항공', type: 'FSC', bag: 'maybe', kg: 25, url: 'https://www.malaysiaairlines.com' },
    GA: { name: '가루다항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.garuda-indonesia.com' },
    CX: { name: '캐세이퍼시픽', type: 'FSC', bag: 'maybe', kg: 23, url: 'https://www.cathaypacific.com', bagNote: '가장 싼 이코노미 운임은 위탁수하물이 없을 수 있어요' },
    UO: { name: '홍콩익스프레스', type: 'LCC', bag: 'exc', url: 'https://www.hkexpress.com' },
    CI: { name: '중화항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.china-airlines.com' },
    BR: { name: '에바항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.evaair.com' },
    IT: { name: '타이거에어 타이완', type: 'LCC', bag: 'exc', url: 'https://www.tigerairtw.com' },
    JL: { name: '일본항공', alias: ['JAL', '재팬에어라인'], type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.jal.co.jp' },
    NH: { name: 'ANA', alias: ['전일본공수'], type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.ana.co.jp' },
    MM: { name: '피치항공', alias: ['피치 항공', '피치애비에이션'], type: 'LCC', bag: 'exc', url: 'https://www.flypeach.com' },
    GK: { name: '젯스타 재팬', alias: ['젯스타재팬', '젯스타'], type: 'LCC', bag: 'exc', url: 'https://www.jetstar.com' },
    ZG: { name: '집에어', alias: ['ZIPAIR', '집에어 도쿄'], type: 'LCC', bag: 'exc', url: 'https://www.zipair.net' },
    UA: { name: '유나이티드항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.united.com' },
    HA: { name: '하와이안항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.hawaiianairlines.com' },
    MU: { name: '중국동방항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.ceair.com' },
    CA: { name: '중국국제항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.airchina.com' },
    CZ: { name: '중국남방항공', type: 'FSC', bag: 'inc', kg: 23, url: 'https://www.csair.com' },
  };

  // 수하물 15kg 사전구매 추정 요금 (1인 · 편도 · 원). 2026년 국내 LCC 공지(동남아 6~7만 원대)를 바탕으로 한 대략값.
  // 화면의 설정에서 바꿀 수 있어요.
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

  // 다른 사이트 검색 주소. 서울 출발은 도시 코드(서울 전체: 인천+김포)로 넣음
  function links(originCode, dest, dep, ret, adults, opt = {}) {
    const seoul = originCode === 'SEL';
    const o = (ORIGINS.find(x => x.code === originCode) || { link: originCode }).link;
    const d = dest.link || dest.code;
    const n = Math.max(1, adults || 1);
    const ymd = s => s.slice(0, 10).replace(/-/g, '');
    const yymmdd = s => s.slice(2, 10).replace(/-/g, '');
    const nonstop = opt.direct ? 'Nonstop flights' : 'Flights';
    const q = `${nonstop} from ${seoul ? 'Seoul' : o} to ${d} on ${dep.slice(0, 10)} through ${ret.slice(0, 10)}${n > 1 ? ` for ${n} adults` : ''}`;
    const nv = seoul ? 'SEL' : o, sk = seoul ? 'sela' : o.toLowerCase();
    const naverWeb = `https://flight.naver.com/flights/international/${nv}-${d}-${ymd(dep)}/${d}-${nv}-${ymd(ret)}?adult=${n}&fareType=Y${opt.direct ? '&isDirect=true' : ''}`;
    return {
      // 네이버 앱 안의 브라우저로 같은 주소 열기 (네이버 앱 주소 형식). 앱이 없으면 앱 화면에서 사이트(naver)로 넘어감
      naverApp: `naversearchapp://inappbrowser?url=${encodeURIComponent(naverWeb)}&target=new&version=6`,
      google: `https://www.google.com/travel/flights?hl=ko&gl=KR&curr=KRW&q=${encodeURIComponent(q)}`,
      naver: naverWeb,
      sky: `https://www.skyscanner.co.kr/transport/flights/${sk}/${d.toLowerCase()}/${yymmdd(dep)}/${yymmdd(ret)}/?adultsv2=${n}&cabinclass=economy&rtn=1${opt.direct ? '&preferdirects=true' : ''}`,
    };
  }
  // 땡처리닷컴 도시별 땡처리 목록 (사이트에서 도시를 눌렀을 때 만들어지는 주소 형식, 2026-10-31 확인. 인천 출발, 날짜 없이 그 도시 땡처리 전체)
  function ttang(dest, adults) {
    const d = dest.link || dest.code, name = dest.city.replace(/\(.*\)/, '');
    const q = new URLSearchParams({ trip: 'TT', dep0: 'ICN', arr0: d, dep1: '', arr1: '', dep2: '', arr2: '', dep0Name: '인천', arr0Name: name, dep1Name: '', arr1Name: '', dep2Name: '', arr2Name: '',
      depdate0: '', depdate1: '', depdate2: '', adt: String(Math.max(1, adults || 1)), chd: '0', inf: '0', comp: 'Y', viaType: '2', fareType: 'A', gubun: '', popCityGbn: 'Y', depNation0: 'KR', arrNation0: '' });
    return { city: `https://mm.ttang.com/ttangair/search/city/list.do?${q}`, today: 'https://mm.ttang.com/ttangair/search/discount/today.do?trip=RT&gubun=T' };
  }
  // 스카이스캐너 '한 달 전체' 보기 (가는 달·오는 달만 넣으면 그 달 날짜별 가격을 보여 줌)
  function skyMonth(originCode, dest, ymOut, ymBack, adults, direct) {
    const sk = originCode === 'SEL' ? 'sela' : ((ORIGINS.find(x => x.code === originCode) || { link: originCode }).link).toLowerCase();
    const yymm = ym => ym.slice(2, 4) + ym.slice(5, 7);
    return `https://www.skyscanner.co.kr/transport/flights/${sk}/${(dest.link || dest.code).toLowerCase()}/${yymm(ymOut)}/${yymm(ymBack)}/?adultsv2=${Math.max(1, adults || 1)}&cabinclass=economy&rtn=1${direct ? '&preferdirects=true' : ''}`;
  }

  // ───── 기후·시기 ─────
  function climateOf(dest, month /* 1~12 */) {
    if (!dest || !dest.clim) return null;
    const code = dest.clim[month - 1];
    const c = CLIMATE[code] || null;
    return c ? { code, label: c.label, tone: c.tone, note: (dest.notes && dest.notes[month]) || '' } : null;
  }
  function holidaysIn(ym) { return HOLIDAYS.filter(h => h.from.slice(0, 7) === ym || h.to.slice(0, 7) === ym); }


  // ───── 뉴스(프로모션·카드) 해석 ─────
  const PROMO_WORDS = ['특가', '프로모션', '할인', '세일', '얼리버드', '타임세일', '찜특가', '진마켓', '땡처리', '이벤트', '최저가', '반값', '쿠폰'];
  const CARD_NAMES = ['우리카드', '현대카드', '신한카드'];
  function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&(nbsp|amp|quot|apos|lt|gt|lsquo|rsquo|ldquo|rdquo|middot|hellip|ndash|mdash|bull|sim|times|rarr|lsaquo|rsaquo|laquo|raquo);/g, (_, n) => NAMED[n]).replace(/\s+/g, ' ').trim(); }
  const NAMED = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', middot: '·', hellip: '…', ndash: '–', mdash: '—', bull: '•', sim: '~', times: '×', rarr: '→', lsaquo: '‹', rsaquo: '›', laquo: '«', raquo: '»' };
  // "7만9000원", "7만 9천원", "79,000원", "9만원" → 숫자들
  function parseWon(text) {
    const s = String(text || '');
    const out = [];
    const re1 = /(\d{1,3}(?:\.\d{1,2})?)\s*만\s*(?:(\d{1,4})\s*(천)?)?\s*원/g; // 9만9천원, 9.9만원
    let m;
    while ((m = re1.exec(s))) out.push(Math.round(Number(m[1]) * 10000) + (m[2] && !m[1].includes('.') ? (m[3] ? Number(m[2]) * 1000 : Number(m[2])) : 0));
    const re2 = /(\d{1,3}(?:,\d{3})+|\d{4,7})\s*원/g;
    while ((m = re2.exec(s))) out.push(Number(m[1].replace(/,/g, '')));
    const re3 = /₩\s*(\d{1,3}(?:,\d{3})+|\d{4,7})/g; // ₩99,000
    while ((m = re3.exec(s))) out.push(Number(m[1].replace(/,/g, '')));
    return out.filter(v => v >= 10000 && v <= 5000000);
  }
  function promoPrice(text) {
    // "3만원 쿠폰", "최대 2만원 할인", "5천원 적립"처럼 운임이 아닌 금액은 뺌
    const clean = String(text || '').replace(/(?:최대\s*)?\d[\d,]*\s*(?:만\s*(?:\d{1,4}\s*천?)?)?\s*원\s*(?:상당\s*)?(?:까지\s*)?(?:[의을를이가]\s*)?(?:추가\s*)?(?:할인\s*)?(?:쿠폰|할인|적립|캐시백|포인트|증정|혜택|페이백|청구|확대|지원)/g, ' ');
    // 운임 이야기가 있는 문장의 금액만 ("면세 쇼핑 혜택 17만원" 같은 금액은 뺌)
    const fare = clean.split(/(?<=다\.|요\.)\s*/).filter(x => /운임|항공권|편도|왕복|총액|부터|특가|~/.test(x)).join(' ');
    const vals = parseWon(fare);
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
    for (const [code, a] of Object.entries(AIRLINES)) if ([a.name, ...(a.alias || [])].some(n => text.includes(n))) hit.push(code);
    return hit;
  }

  // ───── 특가 알림 범위 (나라·항공사) ─────
  // 기본값: 베트남·일본, 국적 LCC + 베트남·일본 LCC. data/watchlist.json 의 settings.promoCountries / promoAirlines 로 바꿀 수 있어요.
  // 프로모션: 전체 항공사(국적 대형·저가 + 베트남·일본 항공사). 나라는 뉴스 검색어와 필터 순서에 써요
  const PROMO_DEFAULT = { countries: ['베트남', '일본'], airlines: ['KE', 'OZ', '7C', 'LJ', 'TW', 'BX', 'RS', 'ZE', 'RF', 'YP', 'VJ', 'VN', 'QH', 'VU', 'JL', 'NH', 'MM', 'GK', 'ZG'] };
  // 항공권 검색 탭의 항공사 바로가기: 나라별로 보여 줄 항공사 (노선 운항 여부는 각 사이트에서 확인)
  const KOREAN_AIRLINES = ['KE', 'OZ', '7C', 'LJ', 'TW', 'BX', 'RS', 'ZE', 'RF', 'YP'];
  const AIRLINES_BY_COUNTRY = {
    베트남: ['KE', 'OZ', '7C', 'LJ', 'TW', 'BX', 'ZE', 'RS', 'VJ', 'VN', 'QH', 'VU'],
    일본: ['KE', 'OZ', '7C', 'LJ', 'TW', 'BX', 'RS', 'ZE', 'RF', 'YP', 'JL', 'NH', 'MM', 'ZG', 'GK'],
  };
  const airlinesFor = country => AIRLINES_BY_COUNTRY[country] || KOREAN_AIRLINES;
  // 목적지 목록에 없는 도시도 특가 기사에 자주 나와서 추가 (짧고 다른 낱말에 섞이는 이름은 뺌: 사가·후에·사파 등)
  const EXTRA_PLACES = {
    베트남: ['퀴논', '꾸이년', '하이퐁', '껀터', '붕따우', '무이네', '캄란'],
    일본: ['센다이', '마쓰야마', '마츠야마', '다카마쓰', '다카마츠', '시즈오카', '구마모토', '가고시마', '기타큐슈', '오이타', '미야자키', '히로시마', '오카야마', '요나고', '고마쓰', '니가타', '아오모리', '아사히카와', '도야마', '나가사키', '미야코지마', '이시가키', '하코다테', '구시로', '오비히로', '대마도', '쓰시마', '나리타', '간사이'],
  };
  // 다른 낱말에 섞여 잘못 잡히는 지명은 기사 찾기에서 뺌 (지난해·선전하다·회사가 등)
  const AMBIGUOUS = new Set(['나하', '사가', '후에', '사파', '지난', '선전', '샤먼']);
  // 나라 → 기사에서 찾을 지명들 (목적지 목록이 바뀌면 다시 만듦)
  const COUNTRY_PLACES = {};
  const COUNTRIES = [];
  function buildPlaces() {
    for (const k of Object.keys(COUNTRY_PLACES)) delete COUNTRY_PLACES[k];
    for (const d of DESTS) {
      const list = COUNTRY_PLACES[d.country] = COUNTRY_PLACES[d.country] || [d.country];
      for (const w of [d.city.replace(/\(.*\)/, ''), ...(d.alias || [])]) if (w && w.length >= 2 && !AMBIGUOUS.has(w) && !list.includes(w)) list.push(w);
    }
    for (const [c, ws] of Object.entries(EXTRA_PLACES)) { COUNTRY_PLACES[c] = COUNTRY_PLACES[c] || [c]; for (const w of ws) if (!COUNTRY_PLACES[c].includes(w)) COUNTRY_PLACES[c].push(w); }
    COUNTRIES.length = 0; COUNTRIES.push(...Object.keys(COUNTRY_PLACES));
  }
  buildPlaces();

  const ALL_ROUTES_RE = /전\s?노선|모든\s?노선|국제선/;
  // 글에 나온 나라들, "전 노선·국제선" 특가인지
  function newsScope(text) {
    return { countries: COUNTRIES.filter(c => COUNTRY_PLACES[c].some(w => text.includes(w))), allRoutes: ALL_ROUTES_RE.test(text) };
  }
  // 항공사는 이름("제주항공", "티웨이")이나 코드("7C") 둘 다 받음
  function airlineCode(x) {
    const v = String(x || '').trim();
    if (AIRLINES[v.toUpperCase()]) return v.toUpperCase();
    const hit = Object.entries(AIRLINES).find(([, a]) => a.name === v || (a.alias || []).includes(v));
    return hit ? hit[0] : '';
  }
  function promoSettings(settings) {
    const s = settings || {};
    const air = (s.promoAirlines || []).map(airlineCode).filter(Boolean);
    return { countries: s.promoCountries && s.promoCountries.length ? s.promoCountries : PROMO_DEFAULT.countries, airlines: air.length ? [...new Set(air)] : PROMO_DEFAULT.airlines };
  }
  // 이 특가를 보여 주고 알릴지: 고른 LCC(또는 항공사 이름 없는 기사)이면서, 고른 나라가 나오거나 LCC의 전 노선·국제선 특가
  // 항공권 운임 특가인지 (공식 이벤트 중 공항 이동 할인·면세·제휴 쿠폰·운항 확대 안내 등은 뺌)
  const FARE_RE = /항공권|운임|편도|왕복|총액|특가|세일|SALE|얼리버드|타임\s?세일|반값/i;
  // 프로모션 탭에 보여 줄지: 항공사 특가(전체 항공사) · 카드 할인
  //  - 공식 이벤트는 운임 특가만 (면세·쿠폰·제휴 혜택 등은 카드 탭이나 제외)
  //  - 국내선만 해당하는 소식, 항공사도 나라도 없는 기사는 뺌
  //  - 설정에서 항공사를 골랐으면 그 항공사만
  const DOMESTIC_RE = /국내선|김포\s?[-~·]\s?제주|제주행|김포\s?[-~·]\s?부산/;
  // 국내선(제주행 등)만 다루는 소식: 해외 나라 이름이 없고 '국제선'도 없음
  const isDomestic = p => { const t = `${p.title} ${p.desc || ''}`; return DOMESTIC_RE.test(t) && !(p.countries || []).length && !/국제선/.test(t); };
  const NONFARE_TITLE = /면세|免|호텔|숙박|리조트|렌터카|렌트카|투어|쇼핑|eSIM|이심|유심|보험|라운지|기내식|굿즈|채용|실적|배당|주가|마일리지\s*적립/;
  function isWantedPromo(p, settings) {
    if (p.kind === 'card') return true;
    const text = `${p.title} ${p.desc || ''}`;
    // 제목이 면세점·호텔·투어 같은 다른 상품 이야기이고 항공권·운임 말이 없으면 빼기
    if (NONFARE_TITLE.test(p.title) && !/항공권|운임|특가\s*항공|항공\s*특가/.test(p.title)) return false;
    if (p.official && !FARE_RE.test(text)) return false;
    if (isDomestic(p)) return false;
    const air = p.airlines || [];
    if (!air.length && !(p.countries || []).length) return false;
    const s = settings || {};
    if (!(s.promoAirlines && s.promoAirlines.length)) return true;
    const ps = promoSettings(s);
    return !air.length || air.some(a => ps.airlines.includes(a));
  }
  // ───── 특가 기사·공지에서 핵심 사실만 뽑기 (추정 없음: 글에 적힌 숫자·날짜만) ─────
  function ymdFrom(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  // 날짜 → YYYY-MM-DD. base = 기사 등록일(YYYY-MM-DD). 글에 없는 연·월은 기사 등록일로 채움 (신문 기사 표기 관례)
  //  "2026년 11월 1일", "2026.11.01", "11월 1일", "11/1", "11.1"
  //  "11월 2~15일", "11월 3일부터 9일까지" → 뒤 날짜는 앞 날짜의 월을 이어받음
  //  "다음 달(내달) 2일", "이달 30일", "오는 28일부터 30일까지"(월이 없으면 등록일 기준: 등록일보다 앞선 날이면 다음 달)
  //  "내년 10월까지", "11월 말까지" → 그 달 마지막 날, "12월부터" → 그 달 1일
  // 날짜 바로 뒤 "23시(베트남 시간)", "오후 11시 59분(GMT+7)" → 한국 시각으로 바꿀 때 날짜가 며칠 바뀌는지 (-1·0·1). 시간대가 안 적혀 있으면 0
  const TZ_OFF = { 한국: 9, 일본: 9, 베트남: 7, 태국: 7, 인도네시아: 7, 캄보디아: 7, 라오스: 7, 필리핀: 8, 싱가포르: 8, 말레이시아: 8, 대만: 8, 홍콩: 8, 마카오: 8, 중국: 8, 몽골: 8 };
  function tzShift(after) {
    const m = after.match(/^\s*(?:\([^)]{0,6}\)\s*)?(오전|오후)?\s*(\d{1,2})\s*(?:시|:\s*(\d{2}))/);
    if (!m) return 0;
    let h = Number(m[2]); if (m[1] === '오후' && h < 12) h += 12; if (m[1] === '오전' && h === 12) h = 0;
    const rest = after.slice(m[0].length, m[0].length + 35);
    const g = rest.match(/GMT\s*([+-])\s*(\d{1,2})|UTC\s*([+-])\s*(\d{1,2})/), n = rest.match(/(한국|일본|베트남|태국|인도네시아|캄보디아|라오스|필리핀|싱가포르|말레이시아|대만|홍콩|마카오|중국|몽골)\s*(?:현지\s*)?시간/);
    const off = g ? Number((g[1] || g[3]) + (g[2] || g[4])) : n ? TZ_OFF[n[1]] : null;
    if (off == null || !/^\s*(?:\(|,)?/.test(rest)) return 0;
    const kh = h + (9 - off);
    return kh >= 24 ? 1 : kh < 0 ? -1 : 0;
  }
  // bounded: '까지·부터·~'가 붙은 날짜(기간을 나타내는 날짜)만. "2027년 1월 8일 신규 취항" 같은 날짜는 뺌
  function parseDates(str, base, bounded) {
    const out = [];
    const by = Number(base.slice(0, 4)), bm = Number(base.slice(5, 7)), bd = Number(base.slice(8, 10)) || 1;
    const norm = (y, m) => m > 12 ? [y + 1, m - 12] : m < 1 ? [y - 1, m + 12] : [y, m];
    const re = new RegExp([
      '(\\d{4})\\s*[.\\-/]\\s*(\\d{1,2})\\s*[.\\-/]\\s*(\\d{1,2})', // 1-3  2026.11.01
      '(?:(\\d{4})\\s*년\\s*)?(\\d{1,2})\\s*월\\s*(\\d{1,2})(?!\\d)(?!\\s*(?:만|천|%|원|시|박|개|명|회|편|석|좌석|주|째|차|kg|㎏))\\s*일?', // 4-6  (2026년) 11월 1일
      '(?<![\\d.,])(\\d{1,2})\\s*[./]\\s*(\\d{1,2})(?!\\d|[.,]\\d|\\s*(?:만|천|%|원|배|시간|kg|㎏))', // 7-8  11/1, 11.1
      '(?:(다음\\s*달|내달|이달|이번\\s*달)\\s*)?(?<![\\d.,박])(\\d{1,2})\\s*일', // 9-10  (내달) 2일
    ].join('|'), 'g');
    const EXTRA = '(?:\\s|\\([^)]{0,30}\\)|오전|오후|\\d{1,2}\\s*[시:]\\s*(?:\\d{1,2}\\s*분?)?)*'; // 날짜 뒤 "(월)", "오전 10시", "23:59", "(한국시간)"
    const GAP = new RegExp(`^${EXTRA}(?:[~∼〜\\-–]|부터|에서)\\s*(?:오는\\s*)?$`), TAIL = new RegExp(`^${EXTRA}(?:까지|부터|[~∼〜\\-–]|에서)`);
    let prev = null, m;
    while ((m = re.exec(str))) {
      let y, mo, d;
      const gap = prev ? str.slice(prev.end, m.index) : '';
      const ranged = prev && GAP.test(gap);
      if (m[1]) { y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]); }
      else if (m[5] || m[7]) {
        mo = Number(m[5] || m[7]); d = Number(m[6] || m[8]); y = m[4] ? Number(m[4]) : by;
        if (!m[4]) {
          if (/(?:내년|이듬해)\s*$/.test(str.slice(Math.max(0, m.index - 5), m.index))) y = by + 1; // "내년 10월 30일"
          else if (/올해\s*$/.test(str.slice(Math.max(0, m.index - 4), m.index))) y = by;
          else if (ranged) { y = prev.y; if (mo < prev.mo) y++; }
          // 같은 문장에 나열된 날짜: 바로 앞 날짜가 내년이면 이어받음 ("삿포로는 내년 2월 28일, 나머지 노선은 10월 30일까지")
          // (끝나는 날 '…까지'에만. "…내년 10월 30일까지, 호치민 노선은 12월 3일부터"의 시작일은 이어받지 않음)
          else if (prev && prev.y > by && !/다\.|니다/.test(str.slice(prev.end, m.index)) && new RegExp(`^${EXTRA}까지`).test(str.slice(m.index + m[0].length, m.index + m[0].length + 30))) { y = prev.y; if (mo < prev.mo) y++; }
          else if (mo < bm - 1) y++; // 연도 없이 지난달보다 앞선 달이면 내년
        }
      } else {
        d = Number(m[10]);
        const after = str.slice(m.index + m[0].length, m.index + m[0].length + 24);
        const rel = (m[9] || '').replace(/\s/g, '');
        if (ranged) { [y, mo] = d < prev.d ? norm(prev.y, prev.mo + 1) : [prev.y, prev.mo]; }
        else if (rel) { [y, mo] = rel === '다음달' || rel === '내달' ? norm(by, bm + 1) : [by, bm]; }
        else if (TAIL.test(after)) {
          // 월이 없는 날(오는 28일부터): 기사 등록일 이후로. "지난 25일부터"는 등록일 이전
          const past = /지난\s*$/.test(str.slice(Math.max(0, m.index - 4), m.index));
          [y, mo] = past ? (d <= bd ? [by, bm] : norm(by, bm - 1)) : (d >= bd ? [by, bm] : norm(by, bm + 1));
        } else { continue; } // "3일간", "1일 2회" 같은 건 날짜가 아님
      }
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      const end = m.index + m[0].length;
      // 시각과 시간대가 함께 적혀 있으면 한국 날짜로 바꿈 ("11월 1일 23시(베트남 시간 기준)" → 한국 11월 2일 오전 1시)
      const tz = tzShift(str.slice(end, end + 45));
      if (tz) { const t = new Date(Date.UTC(y, mo - 1, d) + tz * 864e5); y = t.getUTCFullYear(); mo = t.getUTCMonth() + 1; d = t.getUTCDate(); }
      const tail = TAIL.test(str.slice(end, end + 30));
      if (!bounded || tail || ranged) {
        out.push(ymdFrom(y, mo, d));
        // 시작만 있는 날짜("2일부터 …" 뒤에 끝 날짜가 없음) 표시: 뒤에서 끝 날짜가 이어지면 지움
        if (ranged && out.starts) out.starts.delete(ymdFrom(prev.y, prev.mo, prev.d));
        if (/^[^가-힣]*?(?:\([^)]{0,10}\)|오전|오후|\d{1,2}\s*[시:]\s*(?:\d{1,2}\s*분?)?|\s)*(?:부터|[~∼〜\-–]|에서)/.test(str.slice(end, end + 30))) (out.starts = out.starts || new Set()).add(ymdFrom(y, mo, d));
      }
      prev = { y, mo, d, end };
    }
    // "내년 10월까지", "11월 말까지" → 그 달 마지막 날
    const re2 = /(내년|\d{4}\s*년)?\s*(\d{1,2})\s*월\s*(?:말)?\s*까지/g;
    while ((m = re2.exec(str))) {
      const mo = Number(m[2]); if (mo < 1 || mo > 12) continue;
      const y = m[1] === '내년' ? by + 1 : m[1] ? Number(m[1].slice(0, 4)) : (mo < bm - 1 ? by + 1 : by);
      out.push(ymdFrom(y, mo, new Date(Date.UTC(y, mo, 0)).getUTCDate()));
    }
    // "12월부터" → 그 달 1일 ("11월 초부터"처럼 정확한 날이 아니면 쓰지 않음)
    const re3 = /(내년|\d{4}\s*년)?\s*(\d{1,2})\s*월\s*부터/g;
    while ((m = re3.exec(str))) {
      const mo = Number(m[2]); if (mo < 1 || mo > 12) continue;
      const y = m[1] === '내년' ? by + 1 : m[1] ? Number(m[1].slice(0, 4)) : (mo < bm - 1 ? by + 1 : by);
      out.push(ymdFrom(y, mo, 1));
    }
    return out;
  }
  // 기간 키워드 3단계: 강한 것("예약 기간", "탑승 기간") → 약한 것("예약할 수 있다", "탑승 가능") → 행사("프로모션을 진행")
  //  강한 키워드: 뒤 70글자(다른 기간 키워드나 문장 끝에서 멈춤) → 없으면 같은 문장의 앞
  //  약한 키워드·행사: 같은 문장의 앞("11월 2일까지 … 예약할 수 있다") → 없으면 바로 뒤 20글자
  const BOOK_KEYS = [
    { re: /(?:예약|판매|구매|발권)\s*(?:및\s*결제\s*|·\s*발권\s*)?(?:가능\s*)?기간/, after: 70 },
    { re: /예약|판매|발권/, after: 45, back: true },
    { re: /프로모션|행사|이벤트|세일|특가/, after: 40, back: true },
  ];
  const BOARD_KEYS = [
    { re: /(?:탑승|여행|출발)\s*(?:가능\s*)?(?:기간|일정|날짜)|탑승일/, after: 70 },
    { re: /탑승/, after: 20, back: true },
  ];
  const BOOK_STOP = /탑승|여행\s*기간|출발\s*(?:기간|일)|다\.|니다/, BOARD_STOP = /예약|판매|구매|발권|다\.|니다/;
  function periodAfter(text, keys, stopRe, base) {
    // 날짜 1개가 '부터'뿐이면(끝나는 날 없음) 기간으로 쓰지 않음
    const span = ds => { const st = ds.starts; ds = [...new Set(ds)].sort(); if (ds.length === 1 && st && st.has(ds[0])) return null; return ds.length ? { from: ds.length > 1 ? ds[0] : null, to: ds[ds.length - 1] } : null; };
    // 기간은 첫 '까지'에서 끝남 ("… 8월 31일까지며, 호놀룰루 노선은 2월 28일까지" → 뒤 노선 날짜는 안 섞음)
    const after = (m, n, bounded) => { let w = text.slice(m.index + m[0].length, m.index + m[0].length + n); const s = w.search(stopRe); if (s >= 0) w = w.slice(0, s); const k = w.indexOf('까지'); if (k >= 0) w = w.slice(0, k + 2); return span(parseDates(w, base, bounded)); };
    const before = m => {
      let w = text.slice(Math.max(0, m.index - 60), m.index);
      const cut = Math.max(w.lastIndexOf('다.'), w.lastIndexOf('니다'));
      if (cut >= 0) w = w.slice(cut + 2);
      // 앞쪽에 다른 기간 키워드가 있으면 그 뒤만 (예: "… 탑승 가능하며 11월 2일까지 예약")
      let k, last = -1; const g = new RegExp(stopRe.source, 'g'); while ((k = g.exec(w))) last = k.index + k[0].length;
      if (last >= 0) w = w.slice(last);
      return span(parseDates(w, base, true));
    };
    for (const k of keys) {
      const ms = [...text.matchAll(new RegExp(k.re.source, 'g'))];
      for (const m of ms) { const r = k.back ? before(m) || after(m, k.after, true) : after(m, k.after); if (r) return r; }
      if (!k.back) for (const m of ms) { const r = before(m); if (r) return r; }
    }
    return null;
  }
  // ───── 노선마다 다른 가격·탑승기간 ─────
  // 문장을 쉼표·△·'…까지,' 단위 조각으로 나눠서, 조각에 나온 장소가 고른 나라인지 본다
  //  'mine' = 고른 나라 도시가 나옴 · 'other' = 다른 나라·지역(미주 등)만 나옴 · 'none' = 장소 없음(모든 노선 공통)
  const REGION_RE = /미주|유럽|대양주|동남아|동북아|중동|아시아\s*노선|국내선|LA|뉴욕|샌프란시스코|워싱턴|호놀룰루/;
  // 출발지: 서울(인천·김포)이 아닌 곳에서 출발하는 노선 ("부산~후쿠오카", "청주 출발", "대구발")
  const NON_SEOUL_RE = /(?<![가-힣])(?:부산|김해|대구|청주|광주|무안|양양|여수|울산|포항|사천|원주|군산|제주)\s*(?:국제공항|공항)?\s*(?:출발|발(?![가-힣])|발편|[~\-–→∼])/;
  const SEOUL_RE = /(?<![가-힣])(?:인천|김포|서울)\s*(?:국제공항|공항)?\s*(?:출발|발(?![가-힣])|발편|[~\-–→∼])/;
  // 기사 전체가 서울 아닌 곳 출발 특가만 다루는지 (서울 출발 이야기가 하나도 없음)
  const nonSeoulOnly = text => NON_SEOUL_RE.test(text) && !SEOUL_RE.test(text);
  // one: 가격처럼 한 노선에만 해당하는 값 → 여러 나라가 함께 나열된 조각("일본·대만·베트남 … 9만9000원")은 어느 나라 것인지 모름
  function placeScope(clause, country, one) {
    const cs = COUNTRIES.filter(c => COUNTRY_PLACES[c].some(w => clause.includes(w)));
    if (/미주|하와이/.test(clause)) cs.push('미국');
    // 국내선(제주 노선 등)이나 서울이 아닌 곳 출발(부산~후쿠오카 등)의 가격·기간은 아예 안 봄 (이 앱은 서울 출발)
    if (!cs.length && /국내선|(?<![가-힣])제주(?!항공|관광|에어)/.test(clause)) return 'skip';
    if (NON_SEOUL_RE.test(clause) && !SEOUL_RE.test(clause)) return 'skip';
    if (!country) return 'none'; // 나라를 안 고르면 장소 구분 없이 (서로 다른 가격·기간이 여러 개면 '노선마다 다름')
    if (one && new Set(cs).size > 1) return 'other';
    if (cs.includes(country)) return 'mine';
    return cs.length || REGION_RE.test(clause) ? 'other' : 'none';
  }
  // 기간 조각: '…까지(며/고),' 와 △·/ 에서만 나눔 ("방콕과 나리타, 홍콩, 호치민 노선은 …까지"는 한 조각)
  const clausesOf = sent => sent.split(/(?<=까지(?:이며|며|고|이고|로|입니다|이다)?,?)\s+|\s*[△▲]\s*|\s*\/\s*/).filter(Boolean);
  // 금액마다 위치까지 ("방콕 52만8500원 나리타 27만7500원" → 금액 바로 앞에 적힌 장소로 노선 판단)
  function wonAt(str) {
    const out = [];
    for (const m of str.matchAll(/(\d{1,3}(?:\.\d{1,2})?)\s*만\s*(?:(\d{1,4})\s*(천)?)?\s*원/g)) out.push({ v: Math.round(Number(m[1]) * 10000) + (m[2] && !m[1].includes('.') ? (m[3] ? Number(m[2]) * 1000 : Number(m[2])) : 0), i: m.index, end: m.index + m[0].length });
    for (const m of str.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,7})\s*원|₩\s*(\d{1,3}(?:,\d{3})+|\d{4,7})/g)) out.push({ v: Number((m[1] || m[2]).replace(/,/g, '')), i: m.index, end: m.index + m[0].length });
    return out.filter(x => x.v >= 10000 && x.v <= 5000000 && !out.some(y => y !== x && y.i <= x.i && y.end >= x.end && y.end - y.i > x.end - x.i)).sort((a, b) => a.i - b.i);
  }
  const FARE_CTX = /운임|항공권|편도|왕복|총액|부터|특가|~|판매/;
  const COUPON_RE = /(?:최대\s*)?\d[\d,]*\s*(?:만\s*(?:\d{1,4}\s*천?)?)?\s*원\s*(?:상당\s*)?(?:까지\s*)?(?:[의을를이가]\s*)?(?:추가\s*)?(?:할인\s*)?(?:쿠폰|할인|적립|캐시백|포인트|증정|혜택|페이백|청구|확대|지원)/g;
  // 가격: 장소가 다른 가격이 여러 개면(노선마다 다름) 가격을 쓰지 않음 → 할인율만
  function fareFacts(t, country) {
    const items = []; // { v, trip, scope }
    const tOne = /편도/.test(t), tRt = /왕복/.test(t);
    for (const sent of t.split(/(?<=다\.|요\.)\s*/)) {
      const clean = sent.replace(COUPON_RE, ' ');
      if (!FARE_CTX.test(clean)) continue;
      const sOne = /편도/.test(clean), sRt = /왕복/.test(clean);
      let prev = 0;
      for (const a of wonAt(clean)) {
        const seg = clean.slice(prev, a.i); prev = a.end;
        // 편도·왕복: 금액 바로 앞 → 같은 문장 → 기사 전체에 한 가지만 적혀 있으면 그것
        const one = /편도/.test(seg) || (!/왕복/.test(seg) && (sOne && !sRt || (!sOne && !sRt && tOne && !tRt)));
        const rt = /왕복/.test(seg) || (!/편도/.test(seg) && (sRt && !sOne || (!sOne && !sRt && tRt && !tOne)));
        items.push({ v: a.v, trip: one && !rt ? 'oneway' : rt && !one ? 'round' : 'oneway?', scope: placeScope(seg, country, true) });
      }
    }
    const use = items.filter(x => x.scope !== 'skip'); // 국내선·서울 아닌 출발 가격은 버림
    const best = l => l.reduce((a, x) => x.v < a.v ? x : a);
    const asPrice = x => ({ amount: x.v, trip: x.trip });
    // 고른 나라 노선 가격이 적혀 있으면 그중 가장 낮은 값 (좌석 등급별로 여러 개일 수 있음, '~부터')
    const mine = use.filter(x => x.scope === 'mine');
    if (mine.length) return { price: asPrice(best(mine)), priceFor: country };
    const none = use.filter(x => x.scope === 'none');
    // 같은 편도/왕복 안에서 금액이 여러 개거나 다른 노선 가격이 섞이면 '노선마다 다름'
    const byTrip = new Map(); for (const x of none) byTrip.set(x.trip, new Set([...(byTrip.get(x.trip) || []), x.v]));
    if ([...byTrip.values()].some(v => v.size > 1) || use.some(x => x.scope === 'other')) return { mixed: true };
    if (!none.length) return {};
    // "편도 5만9000원, 왕복 11만원"처럼 편도·왕복이 함께면 둘 다 (알림은 둘 중 하나라도 조건에 맞으면)
    const prices = [...new Map(none.map(x => [x.trip, asPrice(x)])).values()];
    return { price: prices.find(p => p.trip === 'oneway') || prices[0], prices };
  }
  // 탑승기간: '탑승·이용' 문장의 조각마다 기간을 모아서, 노선마다 다르면 고른 나라 노선 것만 (없으면 '노선마다 다름')
  const BOARD_CTX = /탑승|이용할\s*수|이용\s*가능|이용\s*기간|여행\s*기간|출발\s*기간/, NOT_BOARD = /예약|판매|구매|발권|결제|프로모션|행사|이벤트|진행|취항한다|운항한다/;
  function boardFacts(t, base, country) {
    let cands = [];
    for (const sent of t.split(/(?<=다\.|요\.)\s*/)) {
      if (!BOARD_CTX.test(sent)) continue;
      let cur = 0;
      for (const c of clausesOf(sent)) {
        const at = sent.indexOf(c, cur); cur = at + c.length;
        if (NOT_BOARD.test(c) && !BOARD_CTX.test(c)) continue;
        const k = c.indexOf('까지'); const cc = k >= 0 ? c.slice(0, k + 2) : c;
        // 문장 앞부분까지 함께 읽어야 '내년'이 이어짐 → 이 조각에서 새로 나온 날짜만
        const before = parseDates(sent.slice(0, at), base, true).length;
        const got = parseDates(sent.slice(0, at) + cc, base, true);
        const ds = [...new Set(got.slice(before))].sort();
        if (!ds.length) continue;
        // "호치민 노선은 취항일인 12월 3일부터 이용 가능" → 끝나는 날이 아니라 시작일
        if (ds.length === 1 && got.starts && got.starts.has(ds[0]) && !/까지/.test(cc)) { cands.push({ scope: placeScope(c, country), start: ds[0] }); continue; }
        cands.push({ scope: placeScope(c, country), p: { from: ds.length > 1 ? ds[0] : null, to: ds[ds.length - 1] } });
      }
    }
    cands = cands.filter(x => x.scope !== 'skip'); // 국내선·서울 아닌 출발 노선 기간은 버림
    const starts = cands.filter(x => x.start);
    const startFor = sc => (starts.find(x => x.scope === sc) || {}).start;
    cands = cands.filter(x => !x.start);
    if (!cands.length) return null;
    const key = x => x.p.to;
    const mine = cands.filter(x => x.scope === 'mine'), none = cands.filter(x => x.scope === 'none'), other = cands.filter(x => x.scope === 'other');
    const pick = l => { if (new Set(l.map(key)).size !== 1) return null; const x = l.find(y => y.p.from) || l[0]; const st = startFor(x.scope); return st && !x.p.from && st <= x.p.to ? { ...x, p: { from: st, to: x.p.to } } : x; };
    if (mine.length) { const x = pick(mine); return x ? { board: x.p, boardFor: country } : { mixed: true, mineMixed: true }; } // 같은 나라 안에서도 노선마다 다름
    if (other.length) return { mixed: true }; // 다른 노선 기간만 있거나, 공통 기간과 노선별 기간이 섞임
    const x = pick(none);
    return x ? { board: x.p } : { mixed: true };
  }
  function promoFacts(text, base, country) {
    const t = stripTags(text);
    const f = {};
    const fare = fareFacts(t, country);
    if (fare.price) f.price = fare.price;
    if (fare.prices && fare.prices.length > 1) f.prices = fare.prices;
    if (fare.priceFor) f.priceFor = fare.priceFor;
    if (fare.mixed) f.priceMixed = true;
    const pct = [...t.matchAll(/(최대\s*)?(\d{1,2})\s*%\s*(?:할인|특가|세일|↓)?/g)].map(m => Number(m[2])).filter(n => n >= 3 && n <= 95);
    if (pct.length) f.pct = Math.max(...pct);
    const code = t.match(/(?:프로모션\s*코드|할인\s*코드|쿠폰\s*코드|코드)\s*(?:는|은|인|명)?\s*[:：]?\s*[‘'"“(\[「<]?\s*([A-Z][A-Z0-9]{3,14})/) || t.match(/[‘'"“(\[「<]([A-Z][A-Z0-9]{3,14})[’'"”)\]」>]\s*(?:을|를|이라는|라는)?\s*(?:할인\s*|프로모션\s*|쿠폰\s*)?코드/) || t.match(/\b([A-Z][A-Z0-9]{3,14})\s*(?:할인\s*|프로모션\s*)?코드/);
    if (code) f.code = code[1];
    else if (/(?:프로모션|할인|쿠폰)\s*코드/.test(t)) f.codeHint = true; // 코드 값은 없지만 할인 코드를 준다고 적힌 경우
    // 탑승기간: 노선별로 나눠 볼 수 있으면 그 결과, 아니면 키워드 근처 날짜
    let raw = periodAfter(t, BOARD_KEYS, BOARD_STOP, base);
    let book = periodAfter(t, BOOK_KEYS, BOOK_STOP, base);
    // 날짜가 하나뿐이라 예약·탑승에 똑같이 붙었으면, 그 날짜 바로 앞에 더 가까이 있는 쪽만 남김
    if (book && raw && book.to === raw.to && book.from === raw.from) {
      const firstDate = t.search(/\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}\s*[년.]|\d{1,2}월\s*(?:말)?\s*까지/);
      const lastBefore = re => { let i = -1, m; const g = new RegExp(re.source, 'g'); while ((m = g.exec(t)) && m.index < firstDate) i = m.index; return i; };
      if (lastBefore(BOOK_KEYS[1].re) > lastBefore(BOARD_KEYS[1].re)) raw = null; else book = null;
    }
    if (book) f.book = book;
    // 탑승기간: 노선별로 나눠 볼 수 있으면 그 결과(고른 나라 노선 / 노선마다 다름), 아니면 키워드 근처 날짜
    const bf = boardFacts(t, base, country);
    const board = bf ? bf.board : raw;
    if (board && !(f.book && f.book.to === board.to && f.book.from === board.from)) f.board = board;
    if (bf && bf.boardFor) f.boardFor = bf.boardFor;
    if (bf && bf.mixed) f.boardMixed = true;
    if (bf && bf.mineMixed) f.boardMineMixed = true;
    return f;
  }
  // ───── 여러 항공사 소식을 모은 기사([하늘길] 등): 항공사별 문장 나누기 ─────
  // 문장 맨 앞(주어 자리)에 나오는 항공사를 '지금 말하는 항공사'로 보고, 다음 항공사가 나올 때까지 이어짐
  function splitSentences(text) {
    return String(text || '').split(/(?<=다\.|요\.|[!?])\s*|\s*[▲■▶◆●□※◇◆○]\s*/).map(s => s.trim()).filter(s => s.length >= 4);
  }
  function subjectAirline(s) {
    // 문장 앞 머리말(언론사·기자 이름, '한편' 같은 연결어)은 빼고 봄
    const t = String(s).replace(/^\s*[\[(【][^\])】]{1,30}[\])】]\s*/, '').replace(/^[^=]{1,30}=\s*/, '').replace(/^[가-힣]{2,4}\s*기자\s*/, '')
      .replace(/^[\s\[\]【】()<>"'“”‘’\-–·•]+/, '').replace(/^(?:한편|또한|또|아울러|이와\s*함께|이\s*밖에|이밖에|이어|이어서)\s*,?\s*/, '');
    let best = null, at = 99;
    for (const [code, a] of Object.entries(AIRLINES)) for (const n of [a.name, ...(a.alias || [])]) {
      const i = t.indexOf(n);
      if (i >= 0 && i <= 2 && i < at) { best = code; at = i; }
    }
    return best;
  }
  // 기자 이름 줄("[○○뉴스=홍길동 기자]", "(서울=뉴스1) 홍길동 기자 =") 앞의 제목·부제 되풀이는 뺌 (부제는 줄여 쓰다 틀리는 경우가 있음)
  const BYLINE_RE = /\[[^\]]{2,40}?(?:기자|특파원)\s*\]|\([^)]{2,20}=[^)]{0,20}\)\s*[가-힣]{2,4}\s*(?:기자|특파원)\s*=|\[[^\]]{2,20}=[^\]]{0,20}\]\s*[가-힣]{2,4}\s*(?:기자|특파원)\s*=|[가-힣]{2,4}\s*(?:기자|특파원)\s*=/;
  function dropHead(parts, title) {
    const key = String(title || '').replace(/[^가-힣A-Za-z0-9]/g, '').slice(0, 14);
    if (key.length >= 8) parts = parts.filter(x => !x.replace(/[^가-힣A-Za-z0-9]/g, '').startsWith(key));
    const i = parts.slice(0, 6).findIndex(x => BYLINE_RE.test(x));
    if (i < 0) return parts;
    const m = parts[i].match(BYLINE_RE);
    return [parts[i].slice(m.index), ...parts.slice(i + 1)];
  }
  // parts: 순서대로 된 문장들, code: 보여 줄 항공사 (없으면 어느 항공사 소식도 아닌 문장만)
  function airlineText(parts, code) {
    const subj = parts.map(subjectAirline);
    const many = new Set(subj.filter(Boolean)).size >= 2;
    if (!many) return parts.join(' ');
    let owner = null; const keep = [];
    parts.forEach((s, i) => { if (subj[i]) owner = subj[i]; if (owner === (code || null)) keep.push(s); });
    return keep.join(' ');
  }
  // 같은 특가인지 핵심 사실로 비교 (기사 표현은 달라도 금액·할인율·코드·예약기간·탑승기간은 같음)
  //  -1: 둘 다 적힌 값 중 하나라도 다름(다른 특가) · 1: 같은 값 2개 이상, 그중 기간 1개 이상(같은 특가) · 0: 판단할 정보 부족
  const FACT_KEYS = [['price', f => f.price && f.price.amount], ['pct', f => f.pct], ['code', f => f.code],
    ['book', f => f.book && f.book.to], ['bookFrom', f => f.book && f.book.from], ['board', f => f.board && f.board.to], ['boardFrom', f => f.board && f.board.from]];
  //  기사마다 예로 드는 노선 가격·할인율이 달라서, 할인 코드가 같거나 예약기간·탑승기간이 둘 다 같으면 가격·할인율이 달라도 같은 특가
  function sameFacts(a, b) {
    a = a || {}; b = b || {};
    const eq = (x, y) => x != null && y != null && x === y, ne = (x, y) => x != null && y != null && x !== y;
    const bt = f => f.book && f.book.to, bf = f => f.book && f.book.from, gt = f => f.board && f.board.to, gf = f => f.board && f.board.from;
    // 예약 마감일이 하루 차이("11월 2일 오전 1시(한국시간)"와 "11월 1일 23시"처럼 시간대 표기 차이)면, 탑승기간이나 코드가 같을 때 같은 특가로 봄
    const day1 = (x, y) => x && y && Math.abs(new Date(x) - new Date(y)) === 864e5;
    const bookNear = day1(bt(a), bt(b)) && (eq(gt(a), gt(b)) || eq(a.code, b.code));
    const bookConflict = (ne(bt(a), bt(b)) && !bookNear) || ne(bf(a), bf(b));
    // 할인 코드가 같으면 같은 특가 (탑승기간은 기사마다 다른 노선을 예로 들 수 있어서 비교 안 함)
    if (eq(a.code, b.code) && !bookConflict) return 1;
    const dateConflict = bookConflict || ne(gt(a), gt(b)) || ne(a.code, b.code);
    if (!dateConflict && (eq(bt(a), bt(b)) || bookNear) && eq(gt(a), gt(b))) return 1;
    let same = 0, date = false;
    for (const [k, get] of FACT_KEYS) {
      const x = get(a || {}), y = get(b || {});
      if (x == null || y == null) continue;
      if (x !== y) { if (k === 'price' || k === 'pct') continue; if ((k === 'board' || k === 'boardFrom') && eq(a.code, b.code)) continue; return -1; } // 가격·할인율은 기사마다 예로 드는 노선이 달라 다를 수 있음
      same++; if (k === 'book' || k === 'board') date = true;
    }
    return same >= 2 && date ? 1 : 0;
  }
  // 사실 합치기: 먼저 나온 값 우선, 빈 칸만 채움
  function mergeFacts(a, b) {
    const o = { ...(a || {}) };
    for (const [k, v] of Object.entries(b || {})) if (o[k] == null) o[k] = v;
    return o;
  }
  // 요약 문장 속 '다음 달·내달·이달·오는 N일·내년'을 기사 등록일 기준 날짜로 바꿔 적기 (base = YYYY-MM-DD)
  function absDates(text, base) {
    if (!base) return text;
    const by = Number(base.slice(0, 4)), bm = Number(base.slice(5, 7)), bd = Number(base.slice(8, 10));
    const next = bm === 12 ? [by + 1, 1] : [by, bm + 1], prev = bm === 1 ? [by - 1, 12] : [by, bm - 1];
    const ym = ([y, m]) => y !== by ? `${y}년 ${m}월` : `${m}월`;
    return String(text)
      .replace(/(다음\s*달|내달|이달|이번\s*달)\s*(\d{1,2})\s*일/g, (_, w, d) => `${ym(/이/.test(w) ? [by, bm] : next)} ${d}일`)
      .replace(/(다음\s*달|내달)(?!\s*\d)/g, () => ym(next))
      .replace(/(이달|이번\s*달)(?!\s*\d)/g, () => ym([by, bm]))
      .replace(/(오는|지난)\s*(\d{1,2})\s*일/g, (_, w, d) => { const n = Number(d); return `${ym(w === '지난' ? (n <= bd ? [by, bm] : prev) : (n >= bd ? [by, bm] : next))} ${n}일`; })
      .replace(/내년\s*(\d{1,2})\s*월/g, (_, m) => `${by + 1}년 ${m}월`)
      .replace(/내년(?!\s*\d)/g, `${by + 1}년`)
      .replace(/올해\s*(\d{1,2})\s*월/g, (_, m) => `${by}년 ${m}월`);
  }
  // 여행 날짜가 탑승 기간 안인지: 'in' | 'out' | null(기간 정보 없음)
  function fitsTrip(f, dep, ret) {
    if (!f || !f.board || !dep) return null;
    const from = f.board.from || '0000-00-00', to = f.board.to;
    return dep >= from && (ret || dep) <= to ? 'in' : 'out';
  }

  // ───── 카드 할인: 핵심 사실 + 고른 나라에서 쓸 수 있는지 (원문에 적힌 사용처 기준) ─────
  const OTA_RE = /트립닷컴|인터파크|하나투어|모두투어|노랑풍선|참좋은여행|마이리얼트립|익스피디아|아고다|스카이스캐너|네이버\s?항공|여행\s?플랫폼|온라인\s?여행사/;
  const OVERSEAS_RE = /해외\s?(?:항공권|여행|결제|이용)|국제선|전\s?노선|모든\s?노선/;
  function cardFacts(text, base) {
    const t = stripTags(text);
    const f = {};
    const amt = t.match(/(최대\s*)?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d)?)\s*(만|천)?\s*원\s*(?:상당\s*)?(청구\s*할인|즉시\s*할인|할인|캐시백|적립|페이백|혜택)/);
    if (amt) f.amount = `${amt[1] ? '최대 ' : ''}${amt[2]}${amt[3] || ''}원 ${amt[4].replace(/\s/g, '')}`;
    const pct = [...t.matchAll(/(\d{1,2})\s*%\s*(?:청구\s*할인|즉시\s*할인|할인|캐시백|적립)/g)].map(m => Number(m[1])).filter(n => n >= 2 && n <= 70);
    if (pct.length) f.pct = Math.max(...pct);
    const min = t.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(만\s*)?원\s*이상\s*(?:결제|이용|구매)/);
    if (min) f.min = `${min[1]}${min[2] ? '만' : ''}원 이상 결제`;
    const per = periodAfter(t, [{ re: /(?:이벤트|행사|결제|프로모션|할인|응모|적용)\s*기간|기간\s*[:：]/, after: 70 }], /다\.|니다/, base) || (() => { const ds = parseDates(t, base).sort(); return ds.length ? { from: ds.length > 1 ? ds[0] : null, to: ds[ds.length - 1] } : null; })();
    if (per) f.period = per;
    return f;
  }
  // use: 'ok'(그 나라 운항 항공사·그 나라 언급) | 'all'(해외 항공권 전체·여행 플랫폼) | 'no'(다른 나라만 적힘) | 'unknown'
  //  운항 항공사 목록(최근 가격 기록)은 빠진 항공사가 있을 수 있어서, 항공사만으로 '해당 없음'이라고 하지 않음
  function cardUse(p, country, servingCodes) {
    const text = `${p.title} ${p.desc || ''}`;
    const air = (p.airlines || []).filter(Boolean), cs = p.countries || [];
    const servingHit = air.filter(a => servingCodes.includes(a));
    if (servingHit.length || cs.includes(country)) return { use: 'ok', why: servingHit };
    if (cs.length) return { use: 'no', why: cs };
    if (air.length) return { use: 'unknown', why: air, air: true };
    if (OVERSEAS_RE.test(text) || OTA_RE.test(text)) return { use: 'all', why: [] };
    return { use: 'unknown', why: [] };
  }

  // 결제 혜택(간편결제·카드 제휴): 항공사 공식 이벤트 중 운임 특가가 아닌 결제 할인 → 카드 탭
  const PAY_RE = /결제|페이|카드|청구할인|즉시할인|캐시백/;
  const isPayBenefit = p => p.official && p.kind !== 'card' && PAY_RE.test(`${p.title} ${p.desc || ''}`) && !FARE_RE.test(`${p.title} ${p.desc || ''}`);

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
    return { kind, cards, airlines: air, routes: matched, price: promoPrice(text), ...newsScope(text) };
  }


  function won(n) { return n ? `${Math.round(n).toLocaleString('ko-KR')}원` : '-'; }
  function routeKey(w) { return `${w.origin}-${w.dest}-${w.minNights}-${w.maxNights}-${w.direct ? 'D' : 'A'}`; }

  const api = {
    ORIGINS, DESTS, AIRLINES, CLIMATE, REGION_NAME, HOLIDAYS, PEAK, CARDS, AGENCIES, CARD_NAMES,
    monthsBetween, nightsBetween, addDays, addMonths, weekday, findDest, airline,
    promoFacts, nonSeoulOnly, dropHead, sameFacts, mergeFacts, absDates, isDomestic, parseDates, splitSentences, subjectAirline, airlineText, fitsTrip, cardFacts, cardUse, links, skyMonth, ttang, climateOf, holidaysIn, KOREAN_AIRLINES, airlinesFor, isPayBenefit,
    stripTags, parseWon, promoPrice, classifyNews, won, routeKey,
    PROMO_DEFAULT, COUNTRIES, COUNTRY_PLACES, airlineInText, airlineCode, newsScope, promoSettings, isWantedPromo,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlightCore = api;
})(typeof self !== 'undefined' ? self : this);
