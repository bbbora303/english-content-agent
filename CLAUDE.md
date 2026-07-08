# CLAUDE.md — 콘텐츠 양산 에이전트 프로젝트 컨텍스트

> 이 문서는 Claude(claude.ai 채팅)와 나눈 장기 대화 내용을 Claude Code(VS Code 연동)로 이어받기 위해 정리한 것입니다.
> 요약이 아니라 "정리"가 목적이므로, 정보 손실보다 분량을 우선했습니다.

---

## 1. 프로젝트 개요

### 무엇을 만들고 있는가
**콘텐츠 양산 에이전트**: 영어 교과서 페이지 이미지를 업로드하면 AI(Claude API)가 이미지를 분석해서
- 어떤 화면 유형인지 판별하고 (`understand` / `roleplay` / `roleplay_b`)
- 말풍선·대화문 텍스트와 좌표를 추출해서
디지털 학습 콘텐츠용 데이터 구조(`data.js`)로 자동 매핑해주는 **내부 제작(저작) 도구**입니다.

운영자(콘텐츠 제작자)가 이후 이 도구의 UI에서 좌표·텍스트·오디오ID를 미세 조정하고, 완성되면 ZIP으로 내보냅니다.
내보낸 ZIP은 **마스터 템플릿**(별도로 관리되는 HTML/CSS/JS 세트, 이 저작 도구와는 다른 코드베이스)의 `js/data.js`를 교체하는 방식으로 최종 학습 콘텐츠가 완성됩니다.

### 목적
- 원래는 사람이 교과서 페이지를 보고 손으로 `data.js`를 작성해야 했음 → 그 수고를 AI 이미지 분석으로 줄이는 것이 핵심 목적
- 좌표/텍스트를 캔버스에서 직접 조정할 수 있는 WYSIWYG(비슷한) 편집 환경 제공
- 완성된 콘텐츠를 마스터 템플릿과 병합해 즉시 배포 가능한 ZIP으로 추출

### 콘텐츠 타입 3종 (현재 지원)
1. **`understand`**: 만화 컷(보통 4컷) + 말풍선. 말풍선 텍스트 렌더링 방식이 다시 3가지로 나뉨:
   - `inline`: 짧은 문장들이 한 줄로 이어짐 (한 줄에 다 들어감)
   - `lines`: 문장 1개가 길어서 여러 줄로 줄바꿈됨 (오디오 1개, 작성 시점에 줄이 미리 나뉘어 있음 — `lines` 배열)
   - `zipper`: 문장 여러 개(각각 별도 오디오)가 문장 경계와 무관하게 자연스럽게 흐르며 줄바꿈됨
2. **`roleplay`** (롤플레이 A형): 대화(dialogues) + 표 퀴즈(Table Quiz)
3. **`roleplay_b`** (롤플레이 B형): 씬(scene) 여러 개, 각 씬마다 이미지+대화, 표 퀴즈 없음

### 기술 스택

**프론트엔드**
- Vite `^5.3.1` + React `^18.3.1` / `react-dom ^18.3.1`
- Tailwind CSS `^3.4.4` (+ `autoprefixer ^10.4.19`, `postcss ^8.4.38`)
- `@vitejs/plugin-react ^4.3.1`
- `jszip ^3.10.1` (ZIP 병합 추출용, CDN 동적 로드 방식 `loadJSZip()`으로 사용 — package.json에는 의존성으로 있지만 실제로는 `import`가 아니라 동적 로드)
- 단일 컴포넌트 구조: `src/App.jsx` (약 1,800줄 이상, 아직 컴포넌트 분리 안 됨)

**백엔드 (로컬 개발용)**
- Express (`server/index.js`) — Claude API 프록시 서버
- `cors`, `dotenv`
- API 키는 `server/.env`에만 존재, 브라우저에 노출 안 됨

**백엔드 (배포용, 신규 추가)**
- Vercel 서버리스 함수: `api/analyze-image.js`, `api/health.js` (프로젝트 루트)
- `server/`(Express)와는 별도 코드베이스로, 로컬 개발엔 `server/`를, 배포엔 `api/`를 사용하는 **이원화 구조**

**AI 모델**
- Claude API 단일화 (예전엔 Gemini도 썼으나 완전히 제거됨, provider 선택 UI도 삭제됨)
- 모델 문자열: `claude-sonnet-5`
- 이미지 분석용 시스템 프롬프트(`ANALYZE_PROMPT`)는 `lib/analyzePrompt.js` 공유 모듈에 있고, `server/index.js`(로컬)와 `api/analyze-image.js`(배포용) 양쪽이 이 파일을 `import`해서 씀 — 예전엔 두 파일에 복붙되어 있었으나 동기화 누락 위험 때문에 분리함 (2-14 참고)

**배포**
- Vercel + GitHub 연동 방식으로 진행 중 (CLI 방식도 검토했으나 최종적으로 GitHub 연동 선택)

**빌드/실행 스크립트** (`package.json`)
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "server": "node server/index.js",
  "server-install": "npm install --prefix server",
  "dev:all": "concurrently \"npm run dev\" \"npm run server\""
}
```

**저장소**
- 템플릿(화면 유형별 기본 골격 ZIP)은 브라우저 **IndexedDB**에 저장 (서버 저장 아님 — 브라우저·도메인별로 분리된 로컬 저장소라는 점이 배포 시 중요한 제약사항, 4번 항목 참고)

### 실행 방법 (Setup & Run) — 원본 README.md 기준, 실무 정보라 반드시 유지

**최초 1회 설정**
```bash
npm install
npm run server-install       # == cd server && npm install
cp server/.env.example server/.env
# 이후 server/.env 파일을 열어 실제 API 키 입력: ANTHROPIC_API_KEY=sk-ant-실제키
```

**실행 (매번)**
```bash
npm run dev:all               # 프론트(5173) + 서버(3001) 동시 실행
```
(따로 실행하고 싶으면 터미널 2개로 `npm run dev`와 `npm run server`를 각각 실행)

브라우저에서 `http://localhost:5173` 접속.

### 코딩 컨벤션
- Tailwind CSS 유틸리티 클래스 사용, 별도 CSS 파일 최소화 (단, Understand 캔버스처럼 마스터 템플릿과 픽셀 단위로 정확히 맞춰야 하는 부분은 예외적으로 인라인 `style` 객체를 씀 — 3-6 참고)
- 상태는 최상위 `App` 컴포넌트에 집중되어 있음 (컴포넌트 분리 리팩토링은 아직 안 함 — 분리 시 props/context로 내려주는 방식 고려)
- **한국어 주석과 UI 라벨 사용 관례 유지**

### IndexedDB 이름
- 템플릿(관리자 모드에서 업로드하는 마스터 ZIP)을 저장하는 IndexedDB의 실제 데이터베이스 이름은 **`ContentBuilderDB_V6`**입니다 (`App.jsx` 상단, `const DB_NAME = 'ContentBuilderDB_V6'`).
- 브라우저 개발자도구 → Application → IndexedDB에서 이 이름으로 찾을 수 있음. 5-4 항목(IndexedDB 저장의 한계)과 함께 참고.

