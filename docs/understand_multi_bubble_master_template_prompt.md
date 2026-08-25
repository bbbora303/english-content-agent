# Understand 유형 — 컷당 말풍선 여러 개 지원 (마스터 템플릿 확인 요청)

> ✅ **해결됨**: 마스터 템플릿(view01.js) 반영 결과를 실제 파일로 받아 확인함. `ContentRenderer`가
> `PAGE_DATA[n].bubbles` 배열을 그대로 순회하며 말풍선마다 독립된 DOM(`dynamic-bubble`)을 생성하고,
> 꼬리 방향/색상/텍스트 타입/zipper 한글 배치(`placeZipperKorean`)까지 말풍선 단위로 개별 처리함을
> 확인함. 필드명(`bubble.width/x/y/tail_dir/tail_pos/tail_tip/bg_color/border_color`,
> `text.type/eng`)도 저작 도구의 export 스키마와 완전히 일치. 저작 도구(App.jsx) 쪽 추가 수정 불필요.
> 이하는 이관 당시 작성한 원본 확인 요청 내용(기록용으로 보존).

> 이 문서는 **저작 도구(content-agent) 대화**에서 Understand 유형 캔버스를 고도화한 뒤, 그
> 결과를 반영할 수 있는지 확인하기 위해 **마스터 템플릿(view0X.js, view0X.css — Understand용)
> 대화**로 넘기는 작업 지시문입니다. CLAUDE.md 5-5(저작 도구와 마스터 템플릿은 서로 다른
> 코드베이스)에 따라 관심사를 분리했습니다. 이 문서를 그 대화에 그대로 붙여넣고, 실제
> Understand용 `view0X.js`/`view0X.css` 파일을 함께 전달하면 됩니다.

## 배경

지금까지 Understand 유형은 **컷(view) 1개 = 말풍선 1개**를 전제로 만들어져 있었습니다
(`PAGE_DATA[n].bubble`이 단수 객체). 그런데 실제 교과서 지면에는 한 컷 안에 캐릭터 2명 이상이
각자 말풍선으로 대화하는 경우가 있어서, 저작 도구를 고도화해 **한 컷 안에 말풍선을 여러 개
두고 각각 독립적인 위치·크기·색상·텍스트를 가질 수 있게** 했습니다.

이번 작업은 **저작 도구(App.jsx)까지만** 반영했습니다. Understand용 마스터 템플릿
(`view0X.js`/`view0X.css`)이 실제로 컷 하나에 말풍선을 여러 개 동시에 그릴 수 있는 구조인지는
아직 확인된 적이 없어서, 그 확인을 이 문서로 요청합니다.

## 1. 데이터 스키마 변경 확인

저작 도구가 ZIP 추출 시 `js/data.js`의 `PAGE_DATA`에 다음 형태로 씁니다(기존엔 `bubble`/`text`가
단수 객체였는데, 이제 `bubbles` 배열로 바뀌었습니다):

```js
const PAGE_DATA = [
  {
    image_url: "./images/view01/image.png",
    image_aria_label: "이미지 설명",
    bubbles: [
      {
        bubble: { width: 400, x: 190, y: 140, tail_dir: "bottom", tail_pos: 40, tail_tip: "right", bg_color: "#FFE5ED", border_color: "#E3C1CB" },
        text: { type: "inline", eng: [{ sentence: "What do you usually do after school?", kor: "너는 방과 후에 보통 뭐 해?", audio_id: "" }] }
      },
      {
        bubble: { width: 400, x: 500, y: 400, tail_dir: "bottom", tail_pos: 50, tail_tip: "left", bg_color: "#FFFFFF", border_color: "#000000" },
        text: { type: "inline", eng: [{ sentence: "I usually play soccer with my friends.", kor: "나는 보통 친구들이랑 축구를 해.", audio_id: "" }] }
      }
    ]
  },
  // ... 컷(view) 여러 개, 컷마다 bubbles 배열 길이는 1개 이상으로 다를 수 있음
];
```

