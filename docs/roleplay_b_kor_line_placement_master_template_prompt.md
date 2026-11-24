# 롤플레이 B형 마스터 템플릿 — 한글 번역 배치를 A형과 동일한 "줄 단위 실측 배치" 방식으로 변경 요청 — 작업 프롬프트

> ✅ **반영 확인됨**: 실제 `view01.js`(`placeTranslations()`)/`view01.css`를 받아 검토 완료 —
> 줄 단위 실측 분리·배치 요청이 정확히 반영되어 있습니다. 다만 검증 과정에서 **영어 문장이 2줄
> 이상으로 꺾일 때 한글이 다음 줄과 겹치는 문제**를 새로 발견해, 후속 이관 문서
> `docs/roleplay_b_kor_multiline_overlap_master_template_prompt.md`로 별도 요청 중입니다.
> 아래 내용은 최초 요청 당시 기록으로 보존합니다.

> 이 문서는 **저작 도구(content-agent) 대화**에서 롤플레이 B형 캔버스 미리보기를 고도화한 뒤, 그
> 결과가 실제 마스터 템플릿에서도 동일하게 동작해야 하는 변경을 마스터 템플릿 대화로 넘기는 작업
> 지시문입니다. 이 문서를 그 대화에 그대로 붙여넣고, 실제 `view01.js`/`view01.css`(롤플레이 B형)
> 파일을 함께 전달하면 됩니다.

## 배경 — 이전에 확인했던 내용이 뒤집힘

이전에(별도 이관 작업, `docs/roleplay_b_master_template_prompt.md`) 실제 `view01.css`를 확인해
**B형은 A형과 달리 `getClientRects()` 실측 절대배치를 쓰지 않고, `.sentence-group { display:
inline-flex; flex-direction: column }` 안에 영어(`.text-eng`) 다음 한글(`.text-kor`)을 순서대로
넣는 순수 flex-column 구조**라는 결론을 내렸고, 저작 도구도 그에 맞춰 구현해뒀습니다. 이 결론
자체는 **당시 확인한 코드 기준으로는 정확했습니다.**

이후 사용자가 실사용 중, A형처럼 **"영어 문장이 컨테이너 폭에 걸려 여러 줄로 꺾일 때, 그 문장에
매칭되는 한글 번역은 영어 문장 1번째 줄 하단에 위치해야 한다"**(한글 전체가 1번째 줄 폭 안에
들어가면 1번째 줄 바로 아래에 붙고, 2번째 줄은 그 아래에 이어짐 — 번역이 문장 전체가 끝난 뒤에야
붙는 게 아니라, 문장이 꺾이는 지점에 맞춰 실측 배치되는 방식)는 동작을 **B형에도 동일하게
적용해달라**고 요청했습니다. 이는 기존 flex-column 방식(번역이 항상 영어 전체 블록 밑에 통짜로
붙음, 문장이 몇 줄로 꺾이든 무관)과는 다른 동작입니다.

## 요청 사항

**B형(`view01.js`의 `renderRolePlay()`가 대사를 그리는 로직)의 한글 번역 배치 방식을, 다음과 같이
A형과 동일한 방식으로 변경해주세요.**

참고로 A형(`view01.js`, A형 전용 파일 — B형과 파일명은 같지만 내용이 다름)에는 실제로
`placeMultiLineTranslation()`이라는 함수가 이미 존재하며(2-29에서 확인됨), `getClientRects()`로
영어 문장이 몇 줄로 꺾이는지 실측해서 각 줄 하단에 한글을 절대배치합니다. **B형도 이 A형 로직과
동일한 원리로 구현해주시면 됩니다** — 가능하다면 A형의 실제 함수를 그대로(또는 최소 변경으로)
재사용하는 방향을 권장드립니다.

### 동작 요약
- 영어 문장이 한 줄에 다 들어가면: 한글 번역은 그 줄 바로 아래에 배치.
- 영어 문장이 2줄 이상으로 꺾이면: 한글 번역이 1번째 줄의 렌더링 폭 안에 다 들어가면 1번째 줄
  바로 아래에 배치되고, 2번째 줄은 그 아래(한글 다음)에 이어짐. 한글 번역 자체가 길어서 1번째
  줄 폭에 다 안 들어가면, 남는 부분은 2번째 줄 폭에 맞춰 다시 나눠 2번째 줄 바로 아래에 배치.
- 즉 "영어 줄 → (그 줄에 맞는) 한글 조각 → 다음 영어 줄 → (그 줄에 맞는) 한글 조각 → …" 순으로
  줄 단위로 인터리빙됩니다.

### 저작 도구 캔버스에 반영해둔 참고 구현 (그대로 포팅 가능)

