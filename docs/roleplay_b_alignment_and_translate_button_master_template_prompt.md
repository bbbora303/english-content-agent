# 롤플레이 B형 마스터 템플릿 — 화자 표기 높이 불일치 + 해석 버튼 미동작 — 작업 프롬프트

> ⚠️ **대체됨**: 마스터 팀이 이 두 문제를 절대좌표 배치 로직 자체를 제거하는 방식으로 해결했고,
> 그 결과 줄 단위 한글 배치 기능이 사라졌습니다. 최신 요청(줄 단위 배치 재도입 + 이번엔 이 두
> 문제를 유지하는 방법 포함)은
> `docs/roleplay_b_overflow_wrap_and_line_placement_retry_master_template_prompt.md`를 참고하세요.

> 이 문서는 **저작 도구(content-agent) 대화**에서, 앞서 반영해주신 줄 겹침 수정
> (`docs/roleplay_b_kor_multiline_overlap_master_template_prompt.md`) 이후 실제 로컬 병합
> 결과를 검수하는 과정에서 발견된 2가지 문제를 마스터 템플릿 대화로 넘기는 작업 지시문입니다.
> 이 문서를 그 대화에 그대로 붙여넣고, 실제 `view01.js`/`view01.css`(롤플레이 B형) 파일을
> 함께 전달하면 됩니다.

## 문제 1 — 화자 표기(A:/B:)와 대사 텍스트의 세로 위치가 어긋남 (이번 겹침 수정의 부작용)

이전에 "화자 표기와 그 화자의 대사가 같은 높이에 위치해야 한다"고 확정했던 정렬이, 이번 줄 겹침
수정으로 깨졌습니다.

**원인**: 줄 겹침 수정으로 `.role-play .text-eng`의 `line-height`가 `1.2` → `2.4`
(26px 기준 31.2px → 62.4px)로 커졌는데, 화자 표기 `.name`의 `line-height`는 그대로
`1.4`(36.4px)로 남아 있습니다.

```css
/* 화자 표기(.name)와 대사 컨테이너(.role-eng-text)는 여기서 같은 line-height(1.4)를 받지만 */
.role-play > .role-play-script .talk .role-content .role-eng-text,
.role-play > .role-play-script .talk .name {
    height: auto !important;
    min-height: 30px;
    line-height: 1.4 !important;
    padding: 2px 0;
}

/* 실제 텍스트를 담는 .text-eng(위 role-eng-text의 자식)는 이후 이 값으로 덮어써진다 */
.role-play .text-eng {
    ...
    line-height: 2.4 !important;  /* ← 겹침 수정으로 여기만 커짐 */
}
```

`.name`은 36.4px 줄 높이 그대로인데 실제 대사 텍스트(`.text-eng`)는 62.4px 줄 높이 안에서
렌더링되다 보니, 화자 표기 글자가 대사 글자보다 위쪽에 떠 보이게 됩니다(이전엔 31.2px vs 36.4px로
차이가 작아 거의 안 보였으나, 지금은 차이가 커져 눈에 띕니다).

**요청**: `.name`의 `line-height`를 `.text-eng`의 `2.4`(또는 최종 확정하실 값)에 맞춰 동기화해서,
화자 표기와 첫 줄 대사가 다시 같은 기준선에 오도록 조정해주세요.

## 문제 2 — 해석(번역) 버튼을 눌러도 한글 번역이 뜨지 않음

**원인**: `renderRolePlay()`가 한글 번역 컨테이너를 만들 때, 자식 span뿐 아니라 **바깥 컨테이너
자체에도 `hidden` 클래스를 영구히** 붙입니다.

```js
const korTextDiv = document.createElement('div');
korTextDiv.className = 'translation hidden';   // ← 컨테이너 자체가 처음부터 hidden
```

그런데 CSS 최상단에 전역 유틸리티 규칙이 있습니다.

```css
.hidden, .hidden * {
  visibility: hidden !important
}
```

`.translation`(부모)이 `hidden` 클래스를 갖고 있는 한, `!important` 규칙에 의해 그 **자손인
`.text-kor`는 무엇을 해도(자기 자신의 `hidden` 클래스를 지워도) 영구히 안 보이게 고정**됩니다.

해석 버튼의 클릭 핸들러는 자식 `.text-kor`의 `hidden`만 토글할 뿐, 부모 `.translation`의
`hidden`은 한 번도 제거하지 않습니다.

```js
this.btnTranslateEl.addEventListener("click", () => {
    ...
    this.rolePlayScript.querySelectorAll(".text-kor").forEach(el => el.classList.remove("hidden"));
    // ↑ 자식만 토글 — 부모(.translation)의 hidden은 그대로 남아있어 전역 규칙에 계속 가려짐
});
```

**요청**: 다음 중 하나로 정리해주세요.
1. `renderRolePlay()`에서 `korTextDiv.className = 'translation hidden'`의 `hidden`을 제거하고,
   표시/숨김은 오직 각 `.text-kor` 자식의 `hidden` 토글로만 제어한다(권장 — 기존 토글 로직을
   그대로 살릴 수 있음).
2. 또는 해석 버튼 클릭 핸들러가 `.translation` 컨테이너 자신의 `hidden`도 함께 토글하도록
   수정한다.

## 참고 — 저작 도구(캔버스) 쪽 조치 여부

두 문제 모두 실제 마스터 템플릿 코드(`view01.js`/`view01.css`)에서 발생하는 문제이고, 저작 도구
캔버스(App.jsx)는 이 두 버그와 무관하게 이미 올바르게 동작합니다(화자 표기·대사는 line-height
불일치 문제 자체가 없는 방식으로 구현되어 있고, 해석 버튼도 저작 도구에는 별도로 구현되어 있지
않습니다 — 캔버스는 항상 한글이 보이는 미리보기 방식). **캔버스 쪽 추가 수정은 필요 없습니다.**

## 확인 후 처리

수정된 `view01.js`/`view01.css`를 받으면, 이번에도 실제 코드를 직접 확인해 반영 여부를
검증하겠습니다.
