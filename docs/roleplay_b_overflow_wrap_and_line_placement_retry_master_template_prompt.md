# 롤플레이 B형 마스터 템플릿 — (1) 단어 중간 줄바꿈 원인 확정 + 수정 요청, (2) 줄 단위 한글 배치 재요청 — 작업 프롬프트

> 이 문서는 여러 라운드에 걸친 수정·회귀를 정리해서 **한 번에** 요청하는 문서입니다. 이전 문서들
> (`roleplay_b_kor_line_placement_master_template_prompt.md`,
> `roleplay_b_kor_multiline_overlap_master_template_prompt.md`,
> `roleplay_b_alignment_and_translate_button_master_template_prompt.md`)은 이 문서로 대체됩니다.
> 아래 "지금까지의 경위" 섹션을 꼭 먼저 읽어주세요 — 같은 실수(사이드이펙트)가 반복되지 않도록
> 원인을 상세히 적었습니다.

## 지금까지의 경위 (왜 여러 번 왔다갔다 했는지)

1. **1차 요청**: "영어 문장이 2줄 이상 꺾이면, 매칭되는 한글이 그 줄들 사이사이에 맞춰 배치되어야
   한다"(A형과 동일한 방식)는 요청 → `placeTranslations()` 함수와 `.text-kor { position: absolute }`
   방식으로 반영됨. **이 반영 자체는 정확했습니다.**
2. **2차 요청**: 위 방식으로는 문장이 2줄 이상 꺾일 때 한글이 다음 영어 줄과 겹치는 문제 발견 →
   `.text-eng`의 `line-height`를 `1.2`→`2.4`로 키우는 방식으로 수정됨.
   **이 수정이 부작용을 냈습니다**: `.name`(화자 표기)의 `line-height`는 그대로 `1.4`로 남아있어서,
   화자 표기와 대사 텍스트의 세로 위치가 크게 어긋났습니다(원래는 1.2 vs 1.4로 ~5px 차이였는데
   2.4 vs 1.4로 차이가 26px 가까이 벌어짐). 또한 이 시점에 검증해보니 해석 버튼을 눌러도 한글이
   뜨지 않는 **별도의 기존 버그**(아래 3번 참고, 이번 라운드가 원인은 아니었음)도 함께 발견됨.
3. **3차 요청(방금 반영본)**: 위 부작용들을 고치기 위해, **`placeTranslations()`와 절대좌표 배치
   방식 자체를 완전히 제거**하고 `.text-kor`를 `position: static`으로 바꿔 `.sentence-group`
   (flex-column) 안에서 자연스럽게 흐르도록 되돌리는 방식으로 수정됨. 이걸로:
   - ✅ 화자 표기 정렬은 해소됨(`line-height`가 `1.2`로 복귀해 원래의 작은 오차로 돌아옴)
   - ✅ 해석 버튼 문제도 해소된 것으로 보임(아래 참고)
   - ❌ **하지만 1차 요청(줄 단위 배치) 자체가 통째로 사라졌습니다** — 지금은 문장이 몇 줄로
     꺾이든 한글이 항상 문장 전체가 끝난 뒤에만 붙습니다.

**이번 요청의 목적**: 3차 반영에서 확보한 두 가지(화자 정렬, 해석 버튼)를 유지하면서, 1차 요청의
"줄 단위 배치"만 다시 살려달라는 것입니다. 아래에 각 부분을 건드리지 않고 재작업하는 방법을
구체적으로 안내합니다.

---

## 요청 1 — 단어 중간 줄바꿈 원인 확정 및 수정 (신규 발견, 근거 명확함)

**증상**: 영어 대사가 화면 폭에 걸려 줄바꿈될 때, 단어 중간이 잘려서 다음 줄로 넘어감
(예: "during"이 "durin" / "g"로 쪼개짐). `.text-eng`에 `word-break: keep-all`이 이미 걸려있는데도
발생.

**원인**: `word-break`와 `overflow-wrap`(=`word-wrap`)은 서로 다른 속성입니다.
`word-break: keep-all`은 정상적으로 걸려 있지만, 파일 최상단의 다음 규칙 때문에 문제가
발생합니다.

```css
:where(:root) { ... overflow-wrap: break-word; ... }
```

`overflow-wrap: break-word`는 "한 단어가 그 줄에 남은 공간보다 길면 강제로 쪼개서라도 줄바꿈한다"는
별개의 규칙이라, `word-break: keep-all`과 무관하게 단어를 중간에서 끊습니다. `:where()` 선택자는
CSS 명시도가 항상 0인데, `.text-eng`나 그 조상 요소 어디에도 `overflow-wrap`을 재정의하는 규칙이
없어서, 이 명시도 0짜리 `:root` 값이 상속되어 그대로 적용되고 있습니다.

**요청**: `.role-play .text-eng`(필요하면 `.role-eng-text`에도)에 다음을 추가해주세요.