---

## 2. 지금까지 확정된 결정사항

### 2-1. AI 모델은 Claude로 단일화
- **결정**: Gemini 완전 제거, Claude API만 사용. provider 선택 드롭다운도 만들었다가 다시 제거함.
- **이유**: "실제로 필요한 게 '교체'였지 '병행 운용'이 아니라서 단순화"했다고 프로젝트 초기 문서(README)에 명시됨.

### 2-2. API 키는 항상 서버 사이드에서만 관리
- **결정**: `server/.env`(로컬) 또는 Vercel 환경변수(배포)에만 API 키 존재. 브라우저 코드에는 절대 노출 안 함.
- **구조**: `브라우저(App.jsx) → 프록시 서버 → Claude API`
- **이유**: API 키 유출 방지가 최우선 원칙.

### 2-3. 로컬 개발(Express)과 배포(Vercel 서버리스)를 별도 코드베이스로 유지
- **결정**: `server/index.js`(Express, 로컬 전용)를 삭제하지 않고 그대로 두고, 별도로 `api/analyze-image.js` · `api/health.js`(Vercel 서버리스 함수)를 새로 만듦.
- **이유**: Vercel은 "항상 켜져 있는 Express 서버" 방식이 아니라 요청이 올 때만 실행되는 서버리스 함수 방식이라, Express 코드를 그대로 올릴 수 없음. 로컬 개발 편의성(HMR, 익숙한 Express 구조)은 유지하면서 배포 요건도 맞추기 위한 이원화.
- **부작용/주의(해소됨)**: 이미지 분석 프롬프트(`ANALYZE_PROMPT`)를 두 파일에 각각 유지해야 하는 동기화 누락 위험이 있었으나, `lib/analyzePrompt.js` 공유 모듈로 분리해서 해소함 (2-14 참고)

### 2-4. `AI_PROXY_URL`을 절대경로 → 상대경로로 변경
- **결정**: `http://localhost:3001/api/analyze-image` → `/api/analyze-image` (상대경로)
- **이유**: 로컬에서는 Vite 프록시(`vite.config.js`의 `server.proxy`)가 `/api`를 `localhost:3001`로 넘겨주고, Vercel 배포 후에는 프론트와 API가 같은 도메인에서 서비스되므로 상대경로 하나로 로컬·배포 둘 다 커버 가능.
- **대안 배제**: 환경변수로 URL을 분기하는 방식도 가능했지만, Vite proxy + 상대경로 조합이 더 단순해서 채택.

### 2-5. 이미지 업로드 시 조건부 리사이즈/압축
- **결정**: 원본 파일 크기가 **3MB 이하면 리사이즈 없이 원본 그대로 전송**, 3MB 초과 시에만 canvas로 리사이즈(긴 변 1600px) + JPEG 82% 압축.
- **이유**: Vercel 서버리스 함수의 요청 본문 크기 제한이 **4.5MB로 고정**되어 있고, 이 프로젝트는 Next.js가 아닌 순수 Vite라서 `export const config = { api: { bodyParser: ... } }` 같은 설정으로 이 한도를 늘릴 수 없음(그 문법은 Next.js 전용). base64 인코딩 시 원본 대비 약 1.37배 커지므로, 3MB 기준이면 `3MB × 1.37 ≈ 4.1MB`로 안전 마진을 두고 4.5MB 이내에 들어옴.
- **처음엔 모든 이미지를 무조건 리사이즈**하도록 만들었다가, 사용자 요청으로 "기준 용량 넘을 때만 동작"하도록 조건을 추가함 (불필요한 화질 저하 방지).

### 2-6. 배포는 CLI가 아니라 GitHub 연동 방식으로
- **결정**: `vercel` CLI로 직접 배포하는 방법도 안내했었지만, 최종적으로는 **GitHub 저장소 연동 → Vercel 자동 배포** 방식을 선택.
- **이유**: 이 프로젝트가 짧은 주기로 반복적으로 수정되는 패턴이라(대화 전체가 그 증거), `git push`만으로 자동 재배포되는 쪽이 매번 `vercel --prod`를 수동 실행하는 것보다 실사용에 적합하다고 판단. 과거 배포로 롤백하기도 Vercel 대시보드에서 더 쉬움.

### 2-7. zipper 텍스트 렌더링은 "마스터 템플릿과 100% 동일한 로직"을 저작 도구에도 포팅
- **결정**: Understand 유형의 zipper 텍스트 렌더링을, 저작 도구(App.jsx)의 캔버스 미리보기가 실제 마스터 템플릿(`view0X.js`)의 런타임 측정 로직(`getClientRects()` 기반)과 동일하게 동작하도록 구현.
- **이유**: 여러 차례(수정7~10) 근사치로 구현했다가 실제 병합 결과와 다르다는 피드백을 반복해서 받았음. 최종적으로 마스터 템플릿의 실제 렌더링 함수 코드를 직접 확인한 뒤, 그 알고리즘(문장을 `display:inline`으로 유지해 호버/클릭 그룹을 보존하면서, `getClientRects()`로 각 문장이 몇 줄에 걸치는지 실측해 그 줄 끝에 한글을 절대위치로 삽입)을 React로 그대로 이식하는 것으로 결론남.
- **캔버스 스케일 보정**: 저작 도구 캔버스도 마스터 템플릿처럼 전체가 `transform: scale(...)`로 축소되므로, 측정값을 그 scale로 나눠 논리적 픽셀로 변환 후 적용해야 함 (그렇지 않으면 확대·축소 배율에 따라 위치가 어긋남).

### 2-8. 마스터 템플릿 자체의 버그/한계는 "이 프로젝트의 다른 대화"에서 별도로 수정
- **결정**: 저작 도구(App.jsx, index.js)와 마스터 템플릿(`view0X.js`, `view0X.css`)은 서로 다른 코드베이스이자 다른 관심사이므로, 마스터 템플릿 자체를 고쳐야 하는 이슈(예: 말풍선 꼬리 tail_tip 미반영, 비디오 파일명 하드코딩, zipper 한글 삽입 로직 부재)는 **이 대화가 아니라 프로젝트 내 별도 대화로 이관**해서 처리.
- **이유**: 두 코드베이스를 한 대화에서 왔다갔다 하면 캔버스 미리보기와 실제 템플릿 동작이 미묘하게 어긋나는 문제가 반복적으로 발생했음(실제로 여러 번 발생). 관심사를 분리해 각 대화가 각자의 코드베이스에만 집중하도록 함.
- **실제로 이관되어 완료 확인된 항목**: 말풍선 꼬리 tail_tip 반영, 비디오 파일명 data.js 연동, zipper 줄바꿈 시 한글 삽입 로직.

