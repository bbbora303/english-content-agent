# 콘텐츠 양산 에이전트

교과서 페이지 이미지를 AI로 분석해 디지털 콘텐츠 템플릿(Understand / Roleplay A / Roleplay B)으로
자동 매핑하고, 편집 후 ZIP으로 내보내는 내부 제작 도구입니다.

## 시작하기

이제 이 프로젝트는 **프론트엔드(Vite+React)**와 **백엔드(Claude 프록시 서버)** 두 부분으로 이루어져 있습니다.
API 키를 브라우저에 노출하지 않기 위해, 실제 Claude API 호출은 항상 이 프록시 서버를 거칩니다.

```
브라우저(App.jsx) → 프록시 서버(server/index.js) → Claude API
```

### 1. 최초 1회 설정

```bash
npm install
npm run server-install   # == cd server && npm install
```

`server/.env.example`을 복사해서 `server/.env`를 만들고 실제 API 키를 채워넣으세요:

```bash
cp server/.env.example server/.env
```

```
# server/.env
ANTHROPIC_API_KEY=sk-ant-실제-키
```

### 2. 실행

**한 번에 실행 (권장):**
```bash
npm run dev:all
```
프론트(5173)와 서버(3001)가 동시에 뜹니다.

**따로 실행하고 싶다면 (터미널 창 2개 필요):**
```bash
# 터미널 1
npm run dev

# 터미널 2
npm run server
```

브라우저에서 `http://localhost:5173` 접속.

## Claude Code로 개발 이어가기

이 폴더를 그대로 열어서 시작하면 됩니다.

```bash
cd content-agent
claude
```

`CLAUDE.md`에 프로젝트 구조와 컨벤션이 정리되어 있어 Claude Code가 바로 맥락을 파악합니다.
예시 프롬프트:
- "App.jsx에서 template 관련 로직을 src/hooks/useTemplates.js로 분리해줘"
- "새 콘텐츠 타입 'matching'을 로드맵 문서 기준으로 추가해줘"
- "analyzeImageWithAI를 provider 교체 가능한 구조로 리팩토링해줘"

## 개발 로드맵

### 1. 새 콘텐츠 템플릿 타입 추가

현재 `understand` / `roleplay` / `roleplay_b` 세 타입이 하드코딩되어 있습니다 (`contentType` 상태값 기준으로
전체 UI가 분기). 새 타입을 추가하려면:

1. `src/App.jsx` 상단에 새 타입의 기본 데이터 모형 상수 추가 (예: `INIT_MATCHING_DATA`)
2. `analyzeImageWithAI()`의 AI 프롬프트에 새 타입 판별 기준과 JSON 스펙 추가
3. `contentType === 'xxx'` 분기가 있는 각 렌더링 섹션(헤더, 본문 에디터, 미리보기)에 새 분기 추가
4. `handleExportZip`의 병합 로직에 새 타입 데이터 직렬화 규칙 추가

**제안**: 타입이 늘어날수록 `if/else` 분기가 기하급수적으로 늘어나므로, 이 시점에
`contentTypes/` 폴더를 만들어 타입별로 `{ initialData, Editor, Preview, exportSerializer }`를
객체로 등록하는 레지스트리 패턴으로 리팩토링하는 걸 권장합니다. 새 타입을 정확히 어떤 걸로
만들지 정해지면 (예: 매칭형, 순서배열형, 받아쓰기형 등) 알려주시면 데이터 스펙부터 같이 설계할 수
있습니다.

### 2. AI 모델 교체 (Gemini → Claude API) — ✅ 구현 완료

`server/index.js`에 프록시 서버를 만들어서 API 키 노출 문제를 해결하고, Gemini 의존을 걷어내서
**Claude API 단일 구조**로 정리했습니다. (처음엔 provider 선택 드롭다운도 만들었는데, 실제로
필요한 게 "교체"였지 "병행 운용"이 아니라서 단순화했습니다.)

- **구조**: `App.jsx` → `POST http://localhost:3001/api/analyze-image`
  → 서버가 `.env`의 `ANTHROPIC_API_KEY`로 Claude API 호출 → 파싱된 JSON을 프론트로 반환
- **키 보관**: `server/.env` (git에 올라가지 않음). 브라우저 코드 어디에도 키가 없습니다.
- **모델 다시 다양화하고 싶어지면**: `server/index.js`에 `analyzeWithXxx()` 함수를 추가하고
  라우터에 분기를 넣으면 됩니다. (git 히스토리에 예전 provider 분기 구조가 남아있어 참고 가능)

**남은 선택 과제**: 배포(다른 사용자와 공유) 시에는 `server/`를 별도로 호스팅해야 합니다
(Vercel/Cloudflare Workers/자체 서버 등). 지금은 로컬 개발 전용 구조입니다.

## 프로젝트 구조

```
content-agent/
├── src/
│   ├── App.jsx        # 메인 로직 (원본, 아직 미분리)
│   ├── main.jsx        # React 엔트리
│   └── index.css       # Tailwind 진입점
├── CLAUDE.md            # Claude Code용 프로젝트 컨텍스트
├── package.json
└── vite.config.js
```

## 참고
- ZIP 내보내기는 현재 JSZip을 CDN에서 동적 로드하는 방식(`loadJSZip()`)입니다.
  `package.json`에 `jszip`을 이미 의존성으로 추가해두었으니, 원하면
  `import JSZip from 'jszip'`으로 바꿔서 번들에 포함시킬 수 있습니다.
