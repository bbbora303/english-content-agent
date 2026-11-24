# 롤플레이 B형 마스터 템플릿 — 영어 문장이 2줄 이상으로 꺾일 때 한글 번역이 다음 줄과 겹치는 문제 — 작업 프롬프트

> ⚠️ **대체됨**: 이 문서의 반영(line-height 2.4)이 화자 표기 정렬 등에 부작용을 내서, 이후
> 마스터 팀이 절대좌표 배치 로직 자체를 제거하는 방향으로 재수정했습니다. 최신 요청은
> `docs/roleplay_b_overflow_wrap_and_line_placement_retry_master_template_prompt.md`를 참고하세요.

> ✅ **반영 확인됨(구버전 기록)**: 실제 `view01.js`/`view01.css` 수정본을 받아 검토 완료 — 제안했던 3가지
> 방향 중 1번(영어 line-height 확대)을 채택해 `.text-eng`의 `line-height`를 `1.2`→`2.4`로
> 늘렸고(마스크 상태 `.mask-chunk .text-eng`에도 동일 적용), 추가로 `placeTranslations()`에
> "한글 top이 다음 줄의 top을 넘지 않도록" 하는 clamp 안전장치까지 넣어주셨습니다. 저작 도구
> 캔버스([App.jsx](src/App.jsx))에도 동일한 line-height(2.4)와 clamp 로직을 반영해 Playwright로
> 겹침 없음을 재검증했습니다. 아래 내용은 요청 당시 기록으로 보존합니다.

> 이 문서는 **저작 도구(content-agent) 대화**에서, 앞서 반영해주신
> `docs/roleplay_b_kor_line_placement_master_template_prompt.md`(줄 단위 실측 배치)를 실제
> `view01.js`/`view01.css`로 검증하는 과정에서 새로 발견한 문제를 마스터 템플릿 대화로 넘기는
> 작업 지시문입니다. 이 문서를 그 대화에 그대로 붙여넣고, 실제 `view01.js`/`view01.css`(롤플레이
> B형) 파일을 함께 전달하면 됩니다.

## 배경 — 줄 단위 배치 요청 자체는 정확히 반영됨

`placeTranslations()` 함수가 `mergeRectsByVisualLine()` + 줄 단위 실측 분리로 정확히 구현되어
있음을 확인했습니다(요청한 그대로). 다만 그 실제 코드(아래 발췌)를 저작 도구 캔버스에 1:1로
포팅해서 검증하는 과정에서, **영어 문장이 2줄 이상으로 꺾이는 경우** 한글 번역이 다음 영어 줄과
겹치는 문제를 발견했습니다.

```js
// 실제 view01.js placeTranslations() 발췌
let remainder = korText;
lineRects.forEach((rect, li) => {
    const isLastRow = li === lineRects.length - 1;
    let text;
    if (isLastRow) {
        text = remainder;
        remainder = '';
    } else {
        const { firstLine, rest } = splitTextForRowWidth(remainder, rect.width, 'NanumGothicBold', 16, 1.0, 'keep-all');
        text = firstLine;
        remainder = rest;
    }
    const left = rect.left - contentRect.left;
    const top = (rect.top - contentRect.top) + rect.height + KOR_GAP; // KOR_GAP = 1
    // ... text-kor 요소에 절대배치
});
```

```css
/* 실제 view01.css 발췌 */
.role-play .text-eng {
    line-height: 1.2 !important;
}
.role-play .text-kor {
    font-size: 16px;
    line-height: 1.0 !important;
}
.role-play > .role-play-script .talk {
    min-height: 60px;
}
```

## 문제 재현 — 실측 좌표로 확인됨

`font-size:26px; line-height:1.2`이면 영어 한 줄의 높이는 약 31.2px입니다. 한글은 해당 줄의
`top + rect.height + 1px` 지점(즉 그 줄이 끝나는 지점 바로 1px 아래)에서 시작하는데, 한글 자체
높이(`16px × line-height 1.0` ≈ 16px)가 다음 영어 줄이 시작되기까지 남은 여백(1px)보다 훨씬 커서,
**문장이 2줄 이상으로 꺾이면 한글 번역이 항상 다음 영어 줄과 겹칩니다.**

