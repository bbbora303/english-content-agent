# Intro 유형 — 타이틀 이미지 위치/너비를 `contentData`에서 읽도록 지원 요청

> 이 문서는 **저작 도구(content-agent) 대화**에서 새로 추가한 기능을, 동일한 데이터를 최종 렌더링하는
> **마스터 템플릿(view01.js/view01.html/view01.css — Intro용) 대화**에도 반영할 수 있는지 확인하기
> 위해 넘기는 작업 지시문입니다. CLAUDE.md 5-5(저작 도구와 마스터 템플릿은 서로 다른 코드베이스)에
> 따라 관심사를 분리했습니다. 이 문서를 그 대화에 그대로 붙여넣고, 실제 `view01.html`/`view01.css`
> (Intro용) 파일을 함께 전달하면 됩니다.

## 배경

Intro 유형 저작 도구 캔버스에 타이틀 이미지(레슨 번호/제목 그래픽)를 드래그로 옮기고 숫자 입력으로
너비를 조정할 수 있는 기능을 추가했습니다. 그런데 현재 마스터 템플릿(`view01.html`)은 타이틀 이미지의
위치/크기를 `data.js`(`contentData`)에서 읽지 않고, HTML 인라인 스타일에 고정값으로 박혀 있습니다:

```html
<div class="title-audio audio-text" id="title-obj-box" ... style="position: absolute; top: 20px; left: 50px; width: 460px; z-index: 2; ...">
    <img id="title-image" src="" alt="..." style="width: 100%; display: block;">
</div>
```

이 상태에서는 저작 도구에서 위치/너비를 바꿔도 실제 ZIP 병합 결과에는 반영되지 않습니다(캔버스
미리보기와 실제 배포 화면이 어긋남).

## 데이터 스키마 변경

`contentData`에 아래 3개 필드가 새로 추가됩니다(저작 도구 export 쪽은 이미 이 필드를 채워서
내보내도록 반영 완료):

```js
var contentData = {
    // ...기존 필드(learningObjectiveTitle, learningObjectiveColor, learningObjective,
    //   titleAudioId, mainImageAriaLabel, bgImagePath, titleImagePath, animationConfig)는 그대로...
    titleX: 50,       // 타이틀 이미지 left 좌표(px)
    titleY: 20,       // 타이틀 이미지 top 좌표(px)
    titleWidth: 460   // 타이틀 이미지 너비(px). 높이는 원본 이미지 비율대로 자동 계산되도록 유지
};
```

## 수정 방법 (권장)

`view01.html`의 `DOMContentLoaded` 스크립트(현재 `bgImagePath`/`titleImagePath`/`titleAudioId` 등을
읽어 DOM에 반영하는 부분)에 아래처럼 추가해 주시면 됩니다:

```js
// 기존: 이미지 src만 연결
var titleImg = document.getElementById("title-image");
if (titleImg && contentData.titleImagePath) {
    titleImg.src = contentData.titleImagePath;
}

// 추가: 위치/너비도 contentData에서 읽어 반영
var titleBox = document.getElementById("title-obj-box");
if (titleBox) {
    if (typeof contentData.titleX === 'number') titleBox.style.left = contentData.titleX + "px";
    if (typeof contentData.titleY === 'number') titleBox.style.top = contentData.titleY + "px";
    if (typeof contentData.titleWidth === 'number') titleBox.style.width = contentData.titleWidth + "px";
}
```

값이 없을 때(구버전 데이터 등)는 기존 고정값(top:20/left:50/width:460)을 그대로 유지하면 됩니다(위
코드처럼 `typeof === 'number'` 체크로 이미 안전하게 처리됩니다).

## 확인 후 처리

- `titleX`/`titleY`/`titleWidth` 값을 바꿔서 실제로 타이틀 이미지 위치/크기가 바뀌는지 확인해 주세요.
- 값이 없는 기존 데이터(구버전)에서도 회귀 없이 기존 위치(top:20/left:50/width:460)로 나오는지 함께
  확인 부탁드립니다.
- 저작 도구(App.jsx) 쪽은 이미 드래그·숫자 입력 UI와 export 반영까지 완료된 상태라 추가 조치가
  필요 없습니다.