### 2-9. 정밀도 검증은 "가장 오래된 완전한 버전"을 기준으로
- **결정**: 여러 구버전 파일(260526, 260601, 260622, 260623)을 비교한 결과, **260601 버전이 "기능이 다 살아있던 마지막 온전한 버전"**이라는 게 확인됨. 이후 (260601→260623 사이) 대규모 리팩토링 때 여러 함수와 정밀한 스타일 값이 소실됨. Claude API 전환은 260623 이후에 이뤄짐.
- **이유**: 260623은 이미 함수 손실이 있는 상태에서 AI 모델만 교체된 버전이라 비교 기준으로 신뢰도가 낮음. 260526과 260601은 실질적으로 동일(understand 관련 코드는 거의 변경 없음)하므로 260601을 기준점으로 채택.
- **검증 결과**: understand 핵심 함수 다수가 260601과 **완전히 동일한 코드**였고, 일부만 roleplay_b 분기 추가로 인한 변경이었음 (로직 자체는 안 바뀜, 조건문만 확장됨).

### 2-10. 260601 대조로 찾아낸 3가지 정밀도 문제("발견 1/2/3")
260526·260601 구버전과 캔버스를 직접 대조하면서 발견한 3가지 이슈. 대화 중 "발견 1", "발견 2", "발견 3"이라는 이름으로 불렸고, 사용자는 이 중 **1번과 3번만 즉시 반영**하도록 결정함 (2번은 보류, 7-1 참고).

- **발견 1**: 유형 뱃지(예: "A Understand") 디자인 구조가 잘못됨 → **반영함** (아래 2-10-1 항목이 그 내용)
- **발견 2**: Understand 메인 이미지 렌더링 방식 차이 — 원본은 `backgroundSize: '100% 100%'`(비율 무시하고 늘림), 캔버스는 `object-cover`(비율 유지, 크롭). 교과서 이미지 비율이 614×354와 안 맞으면 두 방식의 결과가 달라짐 → **보류됨, 미해결** (7-1 참고)
- **발견 3**: 지시문 텍스트 폰트 크기가 24px(Tailwind 근사치)로 되어 있었음 → **반영함** (아래 2-11 항목이 그 내용)

### 2-10-1. 유형별 상단 뱃지 디자인 구조 (발견 1)
- **결정**: 알파벳(예: "A")과 텍스트("Understand")를 하나의 필박스(꽉 찬 배경색 박스)로 합쳐서 렌더링하던 것을, **원형 배지(알파벳만) + 테두리만 있는 박스(텍스트, 배경 없음)** 구조로 교체.
- **색상**: `understand`는 초록 계열(`#088d3b` 원형 배지, `#2f964e` 텍스트, `#d3ea95` 테두리), `roleplay`/`roleplay_b`는 파랑 계열(`#0580ac` 원형 배지, `#09769d` 텍스트, `#c9e6f4` 테두리).

### 2-11. 지시문 폰트 크기는 28px (24px 아님) (발견 3)
- **결정**: Tailwind의 `text-2xl`(24px)로 근사되어 있던 걸 원본 값인 28px로 고정.

### 2-12. Understand 캔버스에 "이전/다음 컷" 네비게이션을 신규 구현
- **결정**: 어떤 구버전에도 존재하지 않았던 기능이라 처음부터 새로 설계·구현. `pageData.length > 1`일 때만 표시, 좌우 화살표 + 인접 컷 썸네일(파스텔톤 필터 적용).

### 2-13. Understand 말풍선 빈 텍스트 처리
- **결정**: 사용자가 문장을 모두 삭제해 텍스트가 비어있으면, ZIP 추출 시 `bubble` 필드를 `null`로 내보내서 빈 말풍선이 그려지지 않도록 함. (전제: 마스터 템플릿이 `bubble: null`을 보고 말풍선을 안 그린다는 가정 하에 동작 — 실제 템플릿 코드로 100% 확인된 것은 아님, 7번 항목 참고)

### 2-14. Understand 메인 이미지 렌더링 방식을 "늘림" 처리로 통일 (7-1 해결)
- **결정**: 캔버스의 Understand 메인 배경 이미지(`activeData.bgSrc`)를 `object-cover`(비율 유지, 크롭)에서 `object-fill`(비율 무시, 늘림)로 변경 — `src/App.jsx`의 메인 이미지 `<img>` 한 곳만 수정. 이전/다음 컷 썸네일(파스텔 필터 적용된 네비게이션 이미지)은 마스터 템플릿에 대응하는 원본이 없는 신규 기능(2-12)이라 `object-cover`를 그대로 유지.
- **이유**: 마스터 템플릿 원본이 `backgroundSize: '100% 100%'`(늘림)로 동작하므로, 캔버스 미리보기와 실제 병합 추출 결과를 100% 일치시키기 위해 늘림 처리로 통일. 원본 이미지 비율이 614×354와 안 맞으면 이미지가 다소 늘어나 보일 수 있음 — 이는 감수하기로 함(7-1의 보류 상태 해제).

### 2-15. `ANALYZE_PROMPT`를 `lib/analyzePrompt.js` 공유 모듈로 분리 (7-8 해결)
- **결정**: `server/index.js`와 `api/analyze-image.js`에 각각 복붙되어 있던 `ANALYZE_PROMPT` 상수를 프로젝트 루트의 `lib/analyzePrompt.js`로 옮기고, 두 파일에서 `import { ANALYZE_PROMPT } from '../lib/analyzePrompt.js'`로 가져다 씀.
- **이유**: 두 파일 다 ESM(`"type": "module"`)이라 상대경로 import가 문제없이 동작하고, 이제 프롬프트를 고칠 땐 `lib/analyzePrompt.js` 한 곳만 고치면 로컬/배포 양쪽에 자동 반영되어 동기화 누락 위험이 구조적으로 사라짐.
- **범위**: 이번엔 `ANALYZE_PROMPT`만 분리함. `extractJson`, `analyzeWithClaude` 함수 본체는 여전히 두 파일에 각각 존재(에러 메시지 문구가 로컬/배포용으로 미묘하게 다르게 작성되어 있어 의도적으로 남겨둠) — 필요하면 추가로 공유 모듈화할 수 있음.

### 2-16. 죽은 코드 `handleGlobalDataChange` 삭제 (7-2 해결)
- **결정**: `App.jsx`에 남아있던, 어디서도 호출되지 않는 `handleGlobalDataChange` 함수(5줄 분량)를 삭제함. 실제로 쓰이는 `updateGlobalData`는 그대로 유지.
- **이유**: 코드 용량이 작아서(5줄) 남겨둬도 해는 없었지만, 이름이 비슷한 함수 두 개가 공존하면 나중에 잘못된 쪽을 호출할 위험이 있어 정리하는 쪽을 선택.

---

## 3. 확정된 코드

> 실제 리포지토리에 존재하는 파일(`App.jsx`, `server/index.js`, `package.json`, `vite.config.js`,
> `.gitignore`, `api/*.js`, `lib/*.js`)의 코드는 여기에 옮기지 않았습니다. Claude Code가 폴더 내 파일을
> 전부 직접 읽을 수 있으므로 중복입니다. 아래는 **"이 파일/함수가 왜 이렇게 되어 있는지"를
> 코드만 봐서는 알기 어려운 맥락과 이유**만 정리했습니다. 단, **마스터 템플릿(`view0X.js`,
> `view0X.css`)은 이 리포지토리에 포함되지 않은 별도 코드베이스**라서 관련 부분은 코드를
> 그대로 남겨뒀습니다 (3-8).

