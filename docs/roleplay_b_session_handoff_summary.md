# 롤플레이 B형 — 새 대화 이관용 세션 요약 (한글 배치·줄바꿈·화자 정렬·해석 버튼 정리)

> 이 문서는 **마스터 템플릿 팀에게 보내는 문서가 아니라**, 이 저작 도구(content-agent) 작업을
> **새 Claude 대화로 이어받을 때 컨텍스트를 빠르게 전달하기 위한 세션 인수인계 문서**입니다.
> 새 대화 시작 시 이 문서를 붙여넣고 "이어서 진행해줘"라고 하면 됩니다.

## 지금까지 있었던 일 (요약)

롤플레이 B형에서 "영어 문장이 여러 줄로 꺾일 때 한글 번역이 그 줄 하단에 배치되어야 한다"(A형과
동일한 방식)는 요청을 시작으로, 여러 라운드에 걸쳐 마스터 템플릿(`view01.js`/`view01.css`,
저작 도구와는 별개 코드베이스)을 수정·검증했습니다.

1. **1차**: 줄 단위 절대배치(`placeTranslations()`) 최초 구현 — 정확했음.
2. **2차**: 줄 겹침 버그 발견 → `.text-eng` line-height만 `1.2→2.4`로 올려 수정 → **부작용**(화자
   표기 정렬 깨짐) 발생.
3. **3차**: 부작용을 고치려다 **줄 단위 배치 기능 자체를 통째로 제거**(flex-column 통짜 배치로
   회귀)하는 방식으로 "해결" → 사용자가 원점 회귀를 지적, 재요청.
4. **4차(최신, 검증 완료)**: 아래 "현재 확정 상태" 참고 — **모든 문제가 동시에 해결된 최종본**을
   실제 코드로 확인 완료.

## 현재 확정 상태 (마스터 템플릿 `view01.js`/`view01.css`, 검증 완료)

다음 4가지가 모두 실제 코드로 확인되었고, 서로 충돌 없이 공존합니다.

1. **단어 중간 줄바꿈 해결**: `.text-eng`/`.role-eng-text`에 `overflow-wrap: normal !important`
   추가(원인은 `:root`에서 상속되던 명시도 0짜리 `overflow-wrap: break-word`였음).
2. **줄 단위 한글 배치 복구**: `placeTranslations()` + `mergeRectsByVisualLine()` +
   `splitTextForRowWidth()` 전체 복구, `.text-kor { position: absolute }`, `KOR_GAP=1`, 다음 줄을
   넘지 않는 clamp 안전장치까지 포함.
3. **화자 표기 정렬 해결**: `.name`과 `.text-eng`/`.role-eng-text`의 `line-height`를 모두
   `2.4`로 동일하게 통일.
4. **해석 버튼 정상 동작**: 한글 span을 `renderRolePlay()`가 만드는 `.translation`(처음부터
   `hidden` 클래스가 붙어있고 전역 규칙 `.hidden, .hidden *{visibility:hidden!important}`으로
   자손을 영구히 가리는 컨테이너) 밖으로 JS가 즉시 옮겨서(`.role-content` 직속 자식으로), 이
   "영구 hidden 부모" 함정에서 완전히 벗어남. `placeTranslations()`의 `contentRect` 기준과
   `.role-content > .text-kor` 셀렉터도 이 구조에 맞춰 갱신됨.

**이 최신 버전이 최종 확정본입니다.** 이전 라운드들의 이관 문서 3개
(`roleplay_b_kor_line_placement_master_template_prompt.md`,
`roleplay_b_kor_multiline_overlap_master_template_prompt.md`,
`roleplay_b_alignment_and_translate_button_master_template_prompt.md`)와, 이걸 통합했던
`roleplay_b_overflow_wrap_and_line_placement_retry_master_template_prompt.md`는 모두 **완료**로
처리하면 됩니다 — 마스터 템플릿 쪽에 더 요청할 사항 없음.

## 다음에 해야 할 일 — 저작 도구 캔버스(App.jsx) 반영 (아직 안 함)

**중요**: 위 최종 확정본은 마스터 템플릿 파일(`view01.js`/`view01.css`)만 검증된 상태이고,
**저작 도구 캔버스(`src/App.jsx`)는 아직 이 최종 값에 맞춰 업데이트되지 않았습니다.** 새
대화에서 이어서 해야 할 작업은:

1. **B형 한글 배치 로직**(`App.jsx`의 `useLayoutEffect` 중 `contentType === 'roleplay_b'` 분기,
   `roleplayBKorFragments` state 관련)을 위 확정본과 동일하게 맞추기:
   - 영어 `line-height`를 `2.4`로 변경 (현재 캔버스가 어떤 값인지 먼저 확인 필요 — 과거
     세션에서 `2.4`로 맞췄다가 되돌렸을 수 있음)
   - 한글 top 오프셋 공식이 `rowBottom + KOR_GAP(1px)` + clamp(다음 줄 top을 넘지 않도록)인지
     확인
   - 화자 표기(`.name`에 해당하는 캔버스 요소)의 `line-height`도 `2.4`로 동기화되어 있는지 확인
2. **overflow-wrap**: 캔버스의 B형 영어 텍스트 컨테이너에 `overflowWrap: 'normal'`이 이미
   설정되어 있는지 확인(과거 세션에서 A/C형에는 이미 반영했었음 — B형도 되어 있는지 재확인).
3. 확인 후 Playwright 등으로 실제 화면 재검증까지 진행.

## 참고 — 프로젝트 배경

- 이 프로젝트는 "콘텐츠 양산 에이전트"(저작 도구, `src/App.jsx`)와 "마스터 템플릿"
  (`view01.js`/`view01.css`, 별도 코드베이스)이 분리되어 있고, 저작 도구는 사용자가 편집한
  내용을 마스터 템플릿과 병합해 ZIP으로 추출하는 구조입니다. 두 코드베이스는 서로 다른 대화에서
  다뤄지는 게 이 프로젝트의 관례입니다(CLAUDE.md 참고).
- 상세한 프로젝트 전체 배경·컨벤션·과거 결정사항은 프로젝트 루트의 `CLAUDE.md`에 정리되어
  있습니다. 새 대화를 시작하면 이 파일이 자동으로 컨텍스트에 포함됩니다.
- `docs/` 폴더에 이번 건 외에도 여러 마스터 템플릿 이관 문서가 쌓여 있으니, 필요하면 참고하되
  이번 B형 한글 배치/줄바꿈/정렬/해석버튼 건은 이 문서 하나로 충분합니다.
