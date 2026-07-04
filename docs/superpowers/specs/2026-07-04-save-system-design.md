# Sub-Antarctic 저장/불러오기 — 설계

날짜: 2026-07-04
상태: 승인됨
기반: 1단계 확장 (master e6c806a, 테스트 39개)

## 1. 목적 & 원칙

단일 슬롯 **거점 자동저장**. 원칙: **"거점 = 저장 포인트"** — 살아서 돌아온 것만 남는다.
- 거점 복귀(은행)마다 자동 저장. 저장 UI/버튼 없음
- 잠수 도중 이탈(브라우저 종료·새로고침) = 소지 광물 손실, 마지막 거점 저장으로 복귀 — 기존 사망 규칙과 동일한 감각
- 슬롯 1개, 난이도 포함 저장. localStorage 키 `'save'`

## 2. 저장 데이터 (JSON, 버전 필드)

```json
{
  "v": 1,
  "difficulty": "normal",
  "banked": 34,
  "upgrades": { "tank": true, "damage": false, "lamp": false, "fins": false, "suit": false },
  "nodesHp": { "1608,168": 1, "920,552": 0 },
  "bossDead": false,
  "cleared": false
}
```

- `nodesHp`: **기본값(2)과 다른 노드만** `"x,y" → hp` 로 기록 (좌표 = parseMap이 만든 월드px 중심). 난이도 트리밍과 무관하게 좌표로 매칭되므로 안전
- `bossDead`: 보스 처치 여부. `cleared`: 유물을 거점에 가져와 클리어했는지
- `v !== 1`이면 저장 무시 (없는 것으로 취급)

## 3. 모듈: `src/save.js`

순수 로직과 스토리지 접근 분리 (순수부는 Node 단위 테스트):

- `buildSave(diffKey, player, world, bossDead, cleared) → obj` — 위 스키마 생성 (순수)
- `applySave(save, world, player) → { bossDead, cleared }` — world.nodes hp 복원(좌표 매칭, 모르는 키 무시), player.banked/upgrades 복원 (순수)
- `isValidSave(obj) → bool` — v/필드 검증 (순수)
- `storeSave(obj)` / `loadSave() → obj|null` / `clearSave()` — localStorage 래퍼, `typeof localStorage` 가드, JSON 파싱 실패 → null

## 4. 게임 통합

**GameScene**
- `constructor(canvas, diffKey, save = null)`: `this.diffKey` 보관. save 있으면 `applyDifficulty` **후** `applySave` → bossDead면 `this.boss.dead = true; this.relicDropped = true`, 추가로 `!cleared`면 유물 픽업을 보스 스폰 위치에 배치 (클리어 가능 상태 유지). cleared면 유물 없음 (포스트게임 자유 잠수)
- 은행 edge-trigger에서 `storeSave(buildSave(...))` — bank() 직후, onClear 분기보다 먼저
- onClear 발화 시에도 cleared=true로 저장

**타이틀 (main.js)**
- 세이브 존재 시: `CONTINUE` / `NEW GAME` 버튼 2개. 없으면 기존처럼 아무 데나 탭 → 난이도 선택
- CONTINUE → `loadSave()` → `GameScene(canvas, save.difficulty, save)` (난이도 선택 건너뜀)
- NEW GAME + 세이브 존재 → 같은 화면에서 `OVERWRITE SAVE? YES / NO` 확인 후 난이도 선택으로 (실수 방지). 실제 세이브 삭제는 새 게임의 **첫 은행 시점**에 덮어쓰기로 자연 처리 (명시적 clearSave는 확인 직후 1회)
- 사운드 토글 위치·동작 유지

**클리어 후 CONTINUE**: 보스 없는 맵에서 채집/업그레이드 계속 가능 (포스트게임). 클리어 화면 문구 유지

## 5. 범위 제외

다중 슬롯, 클라우드 동기화, 잠수 중 저장, 저장 파일 내보내기, 통계(플레이타임 등) 저장.

## 6. 검증

- 단위: buildSave/applySave 라운드트립(캔 노드 hp 복원, banked/upgrades 복원), isValidSave(버전 불일치·필드 누락 거부), 모르는 노드 좌표 무시, nodesHp가 기본값 노드를 포함하지 않는 것
- 플레이 체크: 채집→은행→새로고침→CONTINUE(잔액·캔 노드 유지, 거점 스폰) / 잠수 중 새로고침(소지분 손실 확인) / NEW GAME 덮어쓰기 확인 흐름 / 보스 처치 후 저장→CONTINUE(유물 재배치) / 클리어 후 CONTINUE(포스트게임) / 모바일 동작
- 기존 39개 테스트 회귀 유지