### 3-1. `package.json`
- 위치: 프로젝트 루트
- `scripts`에 `dev`, `build`, `preview`(Vite 기본) 외에 `server`, `server-install`, `dev:all`(concurrently로 프론트+백엔드 동시 실행)이 추가되어 있음 — 원래 없었다가 이번에 새로 만든 것.

### 3-2. `vite.config.js`
- 위치: 프로젝트 루트
- 기존에 `server.port: 5173`만 있던 파일에 `server.proxy`(`/api` → `http://localhost:3001`)를 추가한 상태.
- **이 proxy가 없으면 로컬 개발에서 이미지 분석이 동작하지 않음** (App.jsx가 이제 `/api/analyze-image` 상대경로를 쓰기 때문 — 2-4 참고).

### 3-3. `.gitignore`
- 위치: 프로젝트 루트
- `node_modules`, `server/node_modules`, `server/.env`, `.env`, `dist`, `.vercel` 제외 처리. 배포 준비하면서 새로 생성.

### 3-4. `api/health.js`, `api/analyze-image.js`
- 위치: 프로젝트 루트의 `api/` 폴더 (Vercel 배포용, 신규 생성)
- `server/index.js`(Express, 로컬 전용)의 로직을 Vercel 서버리스 함수 형태로 이식한 것. `ANALYZE_PROMPT`는 `lib/analyzePrompt.js`(3-9 참고)에서 공유해서 가져오므로 자동으로 동일하지만, **`extractJson`, `analyzeWithClaude` 로직은 여전히 `server/index.js`와 각각 따로 존재하므로 그 부분을 고칠 땐 두 파일 다 수동으로 동기화해야 함** (5번 "제약조건" 참고).
- `api/analyze-image.js` 파일 끝에 Vercel 요청 본문 4.5MB 제한에 대한 주석이 남아있음 — 프론트엔드의 이미지 리사이즈 로직(3-7)과 짝을 이루는 설명이라 지우지 않음.

### 3-5. `server/index.js`
- 위치: `server/` 폴더 (로컬 전용, 배포에는 안 쓰임)
- `dotenv.config()`를 **파일 자신의 위치 기준 절대경로**(`path.join(__dirname, '.env')`)로 호출하도록 되어 있음. 단순히 `dotenv.config()`만 쓰면 실행 위치(cwd)에 따라 `.env`를 못 찾는 버그가 있었기 때문(4-8 참고).

### 3-9. `lib/analyzePrompt.js` (신규)
- 위치: 프로젝트 루트의 `lib/` 폴더 (신규 생성)
- `ANALYZE_PROMPT` 상수 하나만 `export`하는 공유 모듈. `server/index.js`와 `api/analyze-image.js`가 각각 `import { ANALYZE_PROMPT } from '../lib/analyzePrompt.js'`로 가져다 씀 (2-15 참고).
- `server/`는 자체 `package.json`(별도 `node_modules`)을 가진 독립 프로젝트지만, ESM 상대경로 import는 npm 패키지 경계와 무관하게 파일 경로로 직접 동작하므로 문제없이 참조 가능.

### 3-6. `App.jsx` — 새로 추가/복원된 주요 함수 위치 (전체 코드는 파일 참고)

| 함수/영역 | 역할 | 비고 |
|---|---|---|
| `AI_PROXY_URL` (상수) | API 엔드포인트 주소 | 절대경로→상대경로(`/api/analyze-image`)로 변경됨 (2-4) |
| `resizeImageForUpload`, `RESIZE_THRESHOLD_BYTES`, `handleImageUpload` | 이미지 업로드 전 조건부 리사이즈 | 원본 3MB 초과 시에만 동작 (2-5) |
| `serverStatus` state + 관련 `useEffect` | 서버 연결 상태 배너 | `/api/health` 호출해서 표시 |
| `handleExportZip` | ZIP 병합 추출 | 260601에서 복원됨 (4번, "구조 복원" 참고) |
| `handleTemplateUpload`, `addTableQuizRow`, `removeTableQuizRow`, `handleTableQuizChange` | 관리자 템플릿 업로드 / 롤플레이 표 퀴즈 | 260601에서 복원됨 |
| `updateGlobalData` | 공통 설정 탭 범용 업데이트 | 260601에서 복원됨. 이름이 겹치는 죽은 코드 `handleGlobalDataChange`가 한동안 공존했으나 삭제됨 (2-16, 4-7 참고) |
| `handleBgSwap` | Understand 배경 이미지 교체 | 260601에서 복원됨. 이게 없어서 캔버스 진입 시 흰 화면(크래시) 발생했었음 |
| `getTailStyle` + 말풍선 꼬리 SVG 렌더링 | 말풍선 꼬리 위치/방향 계산 | 260601에서 복원됨. `tail_tip==='left'`용 path는 수학적으로 마스터 템플릿의 `scale(-1,1) translate(-60,0)` 반전과 동일한 결과임을 검증함 |
| 말풍선 컨테이너 padding | Understand 말풍선 여백 | 타입별로 다름: zipper `5px 10px 42px 17px`, lines/inline `20px 10px 52px 17px` (마스터 템플릿 CSS와 일치시킴, 3-8 참고) |
| 텍스트 타입별(inline/lines/zipper) 렌더링 분기 | 말풍선 텍스트 표시 | zipper는 `zipperFlowRef`+`useLayoutEffect`(아래 항목)가 별도로 한글 위치를 계산, inline은 `white-space:nowrap`으로 실제 템플릿처럼 한 줄 강제 |
| `zipperFlowRef`, `zipperKorFragments` state, 관련 `useLayoutEffect` | zipper 한글 위치 실측 | 마스터 템플릿의 `placeZipperKorean()`을 `getClientRects()` 기반으로 React에 그대로 포팅한 것 (2-7 참고). 캔버스 전체가 `scale(...)`로 축소되므로 측정값을 `scale`로 나눠 보정하는 부분이 핵심 |
| 상단 유형 뱃지 + 헤더 액션 버튼 | "A Understand" 뱃지, 비디오/How to play 버튼 | 원형 배지+테두리 박스 구조(2-10), 비디오 버튼은 실제 사내 CDN 에셋(`btn_video.png`, `aidtcdn-dev.aitextbook.co.kr`) 사용 — 그 CDN에 접근 안 되는 네트워크에서는 안 보일 수 있음 |
| "내용 더 보기" 버튼 | Understand 더보기 | 정확한 좌표(`left:96.5, top:563.15`), 색상(`#ee6f00`), 실제 화살표 아이콘 에셋 사용 |
| 이전/다음 컷 네비게이션 | Understand 컷 이동 | 신규 기능(2-12). 썸네일에 마스터 템플릿과 동일한 파스텔 필터(`opacity(0.85) contrast(0.65) brightness(1.15) grayscale(0.15)`) 적용 |

