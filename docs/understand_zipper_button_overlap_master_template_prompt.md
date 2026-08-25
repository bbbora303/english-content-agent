# Understand 유형 — zipper 말풍선 [해석] 버튼 겹침 버그 수정 요청

> 이 문서는 **저작 도구(content-agent) 대화**에서 발견하고 재현·수정한 버그를, 동일한 원본 로직을
> 가진 **마스터 템플릿(view01.js — Understand용) 대화**에도 반영할 수 있는지 확인하기 위해 넘기는
> 작업 지시문입니다. CLAUDE.md 5-5(저작 도구와 마스터 템플릿은 서로 다른 코드베이스)에 따라 관심사를
> 분리했습니다. 이 문서를 그 대화에 그대로 붙여넣고, 실제 `view01.js`(Understand용) 파일을 함께
> 전달하면 됩니다.

## 배경

Understand 유형의 zipper 텍스트(문장들이 자연스럽게 이어지다가 필요한 지점에서 줄바꿈되고, 그 줄바꿈
위치에 맞춰 한글 해석이 삽입되는 방식) 말풍선에서, 문장이 짧아 영어 줄 자체는 짧게 끝나는데 그 아래
붙는 한글 해석이 상대적으로 길면, 한글 텍스트가 말풍선 하단의 [해석] 버튼과 겹치는 현상이 실제
병합 화면에서 발견됐습니다.

저작 도구(App.jsx) 캔버스 미리보기에도 동일한 로직(`view01.js`의 `placeZipperKorean()`을 그대로
포팅한 것)이 있어서 재현해봤더니 실제로 같은 문제가 있었고, 원인을 찾아 저작 도구 쪽은 수정
완료했습니다. **마스터 템플릿의 원본 로직도 구조가 완전히 동일해서, 같은 버그가 실제 서비스
화면에도 있을 가능성이 높습니다.**

## 원인 (저작 도구에서 재현하며 확인한 내용)

`placeZipperKorean()`(또는 그에 대응하는 함수)은 아래와 같은 구조로 되어 있을 것입니다 (App.jsx에
포팅된 버전 기준, 변수명은 원본과 다를 수 있습니다):

```js
const placeZipperKorean = () => {
    if (!flowWrap.isConnected) return;
    const scale = ...;
    const flowRect = flowWrap.getBoundingClientRect();
    ...
    let maxKorBottom = 0;

    flowWrap.querySelectorAll(':scope > .zline-sentence').forEach(sentenceEl => {
        // 문장별로 줄바꿈 지점을 실측해 한글 조각(korDiv)을 절대배치
        fragments.forEach((frag, i) => {
            const korDiv = korDivs[i];
            ...
            const korHeightLogical = korDiv.getBoundingClientRect().height / scale;
            maxKorBottom = Math.max(maxKorBottom, offsetTop + korHeightLogical);
        });
    });

    // ⚠️ 문제의 조건 분기
    if (maxKorBottom > 0) {
        const currentHeightLogical = flowRect.height / scale;
        if (maxKorBottom > currentHeightLogical) {
            flowWrap.style.minHeight = `${maxKorBottom}px`;
        }
    }
};

placeZipperKorean();
if (document.fonts && document.fonts.status !== 'loaded') {
    document.fonts.ready.then(() => {
        requestAnimationFrame(placeZipperKorean);
    });
}
```

**문제는 이 함수가 두 번 호출된다는 점입니다** — 최초 1회, 그리고 폰트 로딩이 끝난 뒤 재측정을 위해
1회 더. 그런데 두 번째 호출 시점에는 **첫 번째 호출에서 이미 `flowWrap.style.minHeight`를 늘려놓은
상태**이기 때문에, 두 번째 호출이 `flowRect.height`(= `flowWrap.getBoundingClientRect().height`)를
다시 잴 때는 **이미 늘어난 높이**를 "원래 있던 콘텐츠 높이"인 것처럼 읽어버립니다. 그 결과
`maxKorBottom > currentHeightLogical` 조건이 (이미 늘어나 있어서) `false`가 되어, **`minHeight`를
다시 0(또는 `auto`)으로 되돌려버리는 자기참조(self-referential) 버그**가 발생합니다. 즉 첫 번째
호출에서 만든 보정이 두 번째 호출에서 무효화되는 구조입니다.

저작 도구에서 콘솔 로그를 찍어 직접 확인한 실제 수치입니다 (재현용 참고):
```
1차 호출: { maxKorBottom: 126.78, currentHeightLogical: 118.78, minHeight: 136.78(적용됨) }
2차 호출: { maxKorBottom: 126.78, currentHeightLogical: 136.78(1차의 결과가 반영된 값), minHeight: 0(취소됨) }
```

## 수정 방법 (저작 도구에서 실제로 적용해 검증한 방식)

**조건 분기 자체를 제거하고, 항상 `minHeight`를 적용**하도록 바꾸면 해결됩니다:

```js
// 수정 후
if (maxKorBottom > 0) {
    flowWrap.style.minHeight = `${maxKorBottom}px`; // 여유값을 조금 더할 수도 있음(예: +10px)
}
```

CSS의 `min-height`는 실제 콘텐츠가 이미 그보다 크면 아무 효과가 없는 속성이라(둘 중 더 큰 값이
적용됨), "필요할 때만" 조건부로 적용할 이유가 애초에 없습니다 — 조건 분기를 없애도 부작용 없이
항상 안전합니다. 이렇게 하면 두 번째 호출에서 `flowRect.height`가 이미 커져 있어도 `minHeight`를
다시 그 값으로 설정할 뿐이라 자기참조 문제가 생기지 않습니다.

## 확인 후 처리

- `view01.js`(또는 Understand의 다른 view0X.js 전부, 로직이 공유된다면)에서 이 조건 분기를
  찾아 제거해 주세요.
- 짧은 영어 문장 + 상대적으로 긴 한글 번역이 섞인 zipper 말풍선(예: "I'm worried about my dog."
  / "저는 우리 강아지가 걱정돼요." + "She's sick." / "강아지가 아파요.")으로 실제 병합 화면에서
  [해석] 버튼과 한글 텍스트가 겹치지 않는지 확인해 주세요.
- 저작 도구(App.jsx) 쪽은 이미 동일한 방식으로 수정·검증 완료된 상태라 추가 조치가 필요 없습니다.
