# 롤플레이 B형 마스터 템플릿(view01.js) 수정 요청 — 작업 프롬프트

> 이 문서는 **저작 도구(content-agent) 대화**에서 롤플레이 B형 캔버스를 고도화한 뒤, 그 결과를
> 반영하기 위해 **마스터 템플릿(view01.js, view01.css) 대화**로 넘기는 작업 지시문입니다.
> CLAUDE.md 5-5(저작 도구와 마스터 템플릿은 서로 다른 코드베이스)에 따라 관심사를 분리했습니다.
> 이 문서를 그 대화에 그대로 붙여넣고, 실제 `view01.js`/`view01.css`(롤플레이 B형) 파일을 함께
> 전달하면 됩니다.

## 배경

저작 도구(content-agent)의 롤플레이 B형 편집 캔버스를 롤플레이 A형과 같은 수준으로 고도화했습니다.
A형은 이미 마스터 템플릿과 100% 일치하도록 실측 기반 한글 배치 로직(`placeMultiLineTranslation`으로
추정)이 반영되어 있는데, B형 마스터 템플릿에는 대응하는 로직이 있는지 확인이 안 된 상태입니다.
이후 롤플레이 B형의 AI 추출 규칙 자체도 크게 바뀌어서(교체 표현/tips 개념 도입), 그 영향으로
추가된 확인 사항(4·5번)도 함께 포함했습니다. 아래 항목들을 확인/반영해 주세요.

## 1. 대사 데이터 필드 형태 확인

저작 도구가 ZIP 추출 시 `js/data.js`에 다음 형태로 씁니다 (최상위 변수명 `rolePlayData`, 배열):

```js
const rolePlayData = [
  {
    type: "B",
    sceneId: 0,
    rolePlayImage: "RolePlay_img_0.png",
    panelBtnImage: "RolePlay_img_mini_0001.png",
    panelBtnLabel: "클릭 시 첫 번째 상황의 대화를 볼 수 있습니다.",
    roleA: "A",
    roleB: "B",
    dialogues: [
      { role: "A", text: ["I'm feeling under the weather."], translation: ["몸이 좀 안 좋아."], audio: ["L3_001_CommB_eg_01"] }
    ]
  },
  // ... 씬 여러 개
];
```

**요청**: `view01.js`가 실제로 이 필드명(`role`/`text[]`/`translation[]`/`audio[]`, 최상위 키 없이
배열을 바로 사용)을 그대로 읽는지 확인해 주세요. CLAUDE.md에는 한때 "최상위에 `scenes` 배열"이라고
적혀 있었는데, 실제 코드를 확인해 보니 그런 키는 없었습니다 — 문서가 부정확했던 것으로 보이며,
`view01.js` 원본을 기준으로 정정하겠습니다.

## 2. 씬 이미지 파일 경로 규칙 확인

저작 도구는 씬마다 사용자가 업로드한 이미지를 ZIP 안에 다음 경로로 심습니다:

```
images/{rolePlayImage 필드값}         예: images/RolePlay_img_0.png
images/{panelBtnImage 필드값}         예: images/RolePlay_img_mini_0001.png
```

이 `images/` 폴더명은 understand 유형의 관례(`images/view0X/image.png`)를 따라 임시로 정한
것이고, 롤플레이 B형 마스터 템플릿이 실제로 이미지를 찾는 폴더 규칙(예: `media/image/` 등,
video가 `media/video/`를 쓰는 것처럼)과 다를 수 있습니다.

**요청**: `view01.js`(또는 관련 HTML)에서 `rolePlayImage`/`panelBtnImage` 필드로 이미지 URL을
만드는 코드를 찾아, 실제 폴더 규칙을 알려주세요. 다르면 저작 도구의 export 경로를 그에 맞게
수정하겠습니다.

## 3. 씬 대사의 실측 기반 한글 배치 로직 필요

### 문제

지금 B형 대사는 영어 문장 하나가 컨테이너 폭(약 740px)에 걸려 여러 줄로 자동 줄바꿈될 수 있습니다.
이때 한글 해석이 어느 줄 아래에 어떻게 붙어야 하는지가 하드코딩된 값이 아니라, **실제로 줄바꿈이
일어난 위치를 브라우저가 렌더링한 뒤 측정해서** 정해져야 정확합니다 (교과서 콘텐츠마다 문장
길이가 다 달라서, 고정 좌표로는 대응이 안 됩니다).

롤플레이 A형은 이미 이 문제를 해결한 상태입니다 (아마 `view01.js`의 `placeMultiLineTranslation`
류 함수). **B형에도 동일한 기능이 필요합니다.**

### 저작 도구가 구현한 참고 로직 (React, `src/App.jsx`)

아래는 저작 도구 캔버스 미리보기에 새로 이식한 로직입니다. 이 알고리즘 그대로(또는 이미 있는
A형 로직을 재사용해서) `view01.js`의 B형 렌더링 함수에도 반영해 주시면 됩니다.

