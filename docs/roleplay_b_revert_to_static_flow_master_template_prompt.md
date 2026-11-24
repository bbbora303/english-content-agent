# 롤플레이 B형 마스터 템플릿 — 한글 배치 방식을 "실측 절대좌표(line-by-line)"에서 "flow 기반(position: static)"으로 되돌리는 요청

> 이 문서는 `docs/roleplay_b_dynamic_line_height_master_template_prompt.md`와 그 이전
> `docs/roleplay_b_overflow_wrap_and_line_placement_retry_master_template_prompt.md`를
> **대체**합니다. 그동안 여러 차례(1차~4차+동적 line-height) 수정을 거치며 문장별 line-height를
> 개별 조정하는 방식으로 발전시켜왔는데, 실사용 검수 결과 이 접근 자체가 잘못된 방향이었다는 게
> 확인됐습니다. 이번 요청은 **그 이전의 더 단순한 방식(원본 캡쳐 기준)으로 되돌리는 것**입니다.

## 배경 — 왜 되돌리는가

최근 반영본(`placeTranslations()` + `.text-kor { position: absolute }` + 문장별 동적
`line-height`)을 실제 콘텐츠로 테스트한 결과 두 가지 문제가 확인됐습니다:

1. **줄 간격이 원본보다 넓음**: 1줄짜리 대사도 원본 대비 영어-한글 사이 간격이 벌어져 보임
2. **겹침 버그**: 한 턴 안에 여러 문장이 섞여 있을 때(예: 따옴표로 감싼 강조 표현), 한 문장의
   한글이 실제 필요한 범위를 넘어 다른 문장·다른 턴의 영역까지 침범해 텍스트가 겹쳐 보임

반면 사용자가 제공한 **정답 기준(원본 캡쳐, 첨부 이미지 2장)**을 실제로 만들어냈던 예전 버전의
CSS를 확인해보니:

```css
.role-play .text-eng {
    font-size: inherit !important;
    line-height: 1.2 !important;
}

.role-play .text-kor {
    display: block !important;
    position: static !important;
    font-size: 16px;
    color: #06c;
    margin-top: 1px !important;
    line-height: 1.0 !important;
    white-space: normal !important;
    word-break: keep-all;
    text-align: left;
    visibility: visible;
    height: auto;
}
```

**`.text-kor`가 `position: static`**입니다 — JS가 좌표를 계산해서 꽂아넣는 방식이 아니라,
`.sentence-group { display: inline-flex; flex-direction: column }` 안에서 그 문장의 영어
바로 아래에 한글이 **자연스러운 문서 흐름(flow)**으로 붙는 방식입니다.

## 원본 캡쳐가 실제로 보여주는 렌더링 방식 (중요 — 오해하기 쉬운 부분)

"영어 문장 전체 밑에 한글 전체를 한 덩어리로 붙이는" 방식이 아닙니다. **문장(= 오디오 1개 =
`.text-eng` span 1개) 단위로 그 문장의 영어 바로 아래에 그 문장의 한글이 붙고, 이 (영어+한글)
쌍 자체가 하나의 단위(`.sentence-group`)로 다른 문장들과 나란히 흐르다가 안 들어가면 통째로
다음 줄로 넘어갑니다.** 예:

```
Are you talking about the one with the star pattern?
별 무늬가 있는 그거 말하는 거야?
It's cool, but "it costs an arm and a leg."
멋지긴 한데, 너무 비싸.
```

또는 짧은 문장 두 개가 한 줄에 같이 들어가는 경우:

```
Sure.  I said, "I'm feeling under the weather."
물론이지.    내가 말한 건 "몸이 좀 안 좋아."였어
```

`"Sure."`와 `"I said, ..."`는 서로 다른 `.text-eng` span(서로 다른 문장/오디오)인데 짧아서 한
줄에 나란히 배치됐고, 그 한글도 각자 자기 영어 바로 아래(각자의 x좌표)에 독립적으로 붙어있습니다.
이게 `.sentence-group`이 "문장 단위 flex-column"이기 때문에 자연스럽게 나오는 결과입니다.

## 요청 — 다음 두 가지를 되돌려주세요

### 1. CSS — line-height/position 값을 예전 버전 수준으로 복원

```css
.role-play .text-eng {
    /* line-height 개별(1.3/2.4) 조정 로직 제거, 고정값으로 복원 */
    line-height: 1.2 !important;
}

.role-play > .role-play-script .talk .role-content .role-eng-text,
.role-play > .role-play-script .talk .name {
    line-height: 1.2 !important; /* .text-eng와 동일하게 동기화 유지 */
}

.role-play .text-kor {
    display: block !important;
    position: static !important;   /* absolute → static으로 복원 */
    font-size: 16px;
    color: #06c;
    margin-top: 1px !important;
    line-height: 1.0 !important;
    white-space: normal !important;
    word-break: keep-all;
    text-align: left;
    visibility: visible;
    height: auto;
}
```

**단, `overflow-wrap: normal !important;`(단어 중간 줄바꿈 방지, 요청 1에서 반영됐던 것)는
그대로 유지해주세요** — 이건 이번 되돌리기와 무관하게 여전히 필요한 수정입니다.

### 2. JS — 실측 절대좌표 배치 로직 전부 제거

다음 요소들을 **전부 삭제**해주세요:
- `ii` 클래스의 `placeTranslations()` 메서드
- `ii` 클래스의 `adjustLineHeightForWrappedSentences()` 메서드
- `ii` 클래스의 `_translationsPlaced` 플래그
- 전역 함수 `mergeRectsByVisualLine()`, `splitTextForRowWidth()`
- `init()` 끝의 `this.adjustLineHeightForWrappedSentences(); this.placeTranslations();` 호출
- `kn.setPanel()`의 `this.RolePlays[this.currentIndex].adjustLineHeightForWrappedSentences(); this.RolePlays[this.currentIndex].placeTranslations();` 호출

한글 span을 `.translation`(hidden 부모) 밖으로 꺼내 `.role-content` 직계 자식으로 옮기는 구조
(`roleContentEl.appendChild(korSpans[index])`)는 **그대로 유지**해주세요 — 이건 해석 버튼이
정상 작동하게 하는 별개의 수정사항이라 이번 되돌리기와 무관합니다.

## 참고 — 이렇게 되돌리면 생기는 트레이드오프 (사용자 확인 완료)

문장 하나가 그 자체로 길어서 2줄 이상으로 꺾이는 경우, 한글은 A형 zipper처럼 줄 사이사이에
끼워지지 않고 **그 문장 전체 밑에 한 덩어리로 붙습니다.** 이건 버그가 아니라 원본 설계가 원래
그렇게 동작하는 것으로 확인됐습니다 — "줄 단위로 정교하게 끼워넣어야 한다"는 요구사항 자체가
불필요했던 것으로 결론 내렸습니다.

## 확인 요청

수정 후 다음을 확인해주세요:
1. 1줄짜리 대사만 있는 턴 → 줄 간격이 첨부 원본 캡쳐 수준으로 촘촘한지
2. 한 턴에 여러 문장이 섞여 있는 경우(따옴표 강조 포함) → 겹침 없이 문장 단위로 깨끗하게 배치되는지
3. 화자 표기(`.name`)와 대사 첫 줄이 정렬되는지
4. 뷰(패널) 전환 시에도 정상 동작하는지

## 참고 — 저작 도구(App.jsx) 쪽 반영 여부

이번 요청도 마스터 템플릿 JS/CSS 변경 사항이라 캔버스(App.jsx)는 이번엔 손대지 않습니다.
반영 확인 후 캔버스 동기화 여부를 별도 판단하겠습니다.