### 3-7. `App.jsx` 상 결정된 수치/상수 (판단 근거가 코드만 봐선 안 보이는 것들)
- `RESIZE_THRESHOLD_BYTES = 3 * 1024 * 1024`(3MB): base64 변환 시 약 1.37배 커지는 것 감안, Vercel 4.5MB 한도에 안전 마진을 둔 값.
- 이미지 리사이즈 시 `maxDimension = 1600`, `quality = 0.82`(JPEG): 교과서 사진 화질과 용량의 타협점으로 임의 설정한 값 — 실사용해보고 화질이 부족하면 조정 필요.
- zipper 텍스트 판정(AI 프롬프트, `api/analyze-image.js` 및 `server/index.js` 공통): 말풍선 너비 550px, 폰트 27px 굵은 sans-serif 기준 "한 줄에 약 35~40자" — 실측이 아니라 추정치이므로 실사용 중 오판정이 잦으면 이 숫자를 조정해야 할 수 있음.

### 3-8. 마스터 템플릿(`view0X.js`, `view0X.css`) — ⚠️ 이 리포지토리에 없는 별도 코드베이스라 코드 원문을 보존함

**꼬리 방향(tail_tip) 반영** (다른 대화에서 수정 완료, 확인됨):
```javascript
const tailTip = (this.data.bubble && this.data.bubble.tail_tip === 'left') ? 'left' : 'right';
const tailFlipTransform = tailTip === 'left' ? 'scale(-1,1) translate(-60,0)' : '';
// <g transform={tailFlipTransform}>로 감싸서 좌우 반전
```

**비디오 파일명 data.js 연동** (다른 대화에서 수정 완료, 확인됨):
```javascript
new ni({
  root: c,
  options: {
    url: "media/video/",
    type: "default",
    quality: 720,
    fileName: (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA.video_file_name)
      ? GLOBAL_DATA.video_file_name
      : "중등영어2_Bridge_L2" // 값이 없을 때의 기본값(fallback)
  }
})
```

**CSS — 말풍선 여백/줄간격 컨트롤타워** (`view0X.css`, understand 타입별로 다름):
```css
.dynamic-bubble.text-type-zipper { padding-top: 5px; padding-bottom: 42px; }
.dynamic-bubble.text-type-lines,
.dynamic-bubble.text-type-inline { padding-top: 20px; padding-bottom: 52px; }

.dynamic-bubble .eng { line-height: 0.85 !important; }
.dynamic-bubble .kor { margin-top: 1px !important; margin-bottom: 12px !important; line-height: 1.2 !important; }
.dynamic-bubble .eng-line { margin-top: 8px !important; }
.dynamic-bubble .eng-line:first-child { margin-top: 0px !important; }

.dynamic-bubble .zline-flow .eng { line-height: 2.2; }
```

**썸네일(이전/다음 페이지 이미지) 필터** (`view0X.css`, `.custom-nav > .btn-nav[data-type="image"]`):
```css
filter: opacity(0.85) contrast(0.65) brightness(1.15) grayscale(0.15);
```

**zipper 한글 삽입 로직 (`placeZipperKorean()`)**: App.jsx의 3-6 항목에 있는 `useLayoutEffect`가 이 함수의 알고리즘을 그대로 포팅한 것. 마스터 템플릿 쪽 원본 함수 전체 코드는 이 문서에는 없고, 별도로 이관된 대화 기록에 있음 — 필요하면 그 대화에서 다시 받아와야 함 (7번 참고).

## 4. 시도했다가 실패/폐기한 방법

### 4-1. zipper 텍스트: 글자 수 기반 임의 줄 분할 (`splitFirstLine`) — **폐기**
- **시도한 것**: 문장이 길어서 줄바꿈될 때, 문자 수(~38자) 기준으로 "첫 줄"과 "나머지"를 문자열 단위로 잘라서, 그 사이에 한글을 강제로 끼워넣는 방식.
- **왜 실패했나**: 실제 마스터 템플릿의 렌더링 코드(`view0X.js`)를 확인해본 결과, 템플릿은 이런 글자 수 계산을 전혀 하지 않고 있었음. 문장을 그대로 `display:block`(이후 `inline`으로 재수정) 요소에 넣고 브라우저가 자연스럽게 줄바꿈하게 둘 뿐이었음. 근거 없이 만든 임시방편이었고, 실제 병합 결과와 캔버스 미리보기가 어긋나는 원인이 됨.
- **최종 대체**: 실제 템플릿의 `getClientRects()` 기반 실측 로직을 그대로 포팅 (2-7, 3-6의 `zipperFlowRef` 행 참고).

### 4-2. zipper: 문장을 2개 데이터 항목(같은 audio_id 공유)으로 분할 — **폐기**
- **시도한 것**: 긴 문장 하나를 `eng` 배열의 별도 항목 2개로 쪼개고, 둘 다 같은 `audio_id`를 참조하게 해서 "한글이 중간에 끼워지는" 효과를 데이터 구조만으로 구현하려 함.
- **왜 실패했나**: 사용자가 지적함 — 마스터 템플릿의 `.audio-text` 블록은 **블록 단위로 hover/클릭 하이라이트**가 걸리는 구조라서, 문장을 2개 블록으로 나누면 "어느 부분에 마우스를 올려도 문장 전체가 하이라이트"되는 요구사항을 절대 만족시킬 수 없음(각 블록이 독립적으로만 하이라이트됨). 데이터를 어떻게 쪼개든 이 문제는 해결 불가능하다고 결론 남.
- **최종 대체**: `.audio-text` 블록은 반드시 1개로 유지하고, 템플릿 자체가 `getClientRects()`로 실시간 측정해서 한글을 삽입하는 방식으로 마스터 템플릿을 직접 수정 (다른 대화로 이관).

### 4-3. zipper: "해석(한글)이 항상 노출된다"는 가정 — **폐기, 근거 없이 임의로 판단했다가 되돌림**
- **시도한 것**: 사용자가 준 예시(영어 줄/한글 줄이 번갈아 보이는 스크린샷)를 보고, "zipper 타입은 한글이 항상 노출되는 특수 유형인가 보다"라고 임의로 추론해서, [해석] 버튼을 zipper 타입일 때만 숨기고 한글을 항상 렌더링하도록 코드를 고침.
- **왜 실패했나**: 사용자가 "그 정의가 어디 있냐"고 되물어서 재확인한 결과, 실제로는 원본 코드 어디에도 그런 근거가 없었음(원본 260601 데이터의 zipper 예시조차 `kor` 필드가 렌더링에 쓰이지 않고 있었음). 근거 없이 추론해서 반영한 것이 문제였음.
- **최종 대체**: [해석] 버튼을 모든 타입 공통으로 원복. "항상 노출" 로직 완전히 제거.

