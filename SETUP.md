# 최저가 항공권: 처음 설정 (약 20분, 한 번만)

> 아이패드 Safari나 컴퓨터로 github.com에 로그인해서 하는 게 편해요. 파이썬·설치는 필요 없어요.

## 어떻게 돌아가나요

```
매일 아침 07:23 (GitHub Actions, 무료)
  ├─ data/watchlist.json 의 추적 노선을 달마다 가격 조회 (Travelpayouts)
  ├─ 항공사 특가·카드(우리·현대·신한) 할인 뉴스 확인 (구글 뉴스, 선택: 네이버 뉴스)
  ├─ 결과를 data/flight-results.json, data/promos.json 에 저장 (날마다 쌓여서 "평균"이 생겨요)
  └─ 새 특가 · 카드 할인 · 가격 하락이 있으면 아이폰으로 알림 (ntfy 앱)
앱(index.html)은 이 파일을 읽어서 보여 줘요.
```

## 1. 가격 자료: Travelpayouts 토큰 (무료)

1. <https://www.travelpayouts.com> 가입 (이메일만 있으면 돼요).
2. 대시보드에서 **Aviasales** 프로그램에 참여한 뒤, 계정/개발자 메뉴의 **API token**을 복사해요.
   (메뉴 이름은 바뀔 수 있어요. "API token"을 찾으면 돼요.)

## 2. 알림: ntfy 앱 (무료)

1. 아이폰 App Store에서 **ntfy** 설치 → 알림 허용.
2. 앱에서 **+** → 주제(topic) 이름에 남이 못 맞힐 이름을 넣어요. 예: `flightdeal-sh-7k2q9x`
   - 주제 이름을 아는 사람은 알림을 볼 수 있어요. 길고 무작위로 정하세요.
3. 애플워치는 아이폰 알림을 그대로 받아요.

## 3. GitHub에 비밀값 넣기

저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| 이름 | 값 | 필수 |
| --- | --- | --- |
| `TP_TOKEN` | 1번의 Travelpayouts 토큰 | 가격 보려면 필수 |
| `NTFY_TOPIC` | 2번의 주제 이름 | 알림 받으려면 필수 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 개발자센터 검색 API 키 | 선택(국내 뉴스를 더 잘 잡아요) |

## 4. 웹앱 주소 켜기 (GitHub Pages)

저장소 → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: **main**, **/ (root)** → **Save**.
1~2분 뒤 `https://shield777.github.io/flightdeal/` 가 열려요. 아이폰 Safari로 열고 **공유 → 홈 화면에 추가**.

## 5. 첫 실행 · 알림 테스트

저장소 → **Actions** → **항공권 매일 확인** → **Run workflow**

- `mode: test-notify` → 아이폰에 "알림 테스트"가 오면 성공
- `mode: check` → 가격·뉴스 첫 확인 (1~3분). 첫 실행은 이미 나와 있던 뉴스를 **알림 없이 저장만** 해요(알림 폭탄 방지).

실패하면 Actions 화면에서 빨간 실행을 눌러 로그를 보세요. "permission denied"가 나오면
**Settings → Actions → General → Workflow permissions → Read and write permissions**로 바꿔 주세요.

## 6. (선택) 앱 버튼으로 추적 추가·지금 갱신

앱의 **매일 추적 + 알림 시작**, **지금 갱신**, **목표가·기간** 버튼은 GitHub 토큰이 있어야 해요.

1. github.com → 오른쪽 위 사진 → **Settings** → 맨 아래 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
2. Repository access: **Only select repositories** → `flightdeal`
3. Permissions: **Contents: Read and write**, **Actions: Read and write**
4. 만료일은 1년 정도로. 만든 토큰을 앱의 ⚙ 설정 → **토큰** 칸에 붙여넣기.

토큰은 그 기기에만 저장돼요(가족 기기에는 넣지 않아도 보기는 돼요). 토큰 없이도
`data/watchlist.json`을 github.com에서 직접 고쳐서 추적을 추가할 수 있어요(앱이 넣을 한 줄을 만들어 줘요).

## 추적 목록 직접 고치기 (`data/watchlist.json`)

```json
{ "origin": "SEL", "dest": "CXR", "from": "2027-01", "to": "2027-10",
  "minNights": 3, "maxNights": 5, "direct": false, "adults": 3, "targetPrice": 300000 }
```

- `origin`: SEL(서울) PUS(부산) CJU(제주) TAE(대구) CJJ(청주)
- `dest`: 공항·도시 코드 (나트랑 CXR, 다낭 DAD, 방콕 BKK, 오사카 OSA, 도쿄 TYO …, 목록은 `js/flight-core.js`)
- `targetPrice`: 1인 왕복 이 값 이하면 알림 (0이면 꺼짐)
- `settings.notifyDropPct`: 지난 30일 평균보다 몇 % 싸지면 알릴지 (기본 15)

## 알아 둘 한계 (솔직하게)

- **가격은 "다른 사람들이 최근 검색한 기록(캐시)"** 이에요. 실시간 좌석 가격이 아니라서, 결제 화면 가격과 다를 수 있어요. 먼 달(예: 10개월 뒤)은 기록이 비어 있을 수 있어요. 그럴 땐 카드의 구글·네이버 버튼으로 바로 확인하세요.
- **수하물 포함 여부는 항공사 기준표(추정)** 예요. 같은 항공사도 운임마다 달라요. 15kg 요금도 추정값(설정에서 수정 가능)이에요.
- **특가·카드 할인은 뉴스로 찾아요.** 카드사·항공사가 공식 API를 주지 않아서예요. 기사보다 늦거나 놓칠 수 있고, 기사 속 가격은 "편도 ~부터"인 경우가 많아요.
- **"평균 대비"** 는 ① 그 달 검색 기록의 중앙값(첫날부터), ② 매일 쌓은 최저가의 30일 평균(약 1~2주 뒤부터) 두 가지예요.
- GitHub는 저장소에 60일 동안 활동이 없으면 예약 실행을 멈출 수 있어요. 멈추면 메일이 오고, Actions 화면에서 다시 켜면 돼요.
