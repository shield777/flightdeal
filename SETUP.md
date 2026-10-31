# 최저가 항공권: 처음 설정 (한 번만)

> 아이패드 Safari나 컴퓨터로 github.com에 로그인해서 하는 게 편해요. 파이썬·설치는 필요 없어요.

## 어떻게 돌아가나요

```
앱에서 [월별 최저가 검색]   → GitHub 서버(Actions, 무료)가 Travelpayouts에 조회 → data/search.json → 앱에 표시 (30초~1분)
프로모션 탭 [지금 확인]      → 항공사 공식 이벤트(제주항공·트리니티항공·비엣젯) + 특가 뉴스 + 카드 할인 → data/promos.json (1~2분)
```
매일 자동 실행·알림은 없어요. 버튼을 누를 때만 돌아요.
앱이 Travelpayouts에 직접 묻지 못하는 이유: 브라우저 보안 규칙(CORS) 때문에 막혀 있어서, GitHub 서버가 대신 물어봐요.

## 1. 가격 자료: Travelpayouts 토큰 (무료)

1. <https://www.travelpayouts.com> 가입 (이메일만 있으면 돼요). Drive 설치 화면은 건너뛰기.
2. 대시보드에서 **Aviasales** 프로그램 참여 → 계정 메뉴의 **API token** 복사.

## 2. GitHub에 비밀값 넣기

저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| 이름 | 값 | 필수 |
| --- | --- | --- |
| `TP_TOKEN` | 1번의 Travelpayouts 토큰 | 필수 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 개발자센터 검색 API 키 | 선택(국내 뉴스를 더 잘 잡아요) |

## 3. 웹앱 주소 켜기 (GitHub Pages)

저장소 → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: **main**, **/ (root)** → **Save**.
1~2분 뒤 `https://shield777.github.io/flightdeal/` 가 열려요. 아이폰 Safari로 열고 **공유 → 홈 화면에 추가**.

## 4. 앱에 GitHub 토큰 넣기 (검색 버튼에 필요)

검색·지금 확인 버튼이 GitHub 서버를 움직이려면 토큰이 필요해요.

1. github.com → 오른쪽 위 사진 → **Settings** → 맨 아래 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
2. Token name: 아무거나(예: `flightdeal 앱`), Expiration: **1년** 정도
3. Repository access: **Only select repositories** → `flightdeal`
4. Permissions → Repository permissions:
   - **Actions: Read and write** (검색 실행)
   - **Contents: Read and write** (결과 읽기, 프로모션 범위 저장)
5. **Generate token** → 나온 토큰(`github_pat_…`) 복사
6. 앱 ⚙ 설정 → **토큰** 칸에 붙여넣기 → **저장**

토큰은 그 기기에만 저장돼요. 다른 기기에서 검색하려면 그 기기에도 넣어야 해요(같은 토큰을 써도 돼요).
⚠️ 토큰은 비밀번호 같은 거라 메신저·채팅에 붙여넣지 마세요.

## 프로모션 범위 바꾸기 (나라·항공사)

기본값은 **베트남·일본**, **LCC만**(대한항공·아시아나 같은 대형 항공사는 빼요).

**방법 1. 앱에서**: ⚙ 설정 → **프로모션 범위** → 나라·항공사 체크 → **범위 저장**

**방법 2. github.com에서 직접**:
1. 저장소에서 `data` 폴더 → `watchlist.json` → 오른쪽 위 **✏️(연필)**
2. 아래 두 줄의 `[ ]` 안을 고치기. 따옴표(`"`)와 쉼표(`,`)를 지켜 주세요.
   ```json
   "promoCountries": ["베트남", "일본"],
   "promoAirlines": ["제주항공", "진에어", "트리니티항공", "에어부산", "에어서울", "이스타항공", "에어로케이", "비엣젯", "비엣트래블", "피치항공", "젯스타 재팬", "집에어"],
   ```
   - 나라 예: `"대만"`, `"태국"`, `"필리핀"` (앱의 나라 목록에 있는 이름)
   - 항공사는 한글 이름 그대로 (티웨이는 2026년부터 **트리니티항공**. "티웨이"라고 써도 알아들어요)
3. 아래 **Commit changes** → 다음 [지금 확인]부터 반영

**어디서 확인하나요**
| 항공사 | 방법 |
|---|---|
| 제주항공 · 트리니티항공 · 비엣젯 | **공식 홈페이지 이벤트 목록을 직접 확인** (공식 배지) |
| 진에어 · 에어부산 · 이스타 등 | 사이트가 자동 접속을 막아서 **뉴스로만** 확인 → 각 항공사 앱의 마케팅 알림을 켜 두면 가장 빨라요 |

공식 홈페이지는 구조가 바뀌면 0건이 나올 수 있어요. Actions 기록에 `공식 7C: 0건 (사이트 구조가 바뀌었을 수 있어요)`가 보이면 알려 주세요.

## 잘 안 될 때

- **검색 중 시간이 오래 걸리거나 실패**: 저장소 → **Actions** → **항공권 검색·프로모션 확인** → 맨 위 실행 기록을 열어 보세요. 빨간 ✗면 그 화면을 캡처해서 알려 주세요.
- **"GitHub 401/403"**: 토큰이 만료됐거나 권한(Actions·Contents 읽기/쓰기)이 빠졌어요. 4번대로 다시 만들기.
- **"permission denied" (결과 저장 단계)**: Settings → Actions → General → Workflow permissions → **Read and write permissions**.

## 알아 둘 한계 (솔직하게)

- **가격은 "다른 사람들이 최근 검색한 기록(캐시)"** 이에요. 검색을 누른 그 순간의 기록을 가져오지만, 실시간 좌석 가격은 아니라서 결제 화면 가격과 다를 수 있어요. 먼 달은 기록이 비어 있을 수 있어요. 그럴 땐 카드의 구글·네이버 버튼으로 바로 확인하세요.
- **수하물 포함 여부는 앱에 표시하지 않아요.** 같은 항공사도 운임마다 달라서, 확인되지 않은 추정은 넣지 않았어요. 예약 화면에서 확인하세요.
- **특가·카드 할인은 공식 홈페이지 3곳 + 뉴스로 찾아요.** 나머지 항공사·카드사는 공식 자료를 자동으로 받을 수 없어요. 기사 제목은 원문 그대로이고, 조건·가격은 원문에서 확인하세요.
- **매일 쌓지 않아서** 가격 추이·평균·가격 하락 알림은 없어요.
