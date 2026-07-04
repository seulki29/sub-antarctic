# Sub-Antarctic 1단계 확장 — 설계

날짜: 2026-07-04
상태: 승인됨
기반: 프로토타입 v0 (master, 테스트 30개)

## 1. 목적

프로토타입의 루프를 심화한다: **광물 다종화 · 업그레이드 5종 · 난이도 · 시작 메뉴 · BGM**.
저장/불러오기는 이번 범위에서 제외(다음 사이클). 사운드 ON/OFF 설정만 localStorage에 저장.

## 2. 광물 다종화 (단일 화폐 가치제)

맵 문자는 'C' 그대로. **노드의 깊이(타일 행)가 광물 종류를 결정**:

| 광물 | 깊이(행) | 개당 가치 | 색 |
|---|---|---|---|
| 크리스탈 | < 18 | 1 | 시안 (기존) |
| 진주 | 18–39 | 3 | 백진주/분홍 하이라이트 |
| 심해석 | ≥ 40 | 5 | 주황-적색, 발광 강함 |

- 노드 파괴 시 해당 광물 3개 산란(기존 CRYSTALS_PER_NODE 유지), 픽업 1개 = 가치만큼 `carried`에 합산
- `carried`/`banked`는 가치 합계 숫자 (기존 필드 그대로, 의미만 확장)
- 스프라이트: 노드·픽업 각각 광물별 3종 (sprites.js에 pearl/abyss 변형 베이크, 색만 다름)
- 라이팅: 노드 발광색을 광물색으로
- `MINERALS` 상수: `{ crystal:{value:1,color}, pearl:{value:3,color}, abyss:{value:5,color} }` + `mineralForRow(tileY)` 순수 함수 (테스트 대상)

## 3. 업그레이드 5종

기존 2종 + 신규 3종. 각 1회 구매, 은행 잔액으로:

| key | 이름 | 비용 | 효과 |
|---|---|---|---|
| tank | O2 TANK | 8 | O2 최대 ×1.5 (기존) |
| damage | HARPOON | 12 | 작살 데미지 ×1.5 (기존) |
| lamp | LAMP | 10 | 램프 reach ×1.4, spread ×1.15 |
| fins | FINS | 14 | 최고속도 ×1.2, 부스트 쿨다운 ×0.6 |
| suit | DIVE SUIT | 16 | 피격 무적 1.5→2.5s, 넉백 ×0.5 |

- 효과 적용 지점: lamp → game.js lampCone/addCone 계산 시 배율, fins → player 물리 상수 배율, suit → damage() 내부
- 총 비용 60. 보통 난이도 광물 총가치 ≈ 100+ (전량 수집 불필요, 선택적 성장)
- 메뉴 레이아웃: 버튼 5+CLOSE, 높이 24px·간격 6px, 패널 세로 확장 (y 32~250)

## 4. 난이도

`DIFFICULTY = { easy:{hp:5,nodes:16,vents:8}, normal:{hp:3,nodes:12,vents:5}, hard:{hp:2,nodes:9,vents:3} }`

- **맵은 최대치(easy) 기준으로 배치**: C×16, V×8 (현 12/5에서 증설)
- `applyDifficulty(world, diff)` (world.js, 순수 함수 — 테스트 대상):
  - 노드/분출구를 x좌표 정렬 후 **균등 간격 선택**으로 목표 개수까지 축소 (공간 분포 유지)
  - **분출구는 존(상층 <18행 / 중층 18–39 / 심층 ≥40)별 최소 1개 보장** 후 나머지 균등 선택
- 하트: `Player` 생성자에 `hpMax` 파라미터. HUD 하트 렌더는 `player.hpMax` 기준 (5개까지 배치 공간 확인)
- O2·적·보스는 난이도와 무관 (이번 범위)

## 5. 시작 플로우

```
타이틀 ──[클릭/탭]──▶ 난이도 선택 (EASY / NORMAL / HARD) ──▶ 게임
   └─ SOUND ON/OFF 토글 (좌하단, localStorage 'snd' 저장)
```

- 난이도 선택 씬: 세로 3버튼 (터치 히트박스 ≥24px), 각 버튼에 하트/광물/공기 수치 표기 (3×5 폰트, 영문+숫자)
- **시작 시 상점 자동 오픈 제거**: GameScene 생성 시 `atBase=true`로 초기화 → 거점을 떠났다 복귀할 때만 메뉴
- "새로 시작" = 클리어/타이틀 복귀 후 다시 난이도 선택 (별도 버튼 불필요, 저장 없으므로)
- 저장/불러오기: **범위 외** (메뉴에 자리만 남기지 않음 — YAGNI)

## 6. BGM (프로시저럴 WebAudio)

- `audio.js` 확장: `startBgm()`, `stopBgm()`, `setBgmMode('calm'|'boss')`, `setMuted(bool)`
- **calm**: 저음 드론(55Hz 부근 디튠 사인 2개 + 로우패스) + 7~12초 간격 마이너 펜타토닉 패드 스웰(트라이앵글, 어택/릴리즈 ~4s) — 게인 낮게 (드론 0.04, 패드 0.03)
- **boss**: 드론 반음 상승 + 스웰 간격 3~5초 + 불협 음정 추가 — 게인 크로스페이드 전환(~2s)
- game.js: `bossActive` 변화 시 `setBgmMode` 호출. 타이틀/클리어 씬은 calm 유지
- **마스터 뮤트**: 모든 오디오가 단일 master GainNode 경유. `setMuted`는 sfx+bgm 일괄. 설정은 localStorage `'snd'`(on/off)로 저장, 부팅 시 로드
- 오디오 그래프는 initAudio() 이후에만 생성 (모바일 제스처 정책 준수)

## 7. 파일 영향

- `constants.js`: DIFFICULTY, MINERALS, UPGRADES 3종 추가, PLAYER.HP_MAX → 기본값 역할만
- `world.js`: `mineralForRow`, `applyDifficulty` 추가
- `map.js`: C 16개·V 8개로 증설 (도달성 테스트 유지)
- `player.js`: hpMax 파라미터, suit/fins 효과, pickupCrystal → 가치 합산(기존 시그니처 유지)
- `sprites.js`: pearl/abyss 노드·픽업 베이크
- `game.js`: 난이도 주입, 광물 종류 결정·드랍, lamp 배율, atBase 초기 true, BGM 모드 전환
- `hud.js`: 하트 hpMax 기준, 메뉴 5종 레이아웃
- `audio.js`: BGM 엔진, 마스터 뮤트
- `main.js`: 난이도 선택 씬, 사운드 토글, localStorage
- 테스트: mineralForRow, applyDifficulty(개수·존 보장), 업그레이드 5종 비용/효과, 맵 카운트 갱신 (기존 30개 유지+확장)

## 8. 검증

- 단위: 위 신규 테스트 + 기존 회귀 (아레나 봉쇄 등)
- 플레이 체크: 난이도 3종 시작·하트 수·노드/분출구 체감 차이, 진주/심해석 획득·가치 합산, 업그레이드 5종 효과 체감, BGM 전환(보스 진입/이탈), 사운드 토글 즉시 반영+재부팅 유지, 시작 시 상점 안 뜸
- 배포: master 푸시 → Vercel 자동 배포 확인
