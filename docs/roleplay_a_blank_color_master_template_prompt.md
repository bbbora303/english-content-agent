# 롤플레이 A형 마스터 템플릿 — 빈칸(hasBlank) 강조색을 데이터 기반으로 바꿔달라는 요청

> 이 문서는 **저작 도구(content-agent) 대화**에서 발견/수정한 내용을, 실제 마스터 템플릿
> (`view01.js`/`view01.html`, 롤플레이 A형)에 반영하기 위해 **마스터 템플릿 대화**로 넘기는
> 작업 지시문입니다. 이 문서를 그 대화에 그대로 붙여넣고, 롤플레이 A형을 렌더링하는 실제
> `view01.html`(스크립트 포함)과 `view01.js`/`view01.css`를 함께 전달하면 됩니다.

## 배경 — 발견된 버그와 원인

저작 도구 사용자가 실사용 중 "'빈칸(오디오 묵음) 지정' 체크박스를 켜도 콘텐츠 구동 시 처음부터
빈칸이 아니라 일반 텍스트로 보인다"는 버그를 제보했습니다.

원인을 실제 `view01.html`에서 확인했습니다 — `buildRolePlay()` 함수가 `hasBlank`인 줄의 `eng`
텍스트에서 `[대괄호]` 구간을 정규식(`/\[(.*?)\]/g`)으로 찾아, 두 가지 모드로 자동 변환합니다:

```js
// index === 0 (빈칸 모드, 콘텐츠 최초 진입 상태)
finalEng = line.eng.replace(/\[(.*?)\]/g, function(match, p1) {
  return "<span class='underLine black line-" + lineCounter + "' style='color:transparent;'>" + p1 + "</span>";
});

// index === 1 (정답/예시 모드, 상단 btn-eg 토글 후)
finalEng = line.eng.replace(/\[(.*?)\]/g, function(match, p1) {
  return "<span class='underLine emp col-0' style='border-bottom-color:transparent !important;'>" + p1 + "</span>";
});
```

즉 **`[대괄호]` 문자열 자체가 빈칸 지정의 유일한 트리거**이고, 정답 모드에서 그 구간을
`emp col-0`(빨강 고정)으로 강조합니다.

그런데 저작 도구가 이전에(2-28 작업) "강조 표현 UX 개선"을 하면서, `[대괄호]`를 자동 변환하던
로직을 없애고 사용자가 텍스트를 선택 → 색상 버튼을 누르면 `<span class='emp col-N'>...</span>`
HTML을 텍스트에 **직접** 끼워 넣는 방식으로 바꿨습니다. 이 변경이 빈칸 지정 대상 텍스트에도
그대로 적용되면서, `eng` 필드에 더 이상 `[대괄호]`가 남지 않게 되었고 — 마스터 템플릿의 정규식이
아무것도 찾지 못해 빈칸 변환이 전혀 일어나지 않는 회귀가 발생했습니다.

**저작 도구 쪽 수정 완료**: `[대괄호]` 자동 삽입 방식을 복원했습니다(사용자가 여전히 raw
`[ ]`를 직접 타이핑할 필요는 없고, 텍스트 선택 후 "빈칸 지정" 버튼을 누르면 자동으로 `[ ]`가
씌워집니다). 이 문서는 그 다음 단계 요청입니다.

## 이번 요청 — 빈칸 강조색을 col-0 고정에서 데이터 기반으로

사용자가 추가로 요청한 것: 정답 모드에서 빈칸 구간에 적용되는 강조색이 지금은 `col-0`(빨강)
하나로 고정되어 있는데, 이걸 **줄(line)마다 빨강/파랑/분홍 3색 중 선택**할 수 있게 해달라는
것입니다.

저작 도구가 이제 각 줄의 export 데이터에 새 필드 `blankColor`(정수, 0/1/2, 없으면 0으로 간주)를
함께 내려보내도록 수정했습니다:

```js
// contentData.rolePlay.dialogues[].lines[] 예시
{
  hasBlank: true,
  audio: "L1_012_CommB_eg_02",
  eng: "I enjoy [playing basketball].",
  kor: "나는 농구하는 것을 좋아해.",
  muteTargets: [0],
  blankColor: 1   // 👈 신규 필드: 0=빨강, 1=파랑, 2=분홍 (없으면 0으로 취급)
}
```

**요청드리는 수정**: `buildRolePlay()`의 정답 모드 변환 부분에서 하드코딩된 `col-0`을
`line.blankColor`(없으면 0)를 읽어 `col-${blankColor}`로 바꿔주세요.

```js
// 기존
finalEng = line.eng.replace(/\[(.*?)\]/g, function(match, p1) {
  return "<span class='underLine emp col-0' style='border-bottom-color:transparent !important;'>" + p1 + "</span>";
});

// 요청하는 형태 (예시 — 실제 코드 스타일에 맞춰 조정해주세요)
var blankColorClass = "col-" + (typeof line.blankColor === "number" ? line.blankColor : 0);
finalEng = line.eng.replace(/\[(.*?)\]/g, function(match, p1) {
  return "<span class='underLine emp " + blankColorClass + "' style='border-bottom-color:transparent !important;'>" + p1 + "</span>";
});
```

**빈칸 모드(index 0)는 그대로 두시면 됩니다** — 어차피 `color:transparent`로 안 보이게 만드는
것뿐이라 색상 구분이 의미가 없습니다.

## 확인해주셔야 하는 것

1. `view01.css`에 `.emp.col-0`, `.emp.col-1`, `.emp.col-2`가 이미 정의되어 있는지 — 이전
   대화(빈칸과 무관한 일반 강조 표현 작업, `docs/roleplay_a_emp_color_master_template_prompt.md`)에서
   이미 확인되어 있을 겁니다: `col-0=#b42c13`(빨강), `col-1=#018f9e`(파랑), `col-2=#e0629d`(분홍).
   이미 있다면 그대로 재사용하면 되고, 색상 값이 다르면 알려주세요(저희 쪽 색상 팔레트를 맞추겠습니다).
2. `line.blankColor` 필드가 없는 **기존 콘텐츠**(이미 만들어진 `data.js`)도 그대로 정상 동작해야
   합니다 — `blankColor`가 `undefined`일 때는 지금처럼 `col-0`(빨강)으로 처리되면 됩니다(하위 호환).
3. 빈칸 모드(index 0)에서 `[대괄호]` 안에 이미 다른 HTML(예: `<br />`처럼 줄바꿈 태그)이 섞여
   있는 경우가 실제 콘텐츠에 있는데(`data.js` 예시의 `"How often do you [play] <br />[basketball]?"`),
   이 부분은 이번 수정과 무관하게 기존과 동일하게 동작해야 합니다 — 혹시 수정 과정에서 이 케이스가
   깨지지 않는지만 확인 부탁드립니다.

## 참고 — 이번 저작 도구 쪽 변경 범위

- App.jsx의 hasBlank 편집 UI에 "위에서 선택한 부분 [ ]로 감싸기" 버튼과 강조색 3종 선택 버튼을
  추가했습니다. 사용자는 여전히 raw `[ ]`나 `<span>` HTML을 직접 타이핑할 필요가 없습니다.
- 일반 강조 표현(빈칸이 아닌 단순 강조, `docs/roleplay_a_emp_color_master_template_prompt.md`에서
  다뤘던 기능)은 이번 변경과 무관하게 그대로 `<span class='emp col-N'>` 직접 삽입 방식을 유지합니다
  — `[대괄호]`는 오직 "빈칸(hasBlank) 지정" 전용이고, 그 외 일반 강조는 여전히 emp span 직접
  삽입 방식입니다. 두 기능을 혼용(대괄호 안에 emp span을 또 넣는 것)하지 않도록 저작 도구
  UI에서 안내하고 있습니다.
