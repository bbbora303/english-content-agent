# "유형 변경" 버튼 구현 — 새 대화 시작 프롬프트

> 이 문서는 **저작 도구(content-agent) 대화**를 새로 시작할 때 그대로 붙여넣기 위한 컨텍스트
> 요약입니다. 이전 대화에서 롤플레이 C형 상세 고도화(페이지 구조, 마스터 템플릿 반영, eg/스크롤
> 겹침 수정)까지 마무리했고, 마지막으로 남은 작업이 "유형 변경" 버튼입니다.

## 작업 배경

1단계 화면(`src/App.jsx`, "AI 자동 추천 분석 스펙" 패널)에서 AI가 판정한 콘텐츠 유형을
"👁 미리보기" 버튼으로 미리 볼 수 있는 기능은 이미 구현되어 있습니다. 그 옆에 아직 구현하지
않은 TODO 자리가 있습니다:

```jsx
// src/App.jsx 약 2022번째 줄
{/* TODO: 유형 변경 버튼 자리 — 유형 간 데이터 매핑 정의 후 추가 예정 */}
```

이제 A/B/C형의 데이터 구조가 전부 확정됐으니(아래 참고), 이 버튼을 실제로 구현해 주세요.
**목적**: AI가 유형을 잘못 판정했을 때(예: 실제로는 C형인데 A형으로 판정), 사용자가 2단계
편집 화면에 들어가기 전에 유형을 수동으로 정정할 수 있게 하는 것.

## 스코프 축소 — understand ↔ 롤플레이 간 변경은 지원 대상 아님

사용자 확인 결과, **`understand`와 롤플레이 계열(A/B/C) 사이에는 오판정이 실질적으로
일어나지 않는다고 판단**했습니다(말풍선 코믹 컷 vs 대사 스크립트 지면은 레이아웃이 워낙
달라서 AI가 헷갈릴 가능성이 낮음). 실제로 오판정이 발생하는 지점은 **롤플레이 A/B/C 세
유형 사이**(표 퀴즈 유무, 교체 표현 영역 유무처럼 판단 기준이 미묘한 경우)뿐입니다.

**따라서 이 버튼은 `understand`를 후보에 넣지 않고, `roleplay_a`/`roleplay_b`/`roleplay_c`
세 유형 사이에서만 전환할 수 있게 구현해 주세요.**
- `contentType`이 처음부터 `understand`로 판정된 경우: 이 버튼 자체를 노출하지 않거나
  비활성화하는 것을 권장합니다(굳이 롤플레이로 바꿀 상황이 없음).
- `contentType`이 롤플레이 계열(A/B/C) 중 하나로 판정된 경우: 나머지 두 롤플레이 유형만
  후보로 보여주면 됩니다.

이 전제 덕분에 아래 "유형별 데이터 구조" 표에서도 `understand` 행은 이 버튼 구현 범위에서는
사실상 무시해도 됩니다 — 참고용으로만 남겨둡니다.

## 핵심 전제 — 이 버튼은 "2단계 진입 전"에만 동작하면 됩니다

버튼이 있는 자리는 `startEditing()`(2단계 캔버스로 넘어가며 `pageData`를 최초 생성하는 함수)를
호출하기 **이전** 단계입니다. 즉:

- `startEditing()`은 이미 `contentType` 값에 따라 완전히 분기되어 각 유형에 맞는 초기
  `pageData`를 만듭니다(understand/roleplay_a/roleplay_b/roleplay_c 각각 별도 분기,
  `src/App.jsx` 내 `const startEditing = () => {...}` 참고).
- 따라서 "유형 변경" 버튼이 할 일은 기본적으로 **`contentType` state 값을 사용자가 고른
  값으로 바꿔치기**하는 것만으로 충분할 수 있습니다 — `startEditing()`이 이미 그 값을 보고
  알아서 올바른 구조로 조립해주기 때문입니다. 복잡한 "기존 데이터를 새 구조로 변환하는" 로직을
  꼭 새로 짤 필요는 없다는 뜻입니다(다만 아래 "추출 데이터 재사용 가능 여부"는 감안 필요).
- 즉 2단계 캔버스에 이미 들어간 뒤(사용자가 대사를 편집하기 시작한 뒤)까지 유형 변경을
  지원할 필요는 없다고 판단됩니다 — 스코프를 1단계로 한정하는 걸 추천하지만, 최종 판단은
  이 대화에서 확정해 주세요.

## 유형별 데이터 구조 요약 (참고용)