```css
.role-play .text-eng {
  overflow-wrap: normal !important; /* 또는 word-wrap: normal !important */
}
```

---

## 요청 2 — 줄 단위 한글 배치 재도입 (1차 요청 복구), 단 아래 3가지는 반드시 유지

문장이 2줄 이상으로 꺾일 때, 한글 번역이 1번째 줄 폭 안에 다 들어가면 1번째 줄 하단에, 못 들어가면
나머지가 2번째 줄 하단에 이어지는 방식(A형 `placeMultiLineTranslation()`과 동일한 원리)을 다시
구현해주세요. 이전에 이미 한 번 정확히 구현됐던 로직이니(`placeTranslations()`,
`mergeRectsByVisualLine()`), 그 코드를 그대로 복구하시되 아래 3가지를 함께 지켜주세요.

### 반드시 유지해야 할 것 ①: 화자 표기(`.name`)와 대사(`.text-eng`)의 line-height 동기화

`.text-eng`의 `line-height`를 얼마로 정하든(줄 사이에 한글이 들어갈 여유가 필요하므로 1.2보다는
커야 할 가능성이 높습니다), **`.name`의 `line-height`도 반드시 같은 값으로 맞춰주세요.**

```css
.role-play > .role-play-script .talk .role-content .role-eng-text,
.role-play > .role-play-script .talk .name {
    line-height: /* .text-eng와 동일한 값으로 */ !important;
}
```

지난 라운드에서 `.text-eng`만 `2.4`로 올리고 `.name`은 `1.4`로 남겨둬서 화자 표기가 대사보다
위쪽에 떠 보이는 문제가 있었습니다. 이번엔 두 값을 항상 같은 숫자로 유지해주세요.

### 반드시 유지해야 할 것 ②: 한글 span을 `.translation`(hidden 부모) 밖으로 옮기는 구조는 그대로 유지

가장 최근 반영본에서 다음과 같이 한글 span을 `.translation` 컨테이너 밖으로 꺼내
`.sentence-group`(또는 그에 준하는, `.text-eng`와 형제 관계인 곳)으로 옮기는 구조로 바뀌었습니다.

```js
if (korSpans[index]) {
    const korSpan = korSpans[index];
    korSpan.classList.add("text-kor", "hidden");
    korSpan.style.position = "";
    korSpan.style.top = "";
    korSpan.style.left = "";
    groupSpan.appendChild(engSpan);
    groupSpan.appendChild(korSpan);  // ← 이 부분
}
```

**이 구조는 그대로 유지해주세요.** `renderRolePlay()`가 만드는 `.translation` 컨테이너 자체에
`hidden` 클래스가 처음부터 붙어있는데(`korTextDiv.className = 'translation hidden'`), 전역 규칙
`.hidden, .hidden * { visibility: hidden !important }` 때문에 한글 span이 그 부모 안에 남아있으면
`.text-kor`의 `hidden` 클래스를 아무리 껐다 켜도 **영구히 안 보이게 고정됩니다** — 이게 "해석
버튼을 눌러도 한글이 안 뜨는" 버그의 정확한 원인이었습니다. 지금처럼 JS가 span을 옮겨서 이 부모의
`hidden`으로부터 완전히 벗어나게 하는 방식이 정답이니, 줄 단위 배치를 다시 넣을 때도 한글 span이
`.translation.hidden` 안에 남아있지 않도록 해주세요(단, `position: absolute`로 좌표를 다시 계산해
넣는 것 자체는 문제없습니다 — 위치 계산 방식과 이 "부모 탈출" 구조는 서로 다른 이슈입니다).

### 반드시 유지해야 할 것 ③: 요청 1(overflow-wrap 수정)과 함께 검증

`overflow-wrap` 수정으로 영어 줄바꿈 위치 자체가(단어 단위로 바뀌면서) 달라질 수 있습니다. 줄 단위
한글 배치 로직은 실제 렌더링된 줄(`getClientRects()`)을 실측하는 방식이라 자동으로 맞춰지겠지만,
**이번엔 두 수정을 함께 적용한 뒤 실제 화면으로 확인**해주시면 좋겠습니다.

---

## 확인 후 처리

수정된 `view01.js`/`view01.css`를 받으면, 이번에도 실제 코드로 다음을 하나씩 확인하겠습니다:
1. 단어 중간 줄바꿈이 사라졌는지
2. 문장이 2줄 이상 꺾일 때 한글이 줄 단위로 배치되는지 (겹침 없이)
3. 화자 표기와 대사 텍스트가 같은 높이에 정렬되어 있는지
4. 해석 버튼을 눌렀을 때 한글이 정상적으로 뜨는지

4가지를 한 번에 검증한 뒤, 저작 도구 캔버스([App.jsx](src/App.jsx))도 최종 확정된 값에 맞춰
반영하겠습니다.
