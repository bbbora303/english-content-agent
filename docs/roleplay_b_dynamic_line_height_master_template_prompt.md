# 롤플레이 B형 마스터 템플릿 — 문장별 동적 line-height 적용 요청 (1줄 대사 간격 과다 문제 해소)

> 이 문서는 4차 최종본(`docs/roleplay_b_overflow_wrap_and_line_placement_retry_master_template_prompt.md`,
> 검증 완료)에서 **남은 부작용 1가지**를 마저 해소해달라는 후속 요청입니다.
> 4차 최종본 자체를 되돌리거나 다시 손대는 게 아니라, 그 위에 **한 가지 로직만 추가**하면 됩니다.

## 배경 — 지금 상태와 남은 문제

4차 최종본에서 `.text-eng`(영어 대사)와 `.name`(화자 표기)의 `line-height`를 **둘 다 2.4로 통일**해서,
문장이 2줄 이상으로 꺾일 때 그 줄 사이사이에 한글 번역이 들어갈 공간을 확보했습니다. 이 자체는
정확한 해결책이었고 의도대로 동작합니다.

**남은 문제**: `line-height: 2.4`가 **문장 길이와 무관하게 모든 대사에 일괄 적용**되다 보니, 1줄로
끝나는 짧은 대사까지 불필요하게 줄 간격이 넓어져, 화면 전체가 헐렁하고 여백이 많아 보입니다.
(실사용 스크린샷에서 확인됨 — 짧은 대사 4턴짜리 대화인데도 줄 간격이 과도하게 벌어져 보임)

**중요**: 이 요청은 "2줄 이상 꺾이는 문장의 넓은 간격"을 줄여달라는 게 아닙니다 — 그건 한글이
실제로 들어갈 공간이 필요해서 그런 것이라 불가피하고, 지금처럼 유지되어야 합니다. **요청 대상은
정확히 "1줄로 끝나는 문장까지 덩달아 넓어지는 것"** 하나입니다.

---

## 요청 — 문장별로 실제 줄바꿈 여부를 먼저 측정하고, 필요한 문장에만 넓은 line-height를 준다

### 1. CSS — 기본값을 좁게 변경

```css
.role-play .text-eng {
    ...
    line-height: 1.3 !important; /* 기본값: 좁게. 2줄 이상 꺾이는 문장만 JS가 개별적으로 확대함 */
}

.role-play > .role-play-script .talk .role-content .role-eng-text,
.role-play > .role-play-script .talk .name {
    ...
    line-height: 1.3 !important; /* .text-eng 기본값과 동일하게. .name은 항상 1번째 줄 기준선만 맞추면 되므로 굳이 커질 필요 없음 */
}
```

### 2. JS — `placeTranslations()` 호출 전에, 실제 줄바꿈 여부를 먼저 측정해서 필요한 문장에만 line-height를 키운다

`ii` 클래스 안에 새 메서드를 추가하고, `placeTranslations()`를 호출하는 두 곳(`init()` 끝,
`kn.setPanel()`)에서 **이 메서드를 먼저 호출한 뒤** `placeTranslations()`를 호출하도록 순서를
바꿔주세요.

```js
// [신규] 문장별로 실제 줄바꿈 여부를 먼저 측정해서, 2줄 이상 꺾이는 문장에만
// line-height를 확대 적용한다. 1줄로 끝나는 문장은 기본값(좁은 간격)을 그대로 둔다.
// 주의: line-height를 바꾸면 줄바꿈 위치 자체가 달라질 수 있으므로, 이 작업이
// placeTranslations()보다 반드시 먼저 실행되어야 하고, 그 안의 실측(getClientRects())은
// 이 작업이 끝난 "이후" 상태를 기준으로 이루어져야 한다.
adjustLineHeightForWrappedSentences() {
    const EXPANDED_LINE_HEIGHT = '2.4';
    const BASE_LINE_HEIGHT = '1.3';

    this.rolePlayTalkArr.forEach(talk => {
        const engSpans = Array.from(talk.querySelectorAll(".role-eng-text .text-eng"));
        engSpans.forEach(engSpan => {
            // 우선 기본값으로 되돌려서(재측정 시 이전 상태의 영향을 받지 않도록) 순수하게 다시 잰다
            engSpan.style.lineHeight = BASE_LINE_HEIGHT;
        });
        engSpans.forEach(engSpan => {
            const lineCount = mergeRectsByVisualLine(engSpan.getClientRects()).length;
            if (lineCount > 1) {
                engSpan.style.lineHeight = EXPANDED_LINE_HEIGHT;
            }
            // lineCount === 1이면 BASE_LINE_HEIGHT를 그대로 둔다(위에서 이미 세팅됨)
        });
    });
}
```

### 3. 호출 순서 변경

`init()` 끝부분:
```js
if (!this.rolePlayEl.classList.contains("remove")) {
    this.adjustLineHeightForWrappedSentences(); // ← 먼저
    this.placeTranslations();                    // ← 그다음
}
```

`kn.setPanel()`:
```js
if (this.RolePlays[this.currentIndex]) {
    this.RolePlays[this.currentIndex].adjustLineHeightForWrappedSentences(); // ← 먼저
    this.RolePlays[this.currentIndex].placeTranslations();                    // ← 그다음
}
```

---

## 확인해주실 것

1. 1줄짜리 대사만 있는 콘텐츠 → 줄 간격이 촘촘하게 나오는지 (스크린샷 문제 해소 확인)
2. 2줄 이상 꺾이는 대사 → 여전히 한글이 줄 사이에 정확히 끼워지고 겹치지 않는지 (기존 4차 동작 유지 확인)
3. 한 턴 안에 1줄짜리 문장과 2줄짜리 문장이 섞여 있을 때 → 화자 표기(`.name`)가 그 턴의 첫 줄과 정렬이 맞는지
4. 뷰(패널) 전환 시에도 위 내용이 깨지지 않는지

## 참고 — 저작 도구(App.jsx) 쪽 반영 여부

이번 요청은 마스터 템플릿(`view01.js`/`view01.css`)의 JS 로직 변경이 필요한 사항이라, 캔버스
미리보기(App.jsx)는 이번 요청과 무관하게 그대로 둡니다. 반영 확인이 끝나면 캔버스도 동일한
로직으로 맞출지 별도로 판단하겠습니다.
