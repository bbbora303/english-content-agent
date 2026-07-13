# 롤플레이 B형 마스터 템플릿 — 미니 썸네일 패널(panel-btns) 폭 초과 수정 요청 — 작업 프롬프트

> 이 문서는 **저작 도구(content-agent) 대화**에서 롤플레이 B형 실제 병합 결과물을 직접 검수하다
> 발견한 레이아웃 버그를 마스터 템플릿 대화로 넘기는 작업 지시문입니다. 이 문서를 그 대화에
> 그대로 붙여넣고, 실제 `view01.js`/`view01.css`(롤플레이 B형) 파일을 함께 전달하면 됩니다.

## 배경

롤플레이 B형은 AI가 지면에서 인식한 "교체 표현 후보(tips)" 개수만큼 씬(scene)이 자동으로 늘어날
수 있습니다(저작 도구 쪽 설계, 최대 개수 제한 없음 — 사용자가 "+ 씬" 버튼으로 계속 추가 가능).
실제로 씬 6개짜리 지면(우산 분실물 예시 — 무늬 4가지 + 손잡이 등 교체 표현 6개)을 병합해서
확인해보니, 하단의 씬 전환용 미니 썸네일 버튼 행(`panel-btns`)이 **메인 이미지(`role-play-img`)
폭을 훌쩍 넘어서 오른쪽으로 삐져나오는** 문제를 발견했습니다.

## 문제의 정확한 원인 (view01.css)

메인 이미지:
```css
.role-play .role-play-img{position:absolute;left:54.5px;top:251px;width:420px;height:290px}
```
→ 왼쪽 끝 54.5px, 폭 420px, 즉 **오른쪽 끝은 474.5px**에서 끝납니다.

미니 썸네일 버튼:
```css
.panel-btns>.btn-select-panel{position:absolute;top:549px;width:100px;height:75px;...}
.panel-btns>.btn-select-panel:nth-child(1){left:54.5px}
.panel-btns>.btn-select-panel:nth-child(2){left:161.15px}
.panel-btns>.btn-select-panel:nth-child(3){left:267.8px}
.panel-btns>.btn-select-panel:nth-child(4){left:374.5px}
.panel-btns>.btn-select-panel:nth-child(5){left:481.15px}
.panel-btns>.btn-select-panel:nth-child(6){left:587.8px}
```
버튼 1개당 폭 100px, 간격(step) 약 106.65px 고정입니다.
- 씬이 4개일 때: 4번째 버튼이 `374.5 + 100 = 474.5px`에서 끝나서 마침 이미지 오른쪽 끝과
  정확히 일치합니다(의도된 설계로 보임).
- **씬이 5·6개일 때**: 6번째 버튼이 `587.8 + 100 = 687.8px`에서 끝나서, 이미지 오른쪽 끝(474.5px)보다
  **213.3px나 더 오른쪽으로 삐져나갑니다.** 이 영역은 우측의 대본(`role-play-script`, `left:485px`)과
  겹치는 위치라, 실제로는 대본 텍스트 영역 위에 썸네일 버튼이 얹히는 것처럼 보이게 됩니다.

버튼 생성 로직(view01.js `renderRolePlay(data)`):
```js
data.forEach((scene, index) => {
  ...
  const selectBtn = document.createElement('button');
  selectBtn.className = 'btn-select-panel role-play';
  // ... (개수만큼 반복 생성, 위치는 CSS의 nth-child 고정값에 의존)
  btnsContainer.appendChild(selectBtn);
});
```
JS는 정확히 `data.length`개의 버튼만 만들지만, 위치·크기는 전부 CSS의 **고정된 nth-child 값**에
의존하고 있어서, 개수가 4개를 넘어가는 순간 자동으로 이미지 폭을 벗어나 버립니다.

## 요청 사항

**미니 썸네일 버튼 행의 전체 폭이 항상 메인 이미지 폭(420px, 왼쪽 시작 위치도 이미지와 동일한
54.5px)을 넘지 않도록 고정하고, 버튼 개수(N)에 맞춰 각 버튼의 폭이 자동으로 줄어들게** 해주세요.
예를 들어:
- 버튼 사이 간격(gap)을 고정값(예: 6px)으로 유지한다고 하면,
- 버튼 1개당 폭 = `(420 - (N-1) × gap) / N`
- N=4일 때: `(420 - 18) / 4 ≈ 100.5px` (현재 100px와 거의 동일 — 기존 4개 레이아웃과 시각적으로 크게 다르지 않을 것으로 예상)
- N=6일 때: `(420 - 30) / 6 = 65px`
- N=8처럼 더 늘어나도 같은 공식으로 계속 줄어들면 됩니다(저작 도구는 씬 개수에 상한을 두지 않습니다 — "+ 씬" 버튼으로 사용자가 계속 추가할 수 있음).

**구현 방식 제안**: 이미 같은 파일(`view01.js`)에 정확히 같은 유형의 문제를 반응형으로 푼 선례가
있습니다 — `window.autoSizeCustomTableColumns()` 함수가 표(`custom_table`)의 열 개수·내용 길이에
따라 `flex-basis`/`width`를 JS에서 동적으로 계산해서 인라인 스타일로 넣어주는 방식입니다. `panel-btns`도
같은 접근으로, CSS의 고정 `nth-child(1~6)` 좌표에 의존하지 말고 **`renderRolePlay(data)`가 버튼을
만들 때 `data.length`를 기준으로 `width`/`left`(또는 flexbox로 전환해 `flex-basis`)를 JS에서 직접
계산해서 인라인으로 설정**하는 방식을 권장합니다. 이러면 CSS의 nth-child(5)/(6) 규칙(및 향후 더 늘어날
가능성)도 더 이상 필요 없어집니다.

## 참고 — 이번 요청과 무관하게 확인된 것 (조치 불필요)

같은 검수 과정에서 "AI가 4개 씬만 인식했는데 썸네일이 6개 나온다"는 의심이 있었지만, 확인해보니
이건 버그가 아니라 **정상 동작**이었습니다 — AI가 실제로 지면의 교체 표현(tips) 6개를 정확히
인식해서 씬 6개를 만든 것이고, 사용자가 아직 6개 중 4개 씬에만 이미지를 업로드한 상태라 나머지
2개가 빈 틀(플레이스홀더 배경색만 있는 박스)로 보인 것이었습니다. 이 부분은 저작 도구의 의도된
설계(씬 이미지는 항상 빈 틀로 시작, 사용자가 직접 업로드)이므로 마스터 템플릿 쪽에서 손댈 필요
없습니다.

## 확인 후 처리

이 답변(또는 수정된 `view01.js`/`view01.css`)을 받으면, 저작 도구(content-agent) 쪽은 별도로
손댈 코드가 없습니다 — 이 문제는 순수하게 마스터 템플릿의 레이아웃 로직 문제이고, 저작 도구가
내보내는 `rolePlayData` 배열 자체(씬 개수·이미지 파일명)는 이미 올바릅니다.
