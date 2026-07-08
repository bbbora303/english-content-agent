# 콘텐츠 양산 에이전트 — 프로젝트 컨텍스트

Claude Code가 이 프로젝트에서 작업할 때 참고할 정보입니다.

## 이게 뭐하는 앱인가
영어 교과서 페이지 이미지를 업로드하면 AI(현재 Gemini)가 이미지를 분석해서
- 어떤 화면 유형인지 판별하고 (`understand` / `roleplay` / `roleplay_b`)
- 말풍선/대화문 텍스트와 좌표를 추출해서
디지털 학습 콘텐츠용 데이터 구조로 자동 매핑해주는 내부 제작 도구입니다.
운영자가 이후 UI에서 좌표/텍스트/오디오ID를 미세 조정하고, 완성되면 ZIP으로 내보냅니다.
템플릿(화면 유형별 기본 골격)은 IndexedDB에 저장해서 재사용합니다.

## 핵심 파일
- `src/App.jsx`: 전체 로직이 들어있는 단일 컴포넌트 (원본, 아직 미분리 상태)
  - 상단: IndexedDB 템플릿 CRUD (`openDB`, `saveTemplateDB`, `loadAllTemplatesDB`, `deleteTemplateDB`)
  - `TEMPLATE_UNDERSTAND`, `INIT_ROLEPLAY_DATA`, `INIT_ROLEPLAY_B_SCENES`: 콘텐츠 타입별 기본 데이터 모형
  - `analyzeImageWithAI()`: `server/index.js`의 프록시 엔드포인트(`/api/analyze-image`)를 호출해서
    Claude API로 이미지를 분석. 이미지 분석 → JSON 파싱 → contentType별 상태 세팅까지는 이전과 동일.
  - `handleImageUpload`, `cropImage`: 이미지 업로드/크롭
  - `handle*Change` 계열: 대화/헤더/표퀴즈 등 필드별 편집 핸들러
  - `handleExportZip`: 최종 ZIP 병합 추출 (JSZip 사용, 현재는 CDN 동적 로드 방식 — `loadJSZip()`)
- `server/index.js`: Claude 프록시 서버 (Express). `analyzeWithClaude()`가 실제 Claude API를 호출하고,
  API 키는 `server/.env`에서만 읽음 (브라우저에 노출 안 됨).

## 콘텐츠 타입 3종 (현재)
1. `understand`: 말풍선 4컷, textType은 `inline`/`lines`/`zipper` 세 가지
2. `roleplay` (A형): 대화 + 표 퀴즈(headers/staticRow/입력행)
3. `roleplay_b` (B형): 씬(scene) 여러 개, 각 씬마다 이미지+대화, 표 퀴즈 없음

## 진행 중인 개발 방향 (README.md 참고)
1. **새 콘텐츠 템플릿 타입 추가** — 기존 3종 외 새로운 화면 유형 (미착수)
2. **AI 모델 교체** — ✅ 완료. Gemini → Claude API로 단일화, `server/` 프록시 구조

## 코딩 컨벤션
- Tailwind CSS 유틸리티 클래스 사용, 별도 CSS 파일 최소화
- 상태는 최상위 `App` 컴포넌트에 집중되어 있음 (분리 리팩토링 시 컴포넌트별 props/context로 내려주는 방식 고려)
- 한국어 주석과 UI 라벨 사용 관례 유지