### 4-4. Understand 헤더 버튼(비디오/How to play): 1차 시도 — 직접 그린 SVG 아이콘 — **폐기 후 실제 에셋으로 교체**
- **시도한 것**: 비디오 버튼을 파란 말풍선 모양 + 흰색 재생 삼각형을 직접 SVG로 그려서 근사치로 구현.
- **왜 대체했나**: 이후 구버전 파일(260601/260526)에서 **실제 서비스에서 쓰이는 진짜 이미지 에셋 URL**(`btn_video.png`)을 발견해서, 임의로 그린 SVG 대신 그 실제 에셋을 사용하도록 교체함(3-6의 "상단 유형 뱃지 + 헤더 액션 버튼" 행 참고). "How to play" 버튼도 마찬가지로 Tailwind 근사 스타일이었다가 정확한 원본 값(`#9c76ea`, `40px`, `18px` 등)으로 교체됨.

### 4-5. "내용 더 보기" 버튼: 1차 시도 — 캔버스 하단 중앙 배치, 임의 색상 — **폐기 후 정밀 좌표로 교체**
- **시도한 것**: 사용자가 준 참고 이미지를 눈대중으로 보고, 버튼을 캔버스 하단 중앙에 남색(indigo) 계열로 배치.
- **왜 대체했나**: 사용자가 "실제로는 하단 왼쪽에 있어야 한다"고 정정. 이후 구버전 파일에서 **정확한 좌표(`left: 96.5, top: 563.15`)와 색상(`#ee6f00`), 실제 화살표 아이콘 에셋**을 발견해서 그대로 교체함(3-6의 "내용 더 보기 버튼" 행 참고).

### 4-6. Vercel 요청 본문 크기 제한 우회 시도 — `export const config = { api: { bodyParser: ... } }` — **틀린 접근, 제거**
- **시도한 것**: Vercel 서버리스 함수의 4.5MB 요청 본문 제한을 늘리기 위해, Next.js의 API Routes에서 쓰는 `export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }` 문법을 `api/analyze-image.js`에 그대로 적용하려 함.
- **왜 틀렸나**: 이 프로젝트는 **Next.js가 아니라 순수 Vite** 프로젝트이고, 이 `config` export 문법은 Next.js 프레임워크 전용 컨벤션이라 일반 Vercel 서버리스 함수(Node.js 런타임)에서는 아무 효과가 없음. Vercel의 4.5MB 제한은 이 방식으로는 우회 불가능한 **플랫폼 하드 리밋**임.
- **최종 대체**: 서버 쪽 우회를 포기하고, **프론트엔드에서 업로드 전에 이미지를 리사이즈/압축**하는 방식으로 문제 자체를 회피 (2-5, 3-7 참고).

### 4-7. `updateGlobalData` vs `handleGlobalDataChange`: 이름이 겹치는 두 함수 — 하나는 죽은 코드로 방치 (이후 삭제됨)
- **발견한 것**: 리팩토링 과정에서 `updateGlobalData`(실제로 JSX 8곳에서 참조됨, 정의가 누락되어 있었음)와 `handleGlobalDataChange`(정의는 있으나 실제로는 어디서도 호출되지 않는 죽은 코드)가 동시에 존재하는 상태였음. 아마 리팩토링 중 이름을 바꾸다가 일부 호출부만 갱신되고 정의가 누락된 것으로 추정.
- **당시 처리 방식**: `updateGlobalData`(실제로 쓰이는 쪽)를 복원. `handleGlobalDataChange`(안 쓰이는 쪽)는 일단 삭제하지 않고 방치 — 제거해달라는 요청이 없었기 때문.
- **최종 처리(2-16)**: 이후 코드 용량(5줄)이 작고 이름 혼동으로 인한 오호출 위험만 있다고 판단해 `handleGlobalDataChange`를 삭제함.

### 4-8. package.json `server` 스크립트: `cd server && npm start` 방식 — **폐기, dotenv 경로 버그의 원인**
- **시도한 것**: 초기에는 `"server": "cd server && npm start"` 형태로 스크립트를 짰었음(정확한 원본 형태는 불명확하나, 실행 시 cwd가 `server/`가 되는 방식이었을 것으로 추정).
- **왜 문제였나**: 이후 스크립트를 `"server": "node server/index.js"`(루트에서 실행)로 단순화하면서, `dotenv.config()`가 기본적으로 **cwd 기준**으로 `.env`를 찾는다는 사실을 간과함 → 루트 실행 시 `content-agent/.env`를 찾게 되어 `server/.env`를 못 찾는 버그 발생.
- **최종 대체**: `dotenv.config({ path: path.join(__dirname, '.env') })`로 **스크립트 실행 위치와 무관하게 파일 자신의 위치 기준**으로 `.env`를 찾도록 수정 (3-6 참고).

### 4-9. Vercel 배포 방식: CLI(`vercel` 명령어) 단독 — **1차로 제안했다가 GitHub 연동으로 최종 변경**
- **시도한 것**: 처음엔 `vercel login` → `vercel` → `vercel env add` → `vercel --prod`로 이어지는 CLI 단독 배포 절차를 안내함.
- **왜 대체했나**: 사용자에게 CLI 방식과 GitHub 연동 방식을 비교 설명한 뒤, 이 프로젝트가 반복적으로 자주 수정되는 패턴이라는 점을 고려해 **GitHub 연동(push하면 자동 재배포) 방식이 더 적합**하다고 판단, 사용자도 이를 선택함.
- **최종 대체**: `git init` → GitHub 저장소 생성 → `git push` → Vercel에서 GitHub 저장소 Import → 환경변수 등록 → Deploy 순서로 안내 진행 중 (배포 실행 자체는 프로젝트 내 다른 대화로 이관됨).

---

## 5. 제약조건 및 주의사항

### 5-1. API 키 관련
- API 키는 **절대 브라우저 코드에 노출 금지**. `server/.env`(로컬) 또는 Vercel 환경변수(배포)에만 존재해야 함.
- `server/.env`는 `.gitignore`에 포함되어 있어 커밋되지 않지만, **혹시라도 실수로 커밋되지 않았는지 배포 전 반드시 확인** 필요.
- `server/.env` 파일 자체는 어떤 경우에도 Claude(채팅)나 다른 사람에게 전달하면 안 됨 (API 키 노출).

### 5-2. `ANALYZE_PROMPT` 이중 관리 문제 (해결됨, 2-15 참고)
- ~~이미지 분석 프롬프트가 `server/index.js`(로컬용)와 `api/analyze-image.js`(배포용) 두 파일에 동일하게 중복 존재함.~~ → `lib/analyzePrompt.js` 공유 모듈로 분리해서 해결함. 프롬프트를 고칠 땐 이제 이 파일 한 곳만 고치면 됨.
- 단, `extractJson`·`analyzeWithClaude` 함수 본체는 여전히 두 파일에 각각 존재하므로, 그 로직을 고칠 땐 지금도 두 파일 모두 동기화해야 함 (3-4 참고).

### 5-3. Vercel 서버리스 함수의 하드 리밋
- 요청 본문(body) 최대 **4.5MB**, Next.js가 아닌 순수 Vite 프로젝트라 `config.api.bodyParser` 같은 설정으로 우회 불가능 (4-6 참고).
- 이 제약 때문에 프론트엔드에 이미지 리사이즈 로직이 들어가 있음 — 이 로직을 건드리거나 제거할 때는 반드시 이 제약을 다시 고려해야 함.

