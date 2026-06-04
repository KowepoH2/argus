---
name: argus-briefing-update
description: Argus 수소·암모니아 신규 브리핑 HTML 작성 및 아카이브 업데이트 후 GitHub 업로드
---

Google Drive의 OCR 폴더(영문 원문)에서 **현재 아카이브의 가장 최신 날짜 이후** 파일만 대상으로 브리핑 HTML을 작성하고, 아카이브 대시보드를 업데이트한다.
번역본 폴더는 "번역본" 버튼 링크 연결에만 사용하고, 데이터 추출은 반드시 OCR 원문(영문) 문서를 기준으로 한다.

---

### 환경 정보

**워크스페이스 경로:** `/sessions/focused-trusting-volta/mnt/Argus 수소정보지 정리/`

**Google Drive 폴더 ID:**
- OCR 원문(영문) 폴더: `1R3F2gqKA4m4lKi7dA-E-f_vtXjqDLDug` ← 데이터 추출 기준
- 번역본(한글) 폴더: `1Gw18D61S2DFNG1MVnvvBTIf9Yr7hLjFH` ← 버튼 링크 연결용
- 원문 PDF 폴더: `1oMyl4hTVN8chOw5MPLQKYWdMonStRLxo`

**GitHub:**
- 저장소: `KowepoH2/argus`
- 포털 URL: `https://KowepoH2.github.io/argus/`
- Push 스크립트: 워크스페이스의 `자동_깃헙_push.py`

---

### 실행 단계

#### STEP 1 — 아카이브 최신 날짜 파악
`/sessions/focused-trusting-volta/mnt/Argus 수소정보지 정리/dashboard.html`을 읽어
`const briefs = [...]` 배열에서 **가장 첫 번째 항목의 날짜**를 최신 날짜로 확인한다.
(배열은 최신순 정렬이므로 index 0이 가장 최신)

예) 현재 최신: `2026-04-09` → **이 날짜보다 이후(strictly after)인 파일만** 처리 대상

#### STEP 2 — 번역본 폴더에서 신규 문서 탐색

`search_files` MCP를 **1회만** 호출한다. `list_recent_files`는 사용하지 않는다.

```
query: parentId = '1Gw18D61S2DFNG1MVnvvBTIf9Yr7hLjFH'
       and modifiedTime > 'STEP1_DATE T00:00:00Z'
excludeContentSnippets: true
pageSize: 20
```

`STEP1_DATE`는 STEP 1에서 확인한 날짜(예: `2026-05-29T00:00:00Z`).

결과에서 **파일명 앞 8자리(YYYYMMDD) > STEP1_DATE** 인 파일만 처리 대상으로 확정한다.
(modifiedTime 필터는 사전 필터일 뿐이므로, 제목 날짜로 최종 판단)

파일 유형:
- `fmbamm` = 암모니아 일간지
- `hydrogen` = 수소 주간지
- `lcabsupp` = 보충 자료 → 같은 날짜 `fmbamm` 브리핑에 함께 반영
- 같은 날짜에 `fmbamm` + `hydrogen` 모두 있으면 탭 분리형 브리핑(20260408.html 참조)으로 작성
- 여러 날짜가 있으면 날짜 오름차순(오래된 것부터)으로 처리
- 결과가 20건이면 nextPageToken으로 추가 페이지 확인

처리 대상이 없으면 "가장 최신 브리핑({최신날짜}) 이후 새로운 자료가 없습니다."라고 보고하고 종료.

#### STEP 3 — OCR 원문 내용 읽기 (데이터 추출 기준)
`google_drive_fetch`로 OCR 원문(영문) 문서를 읽어 다음 정보를 정확하게 추출한다.
**영문 숫자/수치는 원문 그대로 사용하고, 한국어 설명은 직접 번역/해석하여 작성한다.**

추출 항목:
- **날짜**: 파일명 앞 8자리 `YYYYMMDD` → `YYYY-MM-DD` 변환, 요일 계산
- **Argus 호수**: 예) `Issue 26-69` → `제26-69호`
- **암모니아 현물가 ($/t)** — 수치 정확도 최우선:
  - Mideast fob → 중동 fob
  - East Asia (excl Taiwan) cfr → 동아시아 cfr
  - NW Europe cfr → NW유럽 cfr
  - US Gulf cfr → 미국걸프 cfr
  - JKLAB cfr Ulsan → JKLAB cfr 울산
  - 전일 대비 변동: `+N`, `nc`, `-N`
- **핵심 이슈**: 주요 사건/동향 5건 내외
  - 유형 분류: 공급차질·가격급등·지정학 → `hot`, 시장·수급 → `''`, 정책·전략 → `pol`
  - 각 이슈의 Argus 원문 핵심 문장 번역 (인용구)
  - 핵심 포인트 불릿 (수치 포함)
  - 한 줄 시사점
- **주요 동향**: 기타 단신 뉴스 항목
- **모니터링 포인트**: 향후 주시해야 할 사항

수소 문서(`hydrogen`)의 경우:
- 수소 생산단가, 정책 동향, 프로젝트 현황 등 추출
- 암모니아 가격 섹션 없으면 가격 카드 생략

#### STEP 4 — 번역본 폴더에서 링크 확인
`google_drive_search`로 번역본 폴더에서 같은 날짜 파일을 찾아 `web_view_link`를 확보한다:
```
'1Gw18D61S2DFNG1MVnvvBTIf9Yr7hLjFH' in parents and name contains 'YYYYMMDD'
```
없으면 번역본 버튼은 번역본 폴더 링크(`https://drive.google.com/drive/folders/1Gw18D61S2DFNG1MVnvvBTIf9Yr7hLjFH`)로 대체한다.