```js
// mergeRectsByVisualLine: 강조색(<span class='emp col-N'>) 때문에 같은 시각적 줄이 여러 rect로
// 쪼개져 돌아오는 브라우저 동작을 보정 — top이 같은 rect들을 하나로 합쳐 실제 줄 단위로 되돌린다.
function mergeRectsByVisualLine(rects) {
  const list = Array.from(rects);
  if (list.length === 0) return [];
  const lines = [];
  list.forEach(r => {
    const existing = lines.find(l => Math.abs(l.top - r.top) < r.height / 2);
    if (existing) {
      existing.left = Math.min(existing.left, r.left);
      existing.right = Math.max(existing.right, r.right);
      existing.top = Math.min(existing.top, r.top);
      existing.bottom = Math.max(existing.bottom, r.bottom);
    } else {
      lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
  });
  lines.sort((a, b) => a.top - b.top);
  return lines.map(l => ({ left: l.left, top: l.top, width: l.right - l.left, height: l.bottom - l.top }));
}

// splitTextForRowWidth: 한글 텍스트를 지정한 폭(widthPx) 안에 들어가는 "첫 줄"과 "나머지"로 실측
// 분리 (숨겨진 probe 요소에 실제로 렌더링해보고 Range.getClientRects()로 줄바꿈 지점을 찾는다).
function splitTextForRowWidth(text, widthPx, fontFamily, fontSizePx, lineHeight, wordBreak) {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.width = `${widthPx}px`;
  probe.style.whiteSpace = 'normal';
  probe.style.fontFamily = fontFamily;
  probe.style.fontSize = `${fontSizePx}px`;
  probe.style.lineHeight = String(lineHeight);
  probe.style.wordBreak = wordBreak;
  probe.textContent = text;
  document.body.appendChild(probe);

  let result = { firstLine: text, rest: '' };
  const textNode = probe.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    range.selectNodeContents(probe);
    const rects = range.getClientRects();
    if (rects.length > 1) {
      const firstTop = rects[0].top;
      const threshold = rects[0].height / 2;
      let splitIndex = -1;
      for (let i = 1; i <= text.length; i++) {
        const r = document.createRange();
        r.setStart(textNode, i - 1);
        r.setEnd(textNode, i);
        const cr = r.getClientRects()[0];
        if (cr && cr.top > firstTop + threshold) { splitIndex = i - 1; break; }
      }
      if (splitIndex > 0) {
        const firstLine = text.slice(0, splitIndex).replace(/\s+$/, '');
        const rest = text.slice(splitIndex).replace(/^\s+/, '');
        if (firstLine) result = { firstLine, rest };
      }
    }
  }
  probe.remove();
  return result;
}

// 대사 1개(turn)에 대한 배치 — 영어 span(.text-eng 등)의 getClientRects()를 실측해 줄마다 순회.
let remainder = kor;
for (let i = 0; i < rects.length && remainder; i++) {
  const rect = rects[i];
  const availWidth = rect.width; // 그 줄 자체의 렌더링 폭
  const isLastRow = (i === rects.length - 1);
  let text;
  if (isLastRow) {
    text = remainder; remainder = '';
  } else {
    const { firstLine, rest } = splitTextForRowWidth(remainder, availWidth, 'sans-serif', 16, 1.0, 'keep-all');
    text = firstLine; remainder = rest;
  }
  // text를 이 줄(rect) 바로 아래에 절대배치
}
```

**중요**: 위 좌표 보정값(`top` 오프셋 등)은 저희 캔버스 미리보기용 근사치이며, B형의 실제 CSS
(줄 간격, 여백 등)를 기준으로 정확한 값을 확정해서 회신해주시면, 저희 쪽 캔버스 계산식도 그 값에
맞춰 다시 조정하겠습니다.

## 요청드리는 작업

1. `view01.js`의 `renderRolePlay()` 안 한글 번역 렌더링을, 위 방식(줄 단위 실측 배치)으로 변경해
   주세요. 가능하면 A형의 `placeMultiLineTranslation()`을 그대로 재사용/포팅하는 방향을
   권장드립니다.
2. 기존 `.sentence-group`(flex-column) CSS 구조는 더 이상 필요 없어질 수 있습니다 — 다른 곳에서
   재사용하지 않는다면 정리 여부는 판단해서 진행해주세요.
3. emp 강조색(`<span class='emp col-N'>`)이 포함된 문장에서도(영어 줄 안에 강조 구간이 있어도)
   줄바꿈 지점 실측이 깨지지 않는지 확인 부탁드립니다 — 저작 도구 쪽에서는 `mergeRectsByVisualLine`
   (위 코드 참고)으로 이 문제를 보정했습니다.
4. 변경 후 **정확한 좌표 보정값(top/left 오프셋)과, 혹시 임계값이나 여백이 달라졌다면 그 값**을
   회신해주세요 — 저희 캔버스 미리보기를 그 값에 맞춰 재조정하겠습니다.
5. 기존 B형 콘텐츠(문장이 짧아서 원래도 1줄에 다 들어가던 경우)는 화면상 변화가 없어야 합니다 —
   회귀가 없는지 확인 부탁드립니다.

## 참고 — 이번 저작 도구 쪽 변경 범위

- B형 캔버스 미리보기(`rpb-script`)를 A/C형과 동일한 `getClientRects()` 실측 기반 절대배치로
  전환했습니다(`.sentence-group`/`.text-eng`/`.text-kor` flex-column 구조 삭제).
- 이 변경은 **아직 실제 마스터 템플릿 반영 확인 전** 상태입니다 — 위 요청에 대한 회신을 받으면
  정확한 좌표값으로 다시 맞추겠습니다.

## 확인 후 처리

정확한 좌표 보정값과 구조 변경 내용을 회신해주시면, 저작 도구(content-agent) 쪽 캔버스 미리보기
계산식을 그 값에 맞춰 다시 조정하겠습니다.