| contentType | pageData 형태 | 이 유형이 소비하는 추출 state |
|---|---|---|
| `understand` | 컷 배열, 각 컷 `{bubble, text:{type, eng}}` | `croppedViews` |
| `roleplay_a` | 단일 요소 배열 `[{dialogues:[{speaker,lines:[...]}], tableQuiz:{...}}]` | `extractedDialogues`, `extractedTableQuiz` |
| `roleplay_b` | 씬 배열, 각 씬 `{sceneId, rolePlayImage(Src), panelBtnImage(Src), roleA, roleB, dialogues:[{speaker,sentence,kor,audio_id}]}` (flat, 이미지 있음) | `extractedScenesB`(다중 씬) 또는 `extractedDialogues`(단일 폴백), `extractedTips` |
| `roleplay_c` | 페이지 배열, 각 페이지 `{pageId, dialogues:[{speaker,lines:[...]}]}` (표퀴즈·이미지 없음) | `extractedPagesC`(다중 갈래) 또는 `extractedDialogues`(단일 폴백) |

**중요한 발견**: `roleplay_a`와 `roleplay_c`는 대사 데이터 형태(`{speaker, lines:[...]}`)가
완전히 동일하고, 둘 다 `extractedDialogues`(단일 flat 추출 결과)를 그대로 재사용합니다. 즉
**A↔C 전환은 AI가 이미 추출해둔 대사 텍스트를 그대로 유지한 채 구조만 바뀝니다**(A는 그걸
1개 박스로, C는 페이지 1개+복제된 페이지 2개로 조립). 반면 `roleplay_b`나 `understand`로/에서
전환하는 경우는 추출 state 자체가 호환되지 않아서(이미지, 컷 좌표 등 완전히 다른 데이터가
필요), **사실상 그 유형의 기본값/더미 데이터로 새로 시작하는 것과 다르지 않습니다.**

## 결정이 필요한 것들 (이 새 대화에서 정할 것)

1. **UI 형태**: 드롭다운? 롤플레이 3개 유형 버튼(A/B/C)? "미리보기" 버튼 옆에 나란히 둘
   만한 공간이 넉넉하지 않으니 고려 필요. (understand는 후보에서 제외 — 위 "스코프 축소"
   참고)
2. **경고/확인 처리**: A↔C 전환은 데이터가 거의 안 날아가지만, B로/에서 전환하면 기존에
   추출된 내용이 사실상 초기화됩니다. 사용자에게 "이 유형으로 바꾸면 추출된 내용이
   초기화됩니다" 같은 확인을 띄울지 여부.
3. **판정된 유형과 다른 후보를 어떻게 보여줄지**: 예를 들어 롤플레이 3개 유형을 항상 다
   보여줄지, 아니면 AI가 판정 못한 나머지 두 유형만 후보로 보여줄지.
4. **표시 이름과의 연동**: `getDisplayTypeName(contentType, title)` 함수가 이미 있어서
   `contentType` 값 + `globalData.header.text`(제목)를 조합해 "Talk and Complete" /
   "Look and Talk - 2" 같은 이름을 보여줍니다. 유형 변경 시 이 표시 이름도 즉시 갱신되어야
   자연스럽습니다(별도 처리 불필요 — `getDisplayTypeName`이 이미 매 렌더마다 계산되므로
   `contentType`만 바뀌면 자동으로 따라옵니다).

## 참고해야 할 기존 관례

- 관리자 템플릿 등록 그리드에 이미 4개 유형(U/A/B/C)을 순회하는 패턴이 있습니다
  (`['understand', 'roleplay_a', 'roleplay_b', 'roleplay_c'].map(...)`) — 다만 이건
  템플릿 등록용이라 4종 전부 필요한 것이고, "유형 변경" 버튼은 위 스코프 축소에 따라
  `['roleplay_a', 'roleplay_b', 'roleplay_c']` 3종만 순회하면 됩니다.
- 색상 관례: understand=파랑, roleplay_a=보라, roleplay_b=teal, roleplay_c=fuchsia
  (이미 캔버스/관리자 화면 등 곳곳에서 이 색상으로 유형을 구분하고 있음).
- `startEditing()`을 호출하기 전에 `contentType`을 바꾸는 것 외에, `activeViewIdx`도
  0으로 리셋해야 할 수 있습니다(이전 유형에서 남은 인덱스가 새 유형의 배열 길이를
  벗어날 수 있음).

## 확인 완료된 것 (다시 검토 불필요)

- 롤플레이 C형 페이지 구조(표퀴즈 대신 화살표 분기 페이지) 실제 마스터 템플릿 반영 완료
- eg 배지/스크롤 겹침 마스터 템플릿 CSS 수정 완료 및 확인 완료
- A/C형 강조색 UI 중복 제거 완료
- 롤플레이 A형 실사용 검수, 배포 후 실사용 테스트 관련 사항 확인 완료