#### STEP 5 — 브리핑 HTML 작성
`briefs/20260407.html`(암모니아 단독) 또는 `briefs/20260408.html`(암모니아+수소 탭)을 Read 툴로 읽어 동일한 구조로 새 브리핑 HTML을 작성한다.

파일명: `briefs/YYYYMMDD.html`

**반드시 포함할 요소:**
- `AUTH.requireAuth()` 인증
- 뒤로가기 버튼 → `../dashboard.html`
- 헤더: 날짜(요일), Argus 호수, 서부발전 수소사업실
- 원문 PDF 버튼 → `https://drive.google.com/drive/folders/1oMyl4hTVN8chOw5MPLQKYWdMonStRLxo`
- 번역본 버튼 → STEP 4에서 확보한 구글 문서 링크
- 가격 카드 그리드 (중동/동아시아/NW유럽/미국걸프 4개)
- JKLAB 행
- 핵심 이슈 카드 (유형별 색상: hot=주황 issue-hot, ''=파랑 issue-mid, pol=보라 issue-pol)
  - 각 카드 내: 배지+제목 / 원문 번역 인용 / 핵심 포인트 불릿 / 시사점 화살표
- 주요 동향 요약 리스트 (점 색상: 긴급=dot-red, 시장=dot-blue, 기타=dot-gray)
- 모니터링 포인트 박스 (키워드-내용 2열)
- 이전/다음 내비 버튼 (날짜 기준 정렬)
- 푸터 (Argus 호수, 날짜, 아카이브 링크)

**이전 브리핑 연결:** 기존 마지막 브리핑(예: 20260409.html)의 "다음 브리핑" 버튼을 새 날짜로 업데이트한다.

#### STEP 6 — dashboard.html 업데이트
`const briefs = [...]` 배열 맨 앞에 새 항목 추가:

```js
{ date:'YYYY-MM-DD', label:'M월 D일', day:'요일한글', hot:true/false,
  tags:'키워드1 · 키워드2 · 키워드3',
  ocrUrl:'https://docs.google.com/document/d/{번역본_doc_id}/edit',
  prices:{me:NNN, ea:NNN, nwe:NNN, usg:NNN, jklab:NNN.NN},
  chg:{me:'+N'/'-N'/'nc', ea:..., nwe:..., usg:...},
  issues:[
    {type:'hot'/'/'pol', text:'이슈 한 줄 요약 (한국어)'},
    ...최대 5건
  ],
  monitor:'모니터링 포인트 핵심 요약' },
```

- `hot: true` = 긴급이슈(hot) 1건 이상일 때
- `tags` = 핵심 이슈에서 키워드 3개 (예: `'공급차질 · 호르무즈 · 가격급등'`)
- `ocrUrl` = 번역본 구글 문서 직접 링크

#### STEP 7 — 카톡 공유용 텍스트 요약 생성
HTML 브리핑 작성 후, 카톡에 공유하기 위한 **가독성 높은 텍스트 서식**을 생성한다.

다음 형식을 따른다:

```
🔴 ARGUS 암모니아 브리핑 | YYYY.MM.DD (Issue XX-XX)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 현물가격 ($/t)

중동 fob         NNN  (보합/상승/하락)
동아시아 cfr     NNN  (보합/상승/하락)
NW유럽 cfr       NNN  (보합/상승/하락)
미국 걸프 cfr    NNN  (보합/상승/하락)

JKLAB cfr울산    NNN.NN  (전주 대비 +/-/nc)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 핵심 이슈

✦ [이슈 제목 1]
→ 핵심 내용 1
→ 핵심 내용 2
→ 핵심 내용 3

✦ [이슈 제목 2]
→ 핵심 내용 1
→ 핵심 내용 2

(최대 5건, 각 이슈 3-4줄 이내)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 주요 동향 (5-6건)

• 동향 항목 1 (구체적 내용 1줄)
• 동향 항목 2 (구체적 내용 1줄)
• 동향 항목 3
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ 모니터링 포인트

□ 포인트 1
□ 포인트 2
□ 포인트 3
□ 포인트 4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏢 서부발전 수소사업실 | Argus Media
```

**작성 규칙:**
- 기호(✦, •, □ 등)로 섹션 명확하게 구분
- 화살표(→)로 계층화하여 가독성 높임
- 각 항목은 간결하게, 1-2줄 이내
- 숫자/수치는 정확하게 유지
- 카톡에 복사-붙여넣기 시 줄바꿈이 자동 인식되도록 포맷

이 텍스트는 stdout으로 출력하고, 마지막 "결과 보고" 단계에서 사용자에게 **카톡 공유용 요약**으로 제시한다.

#### STEP 8 — 결과 보고
사용자에게 다음을 보고한다:

1. **신규 작성된 파일 목록** (HTML)
2. **카톡 공유용 텍스트 요약** (위의 형식)
3. GitHub 업로드 안내:
   > "PC에서 `깃헙_push.bat`를 실행하면 GitHub에 반영됩니다."

---

### 주의사항
- **처리 기준일 이전 파일은 절대 처리하지 않는다** (이미 브리핑이 존재하는 날짜 포함)
- **가격 수치는 OCR 원문의 숫자를 그대로 사용** (번역본 수치 사용 금지)
- 전문 용어는 원문 기준 번역: fob→fob, cfr→cfr, MGC→MGC, t/yr→t/yr 등 유지
- 회사명은 원문 영문 표기 유지 (Sabic, Maaden, Woodside 등)
- dashboard.html의 CSS/JS 구조 절대 변경 금지
- 모든 파일 UTF-8 저장
- 요일: Monday=월, Tuesday=화, Wednesday=수, Thursday=목, Friday=금
- 카톡 텍스트는 **파일로 저장하지 말고 결과 보고 시에만 제시**