### 5-4. IndexedDB 기반 템플릿 저장의 한계
- 관리자 모드에서 업로드하는 마스터 ZIP 템플릿은 **서버가 아니라 브라우저 IndexedDB**에 저장됨.
- **브라우저 + 도메인(origin) 단위로 완전히 분리된 저장소**라서:
  - 로컬(`localhost:5173`)에서 업로드한 템플릿은 배포 도메인에서 안 보임 → 배포 후 최초 1회 재업로드 필요.
  - **여러 사용자가 각자 다른 브라우저로 접속하면, 각자 브라우저에 템플릿이 없어서 각자 업로드해야 함.** "관리자 한 명이 등록하면 모두가 공유"되는 구조가 아님.
  - 이 구조를 여러 사용자가 함께 쓰는 서비스로 만들려면, 템플릿을 서버/클라우드 스토리지로 옮기는 재설계가 필요함 (아직 미착수).

### 5-5. 저작 도구(App.jsx)와 마스터 템플릿(view0X.js)은 서로 다른 코드베이스
- 이 둘을 혼동해서 한쪽 문제를 다른 쪽에서 고치려 하면 안 됨. 실제로 대화 중 여러 번 "캔버스 미리보기는 맞는데 병합 추출 결과가 다르다"는 문제가 있었고, 원인은 매번 둘 중 하나였음(가끔은 저작 도구 쪽 근사치 문제, 가끔은 마스터 템플릿 자체의 로직 부재).
- **마스터 템플릿(`view0X.js`, `view0X.css`) 수정이 필요한 이슈는 이 프로젝트의 "저작 도구 대화"가 아니라 별도의 "마스터 템플릿 대화"에서 처리하는 것으로 이미 관행이 정해짐** (2-8 참고). Claude Code로 작업을 이어받을 때도 이 구분을 유지할 것.

### 5-6. 근거 없는 추측으로 코드를 고치지 말 것 (실제로 있었던 실수)
- 과거 한 번, 사용자가 준 스크린샷만 보고 "zipper 타입은 한글이 항상 노출되나 보다"라고 임의로 추론해서 코드를 고쳤다가, 실제로는 근거가 없어서(사용자가 "어디 정의되어 있냐"고 되물어서) 되돌린 사례가 있음 (4-3 참고).
- **색상/좌표/폰트/동작 방식 등을 "그럴듯해 보여서" 임의로 정하지 말고, 반드시 구버전 파일(260601 등) 또는 실제 마스터 템플릿 코드에서 근거를 찾아 검증한 뒤 반영할 것.** 근거를 못 찾으면 사용자에게 솔직히 "추측"이라고 밝히고 확인을 구할 것.

### 5-7. 캔버스는 `scale(...)`로 축소되어 있음
- 저작 도구의 2단계 편집 캔버스는 항상 1280×720 기준으로 만들어지고, 화면 크기에 맞춰 전체가 `transform: scale(...)`로 축소됨.
- **실제 DOM 요소의 픽셀 위치를 측정해서 뭔가를 배치하는 로직(예: zipper 한글 위치 계산)을 만들 때는, 측정값을 반드시 이 `scale`로 나눠서 논리적 좌표로 변환한 뒤 사용해야 함.** 이걸 빠뜨리면 화면 크기에 따라 위치가 어긋남.

### 5-8. 외부 CDN 의존성
- 비디오 버튼(`btn_video.png`), 더보기 화살표 아이콘(`icon_arrow_0.svg`) 등이 **사내 개발용 CDN**(`aidtcdn-dev.aitextbook.co.kr`) 이미지를 직접 참조함.
- 그 CDN에 접근할 수 없는 네트워크 환경(예: 외부 배포 후 다른 회사망)에서는 이 이미지들이 깨져 보일 수 있음. 필요 시 이미지를 프로젝트에 내장하는 방식으로 바꿔야 할 수 있음.

### 5-9. `node_modules`는 절대 전달/커밋 대상이 아님
- 루트 `node_modules`와 `server/node_modules`는 서로 다른 패키지가 들어있는 별개 폴더(2-3 참고)이지만, 둘 다 `npm install` / `npm run server-install`로 언제든 재생성 가능한 캐시성 파일이므로 Git에 커밋하거나 채팅으로 전달할 필요가 전혀 없음. (`.gitignore`에 이미 반영됨)

### 5-10. 설정 변경 후 재시작이 필요한 경우
- `server/.env` 변경 → 서버(`npm run server` 또는 `dev:all`) 재시작 필요 (`.env`는 서버 시작 시 1회만 읽음).
- `vite.config.js` 변경(특히 `server.proxy`) → Vite 개발 서버 재시작 필요.

### 5-11. 핵심 데이터 구조 (data.js 스키마) 요약
- `GLOBAL_DATA.header`: `{ letter, text, instruction, color, btn_aria_label }`
- `GLOBAL_DATA.video_file_name`, `GLOBAL_DATA.video_aria_label`, `GLOBAL_DATA.more_content: { has_content, content_text }`
- `PAGE_DATA[n].bubble`: `{ width, x, y, tail_dir(top/bottom/left/right), tail_pos(0~100), tail_tip(left/right), bg_color, border_color }`
- `PAGE_DATA[n].text.type`: `"inline" | "lines" | "zipper"`
  - `inline`/`zipper`: `text.eng`는 `{ sentence, kor, audio_id }` 배열
  - `lines`: `text.eng`는 `[{ lines: [{ en, ko }, ...], audio_id }]` (오디오 1개에 여러 줄)
- Roleplay A: `dialogues`(대화) + `tableQuiz`(표 퀴즈: `headers`, `staticRow`, `rowCount`)
- Roleplay B: `scenes` 배열, 각 씬마다 `rolePlayImage`, `panelBtnImage`, `roleA`/`roleB`, `dialogues`

---

## 6. 현재 진행 상태

### 완료된 것
- **Understand 유형**: 소실됐던 함수 전부 복원(9건), 캔버스-실제 병합 결과 간 정밀도 불일치 다수 해결(색상/좌표/여백/에셋 등), AI 분석 프롬프트 개선(좌표 추출, textType 판정), zipper 텍스트 렌더링을 마스터 템플릿과 동일한 알고리즘으로 최종 포팅, 이전/다음 컷 네비게이션 신규 구현. **사실상 마무리 단계**로 판단하고 있었음(사용자가 "언더스탠드 유형은 어느정도 된것같은데"라고 표현).
- **Roleplay A**: 1차 검수 완료. 구조적 문제(함수 누락)는 없었고, "How to play" 버튼 스타일 정밀화만 필요해서 수정함. **깊은 검수는 아직 안 함** (실사용 테스트는 사용자 몫으로 남겨둠).
- **배포 준비 (코드 작업)**:
  - `server/index.js` → `api/analyze-image.js`, `api/health.js`(Vercel 서버리스 함수)로 변환 완료
  - `App.jsx`의 `AI_PROXY_URL`을 상대경로로 변경 완료
  - 이미지 업로드 시 조건부 리사이즈/압축 로직 추가 완료 (3MB 초과 시에만 동작)
  - `vite.config.js`에 로컬 개발용 프록시 설정 추가 완료 (기존 `port: 5173` 유지)
  - `.gitignore` 생성 완료
