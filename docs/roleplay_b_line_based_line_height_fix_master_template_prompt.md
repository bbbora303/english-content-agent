# 롤플레이 B형 마스터 템플릿 — "position: static 되돌리기" 롤백 + 실측 절대좌표 배치 방식에 남은 2가지 문제 수정 요청

> 이 문서는 `docs/roleplay_b_revert_to_static_flow_master_template_prompt.md`를 **롤백**하는
> 요청입니다. 그 문서의 요청대로 `position: static` 방식으로 되돌린 결과, 턴(turn)과 턴 사이가
> 서로 겹쳐 보이는 새로운 버그가 발생했습니다(스크린샷 확인 완료). 원인 규명·수정보다, **`position:
> static` 되돌리기 자체를 취소하고 그 이전 버전(실측 절대좌표 배치 방식)으로 돌아가서, 그 버전에
> 남아있던 문제 2가지만 수정하는 방향**으로 진행합니다.

## 1. 롤백 — `position: static` 되돌리기 취소

가장 최근에 반영해주신 버전(`.text-kor { position: static }`, `placeTranslations()` 등 삭제,
`.text-eng`/`.name` 고정 `line-height: 1.2`)을 **취소**하고, 그 이전 버전으로 되돌려주세요. 즉
아래 요소들을 **복원**합니다:

- `.text-kor { position: absolute; ... }` (static이 아니라 absolute)
- 전역 함수 `mergeRectsByVisualLine()`, `splitTextForRowWidth()`
- `ii` 클래스의 `placeTranslations()` 메서드, `_translationsPlaced` 플래그
- `ii` 클래스의 `adjustLineHeightForWrappedSentences()` 메서드(문장별 동적 line-height 측정)
- `init()` 끝과 `kn.setPanel()`에서 `adjustLineHeightForWrappedSentences()` → `placeTranslations()`
  순서로 호출하는 구조

즉 `docs/roleplay_b_dynamic_line_height_master_template_prompt.md`(문장별 동적 line-height,
이미 반영해주셨던 버전)의 상태로 되돌아가는 것입니다. 이 문서를 다시 참고하시면 정확한 코드를
확인하실 수 있습니다.

`overflow-wrap: normal !important`(단어 중간 줄바꿈 방지)는 이번 롤백과 무관하게 계속 유지해주세요.

## 2. 롤백된 버전에서, 아래 2가지 문제를 수정해주세요

### 문제 1 — 1줄짜리 대사도 원본보다 간격이 넓음

`BASE_LINE_HEIGHT`(현재 `1.3`)가 원본 캡쳐 기준보다 큽니다. `1.0~1.1` 사이로 낮춰주세요. 정확한
목표값은 실사용 화면을 보면서 원본 캡쳐와 비교해 미세 조정해주시면 됩니다.

### 문제 2 — 한 턴 안에 여러 문장이 섞여 있을 때(예: 따옴표로 감싼 강조 표현) 겹침

**원인**: `adjustLineHeightForWrappedSentences()`가 **문장(개별 `.text-eng` span) 단위**로
줄바꿈 여부를 측정합니다. 그런데 한 턴 안에 여러 문장이 같은 시각적 줄(row)을 공유하며 흐르는
구조라서, 어떤 문장은 "1줄"로 측정되고 바로 옆(같은 행)의 다른 문장은 "2줄"로 측정될 수 있습니다.
그 결과 같은 행을 공유하는 두 문장이 서로 다른 `line-height`(예: `1.1` vs `2.4`)를 갖게 되고,
브라우저의 줄 높이 계산이 오염되면서 한글 번역 좌표가 어긋나 다른 문장/턴의 영역과 겹칩니다.

**해결**: 판단 단위를 "문장(span)"이 아니라 "턴(talk)"으로 바꿔주세요. **한 턴 안에 속한 문장
중 하나라도 2줄 이상으로 꺾이면, 그 턴에 속한 모든 문장(그리고 `.name`)을 확대값으로 통일**
합니다. 1줄짜리 문장만 있는 턴은 그대로 좁은 기본값을 유지합니다.

```js
adjustLineHeightForWrappedSentences() {
    const EXPANDED_LINE_HEIGHT = '2.4';
    const BASE_LINE_HEIGHT = '1.1'; // 문제 1 반영: 1.3 → 1.0~1.1 사이로 조정

    this.rolePlayTalkArr.forEach(talk => {
        const nameEl = talk.querySelector('.name');
        const engSpans = Array.from(talk.querySelectorAll(".role-eng-text .text-eng"));

        // 1단계: 우선 전부 기본값으로 되돌려서, 이전 측정 결과의 영향 없이 순수하게 재측정한다
        engSpans.forEach(engSpan => {
            engSpan.style.lineHeight = BASE_LINE_HEIGHT;
        });

        // 2단계: [수정] "문장 단위"가 아니라 "턴 단위"로 판단한다.
        // 같은 턴 안의 문장들은 서로 같은 시각적 줄을 공유하며 흐르기 때문에, 문장마다
        // 따로 line-height를 다르게 주면 그 공유된 줄의 실제 렌더링 높이가 오염되어
        // 한글 배치가 다른 문장/턴 영역과 겹치는 문제가 있었다. 이제 이 턴에 속한 문장
        // 중 하나라도 2줄 이상으로 꺾이면, 턴 전체(화자 표기 포함)를 확대값으로 통일한다.
        const anyWrapped = engSpans.some(engSpan =>
            mergeRectsByVisualLine(engSpan.getClientRects()).length > 1
        );
        const finalHeight = anyWrapped ? EXPANDED_LINE_HEIGHT : BASE_LINE_HEIGHT;

        engSpans.forEach(engSpan => {
            engSpan.style.lineHeight = finalHeight;
        });
        if (nameEl) {
            nameEl.style.lineHeight = finalHeight;
        }
    });
}
```

`.role-play .text-eng`와 `.role-play > .role-play-script .talk .role-content .role-eng-text,
.role-play > .role-play-script .talk .name`의 CSS 기본값(`line-height`)도 `BASE_LINE_HEIGHT`와
같은 값(`1.1` 등, 문제 1에서 정한 값)으로 맞춰주세요. 어차피 JS가 인라인 스타일로 덮어쓰지만,
JS 실행 전 순간의 기본값도 일관되게 유지하기 위함입니다.

## 확인 요청

1. 1줄짜리 대사만 있는 턴 → 줄 간격이 원본 캡쳐 수준으로 촘촘한지
2. 한 턴에 여러 문장이 섞여 있는 경우(따옴표 강조 포함) → 겹침 없이 깨끗하게 배치되는지
   (이전에 겹쳐 보였던 "It's cool, but "it costs an arm and a leg."" 턴으로 재확인 부탁드립니다)
3. 화자 표기(`.name`)와 그 턴의 대사가 정렬되는지
4. 뷰(패널) 전환 시에도 정상 동작하는지

## 참고 — 저작 도구(App.jsx) 쪽 반영 여부

이번 요청도 마스터 템플릿(`view01.js`/`view01.css`) 쪽 변경 사항이라 App.jsx 캔버스는 이번엔
손대지 않습니다. 반영 확인 후 캔버스 동기화 여부를 별도 판단하겠습니다.