저희 쪽에서 위 코드값을 그대로(수치 하나도 바꾸지 않고) 격리 환경에 재현해 스크린샷으로 확인한
실제 예시:

- 영어: `"Go straight for two blocks and turn left. It'll be on your right."` (2줄로 꺾임: 1줄
  "Go straight for two blocks and turn left. It'll be on", 2줄 "your right.")
- 한글: `"두 블록을 직진하고 도로에서 좌회전하세요. 오른쪽에 있어요."`
- 결과: 한글이 1줄과 2줄("your right.") 사이 공간에 다 들어가지 못하고 2줄과 겹쳐서 렌더링됨.

`.talk{min-height:60px}`도 이 경우엔 도움이 되지 않습니다 — 영어 문장 자체가 이미 2줄 ×
31.2px ≈ 62.4px로 60px를 초과하기 때문에, 최소 높이를 아무리 크게 잡아도 "겹침"이라는 시각적
결과 자체를 막지는 못합니다(단순히 최소 높이만 키우는 방식으로는 근본 해결이 안 됨).

## 요청 사항

문장이 여러 줄로 꺾일 때 한글 번역이 다음 영어 줄과 겹치지 않도록 조정해주세요. 저희가 생각하는
선택지(택1 또는 다른 방식 제안도 환영):

1. **영어 줄 간격(line-height)을 늘려 한글이 들어갈 여유 공간을 만든다** — 다만 이 경우 문장이
   1줄인 경우까지 포함해 전체적으로 줄 간격이 넓어져 보이는 부작용이 있을 수 있습니다.
2. **한글이 있는 줄에 한해서만, 그 줄의 실제 렌더링 높이(한글 높이 포함)를 다시 계산해 다음 줄이
   그만큼 밀려나도록 한다** — 시각적으로는 가장 자연스럽지만 구현이 더 복잡할 수 있습니다
   (Understand의 zipper 텍스트가 유사한 방식으로 한글 삽입 위치만큼 줄바꿈을 재조정하는 사례가
   있습니다).
3. **한글을 해당 문장 전체가 끝난 뒤(모든 영어 줄 다음)에 한 번에 배치하는 방식으로 되돌린다** —
   이번에 요청드렸던 "줄 단위 배치"보다 단순하지만, 애초에 이 요청을 드린 이유(A형과 동일하게
   문장이 꺾이는 지점에 맞춰 배치)와는 다시 멀어집니다.

정확한 수치나 방식은 마스터 템플릿의 디자인 의도에 맞게 판단해서 결정해주시고, **최종 반영된
계산식(줄 간격 값, top/left 오프셋 등)을 회신해주시면** 저작 도구 캔버스도 그 값에 맞춰 다시
조정하겠습니다.

## 참고 — 이번 저작 도구 쪽 변경 범위

- 이전 이관 문서(`docs/roleplay_b_kor_line_placement_master_template_prompt.md`) 반영분을 받아
  캔버스 측정값을 실제 `view01.js`(`placeTranslations()`)와 100% 동일한 수치로 맞췄습니다
  (top = rowBottom + 1px, left 보정 없음, 한글 16px/line-height 1.0, 영어 line-height 1.2,
  턴 행 `min-height:60px` 고정).
- 이번에 발견한 "2줄 이상 꺾일 때 겹침" 문제는 **캔버스 쪽 버그가 아니라 실제 코드값을 그대로
  재현한 결과**이므로, 캔버스만 따로 고치지 않고 이 문서로 먼저 확인을 요청드립니다. 회신을
  받으면 그 방식을 캔버스에도 동일하게 반영하겠습니다.

## 확인 후 처리

반영된 방식과 정확한 수치를 회신해주시면, 저작 도구(content-agent) 쪽 캔버스 미리보기 계산식을
그 값에 맞춰 다시 조정하겠습니다.