- **문서화**: 전체 고도화 이력을 엑셀로 정리(시간순 재배열까지 완료), 이 `CLAUDE.md` 작성 중.
- **보류 질문 3건 해결 (Claude Code 인수 후)**: Understand 메인 이미지 늘림 처리로 통일(2-14), `ANALYZE_PROMPT` 공유 모듈 분리(2-15), 죽은 코드 `handleGlobalDataChange` 삭제(2-16).

### 진행 중 / 아직 안 끝난 것
- **Git/GitHub 연동 배포**: 방법(GitHub 연동 vs CLI)은 GitHub 연동으로 확정했고, `git init`부터 Vercel 프로젝트 연결 및 환경변수(`ANTHROPIC_API_KEY`) 등록까지 절차를 안내했으나, **실제로 사용자가 이 절차를 다 실행해서 배포가 완료됐는지는 이 대화에서 확인되지 않음**. 이 작업 자체를 "프로젝트 내 다른 대화"로 이관하기로 함.

### 다음에 해야 할 일 (남은 작업 목록)
1. **배포 실행 완료 확인** — 다른 대화(배포 전용)에서 진행 중이거나 진행 예정. Claude Code가 이어받을 때 배포 상태부터 확인 필요.
2. **배포 후 실사용 테스트** — 실제 도메인에서 이미지 업로드 → AI 분석 → 편집 → ZIP 추출까지 전 과정 테스트. 특히 이미지 리사이즈(3MB 기준, 1600px/82% 품질)가 실제 교과서 사진들에 적절한지 검증 필요.
3. **Roleplay A 실사용 검수 계속** — 구조적으로는 문제없다고 확인했지만, 실제 콘텐츠를 만들어보면서 정밀도 이슈(understand처럼)가 나올 수 있음.
4. **Roleplay B 기능 개발** — 이번 대화에서 **검수조차 되지 않음**. 실제로는 검수 이전에 롤플레이 B형에 필요한 기능 상당수가 아직 `App.jsx`에 구현되어 있지 않은 상태라, 기능 개발부터 필요함.

~~5. Understand 이미지 렌더링 방식 결정~~ → 늘림 처리로 확정, 반영 완료 (2-14).
~~6. `ANALYZE_PROMPT` 중복 관리 방식 결정~~ → 공유 모듈 분리로 확정, 반영 완료 (2-15).
~~7. `handleGlobalDataChange` 죽은 코드 정리 여부~~ → 삭제로 확정, 반영 완료 (2-16).

---

## 7. 미해결/판단 보류된 질문

### 7-1. Understand 메인 이미지 렌더링 방식 — ✅ 해결됨 (2-14 참고)
- **문제였던 것**: 마스터 템플릿 원본은 `backgroundSize: '100% 100%'`(비율 무시하고 늘림)를 쓰는데, 저작 도구 캔버스는 `object-cover`(비율 유지, 크롭)를 씀 (발견 2).
- **결정**: Claude Code 인수 후 사용자에게 재질의하여 "늘림 처리로 통일"로 확정, `src/App.jsx`의 메인 배경 이미지를 `object-fill`로 수정 완료.

### 7-2. `handleGlobalDataChange` 죽은 코드 — ✅ 해결됨 (2-16 참고)
- **문제였던 것**: `App.jsx`에 `updateGlobalData`(실제 사용됨)와 이름이 비슷한 `handleGlobalDataChange`(정의는 있지만 어디서도 호출 안 됨)가 공존하는 상태.
- **결정**: 코드 용량(5줄)이 작아 삭제 여부를 판단 기준으로 삼기로 하고, 실제로 작음을 확인한 뒤 삭제함.

### 7-3. `bubble: null` 처리가 마스터 템플릿에서 실제로 작동하는지 100% 확인 안 됨
- Understand에서 문장이 비어있을 때 ZIP 추출 시 `bubble` 필드를 `null`로 내보내도록 만들었는데(2-13), 이건 **"마스터 템플릿이 `bubble: null`을 보면 말풍선을 안 그릴 것"이라는 가정 하에** 만든 것. 실제 마스터 템플릿의 렌더링 코드로 이 가정이 맞는지 확인된 적은 없음.
- **확인 방법**: 문장을 비운 상태로 실제 병합 추출까지 해보고, 마스터 템플릿 화면에서 말풍선이 진짜로 안 그려지는지 실사용 테스트 필요.

### 7-4. 이미지 리사이즈 설정값(3MB 기준, 1600px, JPEG 82%)이 실사용 검증되지 않음
- 이 숫자들은 전부 계산상 안전할 것으로 추정한 값이지, 실제 교과서 사진들로 테스트해서 "화질도 괜찮고 용량도 안전하다"고 검증된 값은 아님.
- **확인 필요**: 배포 후 실제 사진들을 업로드해보면서 화질이 너무 떨어지진 않는지, 4.5MB 제한에 걸리는 경우가 없는지 확인.

### 7-5. Roleplay B는 아예 검수 대상에서 빠져 있었음
- 이번 대화에서 Understand와 Roleplay A는 상당히 깊게 다뤘지만, **Roleplay B는 한 번도 별도로 점검하지 않음**. 구조적 문제(함수 누락 등)가 있는지조차 확인 안 된 상태.

### 7-6. 마스터 템플릿의 `placeZipperKorean()` 전체 원본 코드는 이 대화 기록에 없음
- App.jsx에 포팅된 버전(3-6 참고)은 있지만, 마스터 템플릿 쪽 원본 함수 전체 코드는 "이관된 별도 대화"에만 있고 이 문서에는 옮기지 않음.
- **필요 시**: 그 이관 대화 기록을 다시 찾아서 참고해야 함 (사용자가 어느 대화인지 알고 있어야 함).

### 7-7. 배포가 실제로 완료됐는지 이 대화에서는 확인 안 됨
- Git/GitHub 연동 절차 안내까지만 이 대화에서 진행했고, 사용자가 실제로 그 단계들을 다 실행해서 Vercel 배포가 완료됐는지, 배포된 사이트가 정상 작동하는지는 **확인되지 않은 상태**로 대화가 이관됨.

### 7-8. `ANALYZE_PROMPT` 중복 관리를 그대로 둘지, 공유 모듈로 뺄지 — ✅ 해결됨 (2-15 참고)
- **문제였던 것**: `server/index.js`(로컬)와 `api/analyze-image.js`(배포)에 이미지 분석 프롬프트가 완전히 동일하게 중복되어 있었음 (5-2 참고).
- **결정**: `lib/analyzePrompt.js` 공유 모듈로 분리해서 두 곳에서 import하도록 리팩토링 완료. (단, `extractJson`/`analyzeWithClaude`는 이번 리팩토링 범위 밖이라 여전히 중복 — 3-4 참고)