- 텍스트가 비어있는 말풍선은 배열에서 아예 제외하고 내보냅니다(기존엔 `bubble: null`로
  내보내던 것 — 개수가 가변이라 null 자리 유지가 의미 없어져서 필터링 방식으로 바꿨습니다).
- `bubble`/`text` 내부 필드 구조 자체(`width/x/y/tail_dir/tail_pos/tail_tip/bg_color/border_color`,
  `type/eng`)는 기존과 동일합니다 — 바뀐 건 "이게 배열 안에 여러 개 들어갈 수 있다"는 점뿐입니다.

**요청**: `view0X.js`가 실제로 `PAGE_DATA[n].bubble`(단수)을 읽어 컷당 말풍선 1개만 그리는
구조인지, 아니면 이미 배열/여러 개를 지원하는 구조인지 확인해 주세요.

## 2. 컷 하나에 말풍선 여러 개를 동시에 그릴 수 있는지

### 문제

지금 저작 도구 캔버스는 한 컷 안의 모든 말풍선(`bubbles` 배열)을 동시에 렌더링하고, 각각
독립적으로 드래그·색상·텍스트 편집이 가능합니다. 말풍선 꼬리(tail) 방향/위치, 배경색/테두리색,
텍스트 렌더링 타입(inline/lines/zipper)도 말풍선마다 따로 설정됩니다.

**요청**: `view0X.js`(또는 관련 HTML/CSS)가 한 컷(페이지)에 말풍선 DOM 요소를 여러 개 동시에
생성해서 각각 다른 위치에 배치할 수 있는 구조인지 확인해 주세요. 만약 지금 구조가 "고정된 말풍선
DOM 요소 1개에 데이터만 주입"하는 방식이라면(예: 정적 HTML에 말풍선 1개가 이미 박혀 있고
JS는 텍스트만 채워 넣는 구조), `PAGE_DATA[n].bubbles` 배열 길이만큼 말풍선 DOM을 동적으로
생성하는 로직이 새로 필요합니다.

## 3. zipper 텍스트 렌더링이 말풍선별로 독립적인지

Understand의 `zipper` 텍스트 타입(문장 여러 개가 문장 경계와 무관하게 자연스럽게 흐르며
줄바꿈되고, 그 줄바꿈 위치에 맞춰 한글이 삽입되는 방식)은 실제 DOM에 렌더링된 후
`getClientRects()`로 줄바꿈 위치를 실측해서 한글을 삽입하는 로직(`placeZipperKorean()`)에
의존합니다. 저작 도구 쪽에서는 한 컷에 zipper 타입 말풍선이 2개 이상이어도 각각 독립적으로
측정하도록 이미 고쳤습니다.

**요청**: `view0X.js`의 `placeZipperKorean()`(또는 동등한 함수)이 페이지 안의 zipper 말풍선을
전부 순회하며 각각 독립적으로 측정·삽입하는 구조인지, 아니면 페이지당 1개만 처리하는 구조인지
확인해 주세요. 후자라면 여러 개를 순회하도록 수정이 필요합니다.

## 확인 후 처리

이 답변들을 받으면, 저작 도구(content-agent) 쪽에서는 추가로 손댈 것이 거의 없을 것으로
예상합니다(이미 저작 도구는 배열 스키마로 export하도록 반영 완료). 다만:
- 2번 답변이 "지금 구조로는 불가능"이라면, 그 확인 결과를 바탕으로 이 문서에 마스터 템플릿
  쪽 수정 방향을 다시 논의해야 합니다.
- 1번 필드 구조가 위 예시와 다르게 기대된다면(예: 필드명이 다르거나 배열이 아닌 다른 형태를
  원한다면), 저작 도구의 export 스키마를 그에 맞게 조정하겠습니다.
