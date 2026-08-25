# Understand 유형 — 꼬리 없는 말풍선(`tail_dir: "none"`) 지원 요청

> 이 문서는 **저작 도구(content-agent) 대화**에서 새로 추가한 기능을, 동일한 데이터를 최종 렌더링하는
> **마스터 템플릿(view0X.js — Understand용) 대화**에도 반영할 수 있는지 확인하기 위해 넘기는 작업
> 지시문입니다. CLAUDE.md 5-5(저작 도구와 마스터 템플릿은 서로 다른 코드베이스)에 따라 관심사를
> 분리했습니다. 이 문서를 그 대화에 그대로 붙여넣고, 실제 `view0X.js`/`view0X.css`(Understand용)
> 파일을 함께 전달하면 됩니다.

## 배경

Understand 유형 교과서 지면 중, 캐릭터를 향한 뾰족한 꼬리 없이 사각형/둥근 사각형 박스(캡션·내레이션
텍스트 박스)로만 되어 있는 말풍선이 있습니다. 예: "Later, a toy company began to make flying discs."
같은 내레이션 문구가 캐릭터 대사가 아니라 컷 상단의 캡션 박스로 표시되는 경우.

기존 저작 도구는 모든 말풍선에 항상 꼬리(SVG 포인터)가 있다고 가정하고 있었는데, 이런 캡션형 말풍선에는
꼬리가 없어야 합니다. 저작 도구 쪽에는 이번에 이 기능을 추가·검증 완료했고, **마스터 템플릿도 같은
데이터(`PAGE_DATA[n].bubbles[i].bubble.tail_dir`)를 읽어 렌더링하므로, 꼬리 없는 값도 처리할 수 있어야
실제 병합 결과에서도 캡션 박스가 올바르게 나옵니다.**

## 데이터 스키마 변경

`bubble.tail_dir`이 기존에는 `"top" | "bottom" | "left" | "right"` 중 하나만 오는 것을 전제로
했는데, 이제 `"none"` 값도 올 수 있습니다.

```json
{
  "bubble": {
    "width": 500, "x": 100, "y": 50,
    "tail_dir": "none",
    "tail_pos": 50,
    "tail_tip": "right",
    "bg_color": "#FFF7D6",
    "border_color": "#C6BDA7"
  },
  "text": { "type": "inline", "eng": [ { "sentence": "Later, a toy company began to make flying discs.", "kor": "나중에, 한 장난감 회사가 플라잉 디스크를 만들기 시작했어요.", "audio_id": "..." } ] }
}
```

`tail_dir: "none"`일 때는 `tail_pos`/`tail_tip` 값이 있어도 무시하면 됩니다(저작 도구 UI에서도 이
값들을 비활성화만 하고 별도로 지우지는 않습니다).

## 수정 방법 (저작 도구에서 실제로 적용한 방식)

저작 도구 캔버스에서는 꼬리 SVG를 그리는 부분을 아래처럼 조건부로 렌더링하도록 바꿨습니다
(React/JSX 기준, 원본 마스터 템플릿은 문법이 다를 수 있으니 로직만 참고하세요):

```js
// 수정 전: 항상 꼬리 SVG를 그림
<svg className="bubble-tail-svg" style={getTailStyle(bubble)} viewBox="0 0 60 50">
  {/* ...꼬리 path... */}
</svg>

// 수정 후: tail_dir이 'none'이면 꼬리 SVG 자체를 렌더링하지 않음
{bubble.tail_dir !== 'none' && (
  <svg className="bubble-tail-svg" style={getTailStyle(bubble)} viewBox="0 0 60 50">
    {/* ...꼬리 path... */}
  </svg>
)}
```

마스터 템플릿의 꼬리 렌더링 로직(3-8 항목 참고, `tailFlipTransform`을 계산하는 부분)에도 이와
동일하게, `tail_dir`(또는 대응하는 필드명)이 `"none"`일 때는 꼬리 `<g>`/`<svg>` 요소 자체를 생성하지
않도록(또는 `display:none` 처리하도록) 분기를 추가해 주시면 됩니다.

## 확인 후 처리

- `view0X.js`(Understand의 말풍선 꼬리를 그리는 부분, 3-8 항목의 `tailFlipTransform` 관련 코드)에서
  `tail_dir === 'none'`(또는 값이 없거나 falsy인 경우까지 포함해도 안전) 조건을 추가해 꼬리를 그리지
  않도록 해주세요.
- 꼬리가 없는 말풍선이 실제 병합 화면에서 사각형 캡션 박스처럼(꼬리 없이) 보이는지 확인해 주세요.
- 기존 꼬리 있는 말풍선(`tail_dir: "top"/"bottom"/"left"/"right"`)의 렌더링은 이번 변경과 무관하게
  그대로 동작해야 합니다 — 회귀 없는지 함께 확인 부탁드립니다.
- 저작 도구(App.jsx) 쪽은 이미 이 방식으로 수정·Playwright 검증 완료된 상태라 추가 조치가 필요
  없습니다.