```js
// 대사 항목(dialIdx)마다:
// 1) 영어 문장을 담은 요소(.rpb-line-eng)의 getClientRects()로 실제 줄바꿈 위치를 측정한다.
// 2) 한글 해석(item.kor)을 그 줄 개수만큼 나눠서, 각 줄의 렌더링 폭에 맞게 텍스트를 자른다.
// 3) 마지막 줄이 아니면 컨테이너 폭에 맞춰 자연스럽게 잘리는 지점을 다시 실측(Range.getClientRects())해서 찾는다.
// 4) 각 줄 바로 아래(rect.bottom 기준)에 한글 조각을 절대위치로 배치한다.

const rects = lineEl.getClientRects(); // 영어 문장이 몇 줄에 걸치는지
let remainder = item.kor;
for (let i = 0; i < rects.length && remainder; i++) {
  const rect = rects[i];
  const availWidth = rect.width; // 그 줄 자체의 렌더링 폭
  const isLastRow = (i === rects.length - 1);
  let text;
  if (isLastRow) {
    text = remainder; remainder = '';
  } else {
    // 한글이 그 줄 폭 안에서 어디까지 들어가는지 실측해서 자름 (splitTextForRowWidth)
    const { firstLine, rest } = splitTextForRowWidth(remainder, availWidth, ...);
    text = firstLine; remainder = rest;
  }
  const top = rect.bottom - contentRect.top; // 그 줄 바로 아래
  // → text를 top 위치에 절대배치
}
```

**중요 — 줄 간격**: 영어 문장의 `line-height`가 너무 좁으면(예: 1.4) 한글 해석이 들어갈 자리가
없어서 다음 줄과 겹칩니다. 저작 도구에서는 이 문제를 실제로 겪었고, `line-height: 2.2`로 늘려서
해결했습니다(understand의 zipper 텍스트와 동일한 값). `view01.js`에서도 영어 대사 텍스트의
line-height가 한글 삽입 공간을 확보할 만큼 충분한지 확인해 주세요.

**요청**:
- B형에 이미 이런 실측 로직이 있다면 → 저작 도구가 흉내 낸 위 알고리즘과 실제로 일치하는지
  확인해 주시고, 다르면 정확한 수치(좌/상 보정값, line-height, 폰트 크기 등)를 알려주세요.
  (A형의 경우 `left: +3px`, `top: +18px(JS) + 10px(CSS margin-top)` 같은 보정값이 있었습니다 —
  B형도 비슷한 보정이 있을 가능성이 있습니다.)
- 없다면 → 위 알고리즘을 참고해서 새로 구현해 주세요.

## 4. 강조 표현(emp) 색상 매핑 확인

저작 도구의 AI 분석이 이제 대사 문장 안의 강조 표현을 다음처럼 마킹해서 추출합니다:

```html
I heard that <span class='emp col-1'>our foot size changes</span>.
```

색-클래스 매핑은 파란색=`col-1`, 분홍색=`col-2`, 붉은색=`col-0`으로 정했습니다. 다만 애초에
저작 도구의 B형 기본(목업) 데이터에도 `<span class='emp col-2'>...</span>` 형태가 이미 쓰이고
있던 걸로 봐서, **마스터 템플릿에 `.emp.col-N` 스타일이 이미 존재할 가능성이 높습니다.**

**요청**: `view01.css`(또는 관련 스타일)에서 `.emp`, `.col-0`, `.col-1`, `.col-2` 클래스가 이미
정의되어 있는지 확인해 주시고, 있다면 그 색상이 위 매핑(파란=1, 분홍=2, 붉은=0)과 실제로 일치하는지
알려주세요. 다르면 저작 도구의 AI 분석 프롬프트(`lib/analyzePrompt.js`) 쪽 매핑을 그에 맞게
수정하겠습니다. 없다면 새로 정의가 필요하다는 것도 알려주세요.

## 5. "씬 = 서로 다른 상황"이라는 전제가 항상 참은 아니게 됨 (참고 및 확인 요청)

원래 롤플레이 B형은 씬(scene)마다 서로 다른 상황·이미지가 있다고 전제했습니다(`panelBtnLabel`의
기본 문구도 "~번째 **상황**의 대화를 볼 수 있습니다"처럼 되어 있음). 그런데 이후 AI 추출 규칙이
바뀌면서, **하나의 상황(이미지)에 대해 대화 속 표현 하나만 바뀐 여러 버전**을 씬 여러 개로 나눠
만드는 경우가 생겼습니다 (예: "발 크기 이야기" 하나에 대해 그림은 같고 두 번째 대사만 4가지로
바뀌는 4개의 씬). 이 경우 여러 씬이 **같은 이미지**(사용자가 저작 도구에서 동일 이미지를 여러
씬에 재업로드)를 공유하게 됩니다.

**요청**: `view01.js`의 씬 전환 UI/로직이 "씬마다 이미지가 서로 다르다"를 암묵적으로 전제하는
부분이 있는지 확인해 주세요 (예: 이미지 프리로드 최적화, 캐시 키, `panelBtnLabel` 문구 자동
생성 로직 등). 문제가 없다면(단순히 `rolePlayData` 배열을 그대로 렌더링하는 구조라면) 별도
조치는 필요 없습니다.

## 참고 — tips 필드는 마스터 템플릿과 무관합니다

AI 분석 결과에는 `tips`(교체 표현 후보 목록) 필드가 포함되지만, 이건 **저작 도구 편집 화면에서만
참고용으로 보여주는 데이터**이고 ZIP 산출물(`js/data.js`의 `rolePlayData`)에는 포함되지
않습니다. `view01.js`가 `tips`라는 필드를 새로 처리할 필요는 없습니다 — 혹시 이 리서치/작업
맥락에서 tips 개념을 들으셨다면, 그건 저작 도구 안에서만 쓰이고 마스터 템플릿까지 내려오지
않는다는 점을 참고해 주세요.

## 확인 후 처리

이 답변들을 받으면, 저작 도구(content-agent) 쪽에서:
- 이미지 export 경로(2번)를 수정
- 한글 배치 보정값(3번)을 실제 마스터 템플릿과 일치하도록 미세 조정
- 강조 표현 색상 매핑(4번)이 다르면 AI 분석 프롬프트를 수정
- 씬 전환 관련 문제(5번)가 있다면 저작 도구의 씬 라벨/이미지 재사용 UX를 조정
